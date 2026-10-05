# 内置 `syn` 与 `quote!`

`syn` 是随标准库源码发布的模块（`std/std/syn.rid`），`quote!` 是编译器内置的函数宏。两者都不属于随程序链接的 std：编译过程宏包时，`clue` 把 `std/std/proc_macro.rid` 与 `std/std/syn.rid` 的文本前置进宿主源码，宏包因此直接写`use syn::{...}`就能用，不需要在`Clue.toml`里声明依赖，`quote!`也无需导入。普通程序里既没有`syn`模块也没有`TokenStream`类型，本页片段只在过程宏包内成立，所以全部用 text 围栏。

## 解析入口

三个函数都返回 `Result<T, Error>`：

```text
use syn::{Expr, Type, parse, parse_str};

let expr = parse::<Expr>(tokens);          // 从 TokenStream 解析
let ty = parse_str::<Type>("&mut [i32; 2]"); // 先词法分析，再解析
```

- `parse::<T>(tokens: TokenStream) -> Result<T, Error>`：从流的开头解析一个 `T`。
- `parse_str::<T>(source: &str) -> Result<T, Error>`：字符串先过 `TokenStream::from_str`，词法错误（`LexError`）转成带位置的 `Error`。
- `ParseStream::parse::<T>() -> Result<T, Error>`：从当前游标继续解析，用在自定义 `Parse` 里。

实现了 `Parse` 的类型只有七个：

| 类型 | 接受的输入 |
| --- | --- |
| `DeriveInput` | `struct` 或 `enum` 的完整定义 |
| `File` | 一串条目与语句 |
| `Item` | 一个顶层条目 |
| `Stmt` | 一条语句 |
| `Expr` | 一个表达式 |
| `Type` | 一个类型 |
| `Pat` | 一个模式 |

`Error` 的两个字段都是公开的：

```text
pub struct Error {
    pub span: Span,
    pub message: String,
}
```

`Error::new(span, message)`构造，`error.emit()`把它作为 error 级诊断交给编译器。解析失败时先`emit()`再返回空`TokenStream`，调用点就会看到一条带位置的错误，而不是“宏没有输出”。

## ParseStream

`ParseStream`保留整个 token 流和一个游标：

```text
pub struct ParseStream {
    tokens: TokenStream,
    index: usize,
}
```

| 方法 | 返回 | 行为 |
| --- | --- | --- |
| `new(tokens)` | `ParseStream` | 游标置于开头 |
| `is_empty()` | `bool` | 游标是否已经越过最后一个 token |
| `peek_ident(expected)` | `bool` | 下一个 token 是否是同名标识符，不移动游标 |
| `peek_punct(expected)` | `bool` | 下一个 token 是否是给定标点，不移动游标 |
| `span()` | `Span` | 当前 token 的跨度；已到末尾时是`Span::call_site()` |
| `next()` | `Option<TokenTree>` | 取出下一个 token 并前移游标 |
| `remaining()` | `TokenStream` | 游标之后的全部 token 副本，不移动游标 |
| `parse::<T>()` | `Result<T, Error>` | 把游标交给 `T` 的 `Parse` 实现 |

接口直接操作结构化 token，不做字符串切分。

## 自定义 Parse

自定义类型只要实现 `Parse` 就能被 `parse`、`parse_str` 和 `input.parse::<T>()` 解析：

```text
use syn::{Error, Parse, ParseStream};

struct NameInput {
    name: Ident,
}

impl Parse for NameInput {
    fun parse(input: &mut ParseStream) -> Result<NameInput, Error> {
        match input.next() {
            Option::Some(TokenTree::Ident(name)) => {
                if input.is_empty() {
                    Result::Ok(NameInput { name })
                } else {
                    Result::Err(Error::new(input.span(), "expected end of input"))
                }
            },
            Option::Some(tree) => Result::Err(Error::new(tree.span(), "expected an identifier")),
            Option::None => Result::Err(Error::new(input.span(), "expected an identifier")),
        }
    }
}
```

`Parse` 的签名是 `fun parse(input: &mut ParseStream) -> Result<Self, Error>`，实现里写出具体类型即可。

## DeriveInput

derive 宏的输入通常是整个条目，`DeriveInput`把它拆成可读的字段：

```text
pub struct DeriveInput {
    pub attrs: Vector<Attribute>,
    pub vis: Visibility,
    pub ident: Ident,
    pub generics: Generics,
    pub data: Data,
    tokens: TokenStream,   // 私有：完整输入的 token
}
```

`pub`换成`Visibility::Public`，没有可见性修饰符则是`Visibility::Inherited`。`Data`分两支：

```text
pub enum Data {
    Struct(DataStruct),
    Enum(DataEnum),
}

pub struct DataStruct {
    pub fields: TokenStream,     // 花括号里的原始 token
    pub named: Vector<Field>,
}

pub struct DataEnum {
    pub variants: TokenStream,   // 花括号里的原始 token
    pub items: Vector<Variant>,
}
```

字段与变体：

```text
pub struct Field {
    pub attrs: Vector<Attribute>,
    pub vis: Visibility,
    pub ident: Ident,
    pub ty: Type,
    pub tokens: TokenStream,
}

pub enum Fields {
    Unit,
    Named(Vector<Field>),
    Unnamed(Vector<Type>),
}

pub struct Variant {
    pub attrs: Vector<Attribute>,
    pub ident: Ident,
    pub fields: Fields,
    pub tokens: TokenStream,
}
```

`Attribute.tokens`是两个 token：`#`加方括号组。要按内容判断就`attr.tokens.to_string().contains("skip")`。

泛型与 where 子句分开保存：

```text
pub struct Generics {
    pub tokens: TokenStream,       // <...>，空则无泛型参数
    pub where_clause: TokenStream, // where ...，空则没有
    pub params: Vector<GenericParam>,
    pub predicates: Vector<WherePredicate>,
}

pub enum GenericParam {
    Type(TypeParam),
    Const(ConstParam),
}
```

`tokens`与`where_clause`是原样的 token，直接插进`quote!`就能还原出`impl<T> Foo<T> where T: Copy`这样的头部。

`DeriveInput`的私有字段`tokens`保存完整输入，`to_token_stream()`返回它的副本，`ToTokens`也写同一份内容。用结构体模式拆`DeriveInput`会漏掉这个私有字段：当前实现下拆完再移动`data`会让宏进程卡住，直到单次展开的 10 秒超时，因此按字段取值——`parsed.ident`、`parsed.generics.tokens`、`&parsed.data`。

## 其他语法节点

`Item`、`Stmt`、`Expr`、`Type`、`Pat` 会校验语法并记录类别，每个变体存的是该节点的完整 token：

| 节点 | 变体 |
| --- | --- |
| `Item` | `Module`、`Use`、`Function`、`Struct`、`Enum`、`Trait`、`Impl`、`Const`、`TypeAlias`、`Extern` |
| `Stmt` | `Item`、`Local`、`Expr`、`Break`、`Continue`、`Return` |
| `Expr` | `Literal`、`Path`、`Block`、`Tuple`、`Array`、`Struct`、`Call`、`Field`、`Index`、`Unary`、`Binary`、`Cast`、`Try`、`Closure`、`If`、`While`、`For`、`Match`、`Unsafe`、`Macro` |
| `Type` | `Path`、`Reference`、`Pointer`、`Tuple`、`Array`、`Const`、`Never`、`ImplTrait`、`Macro` |
| `Pat` | `Wildcard`、`Literal`、`Tuple`、`Struct`、`Enum`、`Binding`、`Reference`、`Macro` |

这些节点没有字段级 AST：`Expr::Binary`只知道自己是二元表达式，左右操作数要从 token 里读，或者交给 `Visit`、`Fold` 递归处理。`Stmt`是唯一嵌套别的节点的变体（`Stmt::Item`持有`Item`）。

## ToTokens

`ToTokens`是往`TokenStream`写 token 的接口，`syn`重导出了它：

```text
pub trait ToTokens {
    fun to_tokens(&self, output: &mut TokenStream);
}
```

```text
use syn::{Expr, ToTokens, parse_str};

let expr = parse_str::<Expr>("value + 1").unwrap();
let mut output = TokenStream::new();
expr.to_tokens(&mut output);
```

`syn`为这些类型实现了它：`File`、`Item`、`Stmt`、`Expr`、`Type`、`Pat`、`Attribute`、`Field`、`Variant`、`Fields`、`DataStruct`、`DataEnum`、`Data`、`Visibility`、`Generics`、`GenericParam`、`TypeParam`、`ConstParam`、`WherePredicate`、`DeriveInput`。`proc_macro`一侧的`TokenStream`、`TokenTree`、`Group`、`Ident`、`Punct`、`Literal`、`String`、`str`同样实现了它，所以这些值都能直接用在`quote!`的`#`后面。

## 遍历：Visit

`Visit`按借用遍历。七个方法都有默认实现，只覆盖需要观察的节点，并在自定义实现里调用对应的`walk_*`继续递归：

```text
pub trait Visit {
    fun visit_file(&mut self, node: &File) { walk_file(self, node); }
    fun visit_item(&mut self, node: &Item) { walk_item(self, node); }
    fun visit_stmt(&mut self, node: &Stmt) { walk_stmt(self, node); }
    fun visit_expr(&mut self, node: &Expr) { walk_expr(self, node); }
    fun visit_type(&mut self, node: &Type) { walk_type(self, node); }
    fun visit_pat(&mut self, node: &Pat) { walk_pat(self, node); }
    fun visit_derive_input(&mut self, node: &DeriveInput) { walk_derive_input(self, node); }
}
```

```text
use syn::{Expr, Type, Visit, parse_str};

struct Counter {
    exprs: usize,
    types: usize,
}

impl Visit for Counter {
    fun visit_expr(&mut self, node: &Expr) {
        self.exprs += 1usize;
        syn::walk_expr(self, node);
    }

    fun visit_type(&mut self, node: &Type) {
        self.types += 1usize;
        syn::walk_type(self, node);
    }
}

let mut counter = Counter { exprs: 0usize, types: 0usize };
counter.visit_expr(&parse_str::<Expr>("value.call(1)? + 2").unwrap());
```

递归函数是`syn::walk_file`、`syn::walk_item`、`syn::walk_stmt`、`syn::walk_expr`、`syn::walk_type`、`syn::walk_pat`、`syn::walk_derive_input`。

## 改写：Fold

`Fold`按值取得节点并返回改写后的节点。默认实现做递归，覆盖某个方法后调用同名的`syn::fold_*`即可回到默认递归：

```text
use syn::{Expr, Fold, parse_str};

struct ReplaceTwo {}

impl Fold for ReplaceTwo {
    fun fold_expr(&mut self, node: Expr) -> Expr {
        let replace = match &node {
            Expr::Literal(tokens) => tokens.to_string().as_str() == "2",
            _ => false,
        };
        if replace {
            match parse_str::<Expr>("3") {
                Result::Ok(value) => { return value; },
                Result::Err(_) => {},
            }
        }
        syn::fold_expr(self, node)
    }
}
```

`syn::fold_expr(&mut folder, node)`只做默认递归，不会回调`folder.fold_expr`，所以不会自递归。可覆盖的方法是`fold_file`、`fold_item`、`fold_stmt`、`fold_expr`、`fold_type`、`fold_pat`、`fold_derive_input`，对应`syn::fold_file`等七个自由函数。

## quote!

`quote!`把写在一对花括号里的 token 拼成新的`TokenStream`。`#name`插入实现了`ToTokens`的值：

```text
let name = Ident::new("answer", Span::call_site());
let body = parse_str::<Expr>("40 + 2").unwrap();

let output = quote! {
    fun #name() -> i32 { #body }
};
```

`#(...)*`是重复块，`*`前可以放一个分隔 token：

```text
let mut names: Vector<Ident> = Vector::new();
names.push(Ident::new("first", Span::call_site()));
names.push(Ident::new("second", Span::call_site()));

let tuple = quote! { (#(#names),*) };
// tuple.to_string() == "(first , second)"
```

块内有多个`#name`时按下标配对：

```text
let zipped = quote! { { #(#names: #values),* } };
// zipped.to_string() == "{first : one , second : two}"
```

规则：

- 重复变量要有`len()`和`as_slice()`，两次迭代之间按`#name.as_slice()[i]`取值，`Vector<T>`满足这个要求。
- 参与同一个重复块的变量长度必须相等，否则宏进程运行时 panic（`quote repetition variables have different lengths`），本次展开以 E0400 失败。
- 重复块至少要有一个`#name`，否则展开报错，消息以`quote repetition must contain`开头。
- 分隔符只能是一个 token，写成`#(...),*`或`#(...);*`，不能是 token 序列。
- `to_string()`按 token 渲染并补空格，所以比较结果时要写`(first , second)`这种形式。

`quote!`展开出的代码构造`crate::TokenStream`，因此它只在过程宏宿主里可用，普通程序里没有这个类型。

## 边界

- 通用语法节点只保留分类后的 token，不提供与字段一一对应的 AST。
- `DeriveInput`只接受`struct`与`enum`的定义形式，且必须带花括号体——Riddle 的结构体只有命名字段一种写法（`struct Wrapper(i32);`是解析错误），也没有 union 条目，所以`Fields::Unnamed`只出现在枚举变体上。
- `ParseStream`只有`peek_*`、`next`、`remaining`、`parse`这几个接口，没有 Rust `syn` 的解析宏与组合子。
- `Span::mixed_site()`当前等价于`Span::call_site()`，`Span::join`返回`Option<Span>`。
- 重复语法只有`*`，没有`?`或`+`。
