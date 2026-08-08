# 内置 `syn` 与 `quote!`

Riddle 的过程宏包内置 `syn` 模块和 `quote!`。它们随 Clue 注入过程宏包，
不需要在 `Clue.toml` 中声明额外依赖：

```riddle
use syn::{Data, DeriveInput, parse};

#[proc_macro_derive(Answer)]
pub fun derive_answer(input: TokenStream) -> TokenStream {
    let parsed = match parse::<DeriveInput>(input) {
        Result::Ok(value) => value,
        Result::Err(error) => {
            error.emit();
            return TokenStream::new();
        },
    };

    match &parsed.data {
        Data::Struct(_) => {},
        Data::Enum(_) => {
            Diagnostic::error(
                parsed.ident.span(),
                "Answer can only be derived for structs",
            ).emit();
            return TokenStream::new();
        },
    }

    let generated = Ident::new("generated_answer", parsed.ident.span());
    quote! {
        fun #generated() -> i32 { 42 }
    }
}
```

使用方只需依赖并导入这个宏包：

```riddle
use answer_macros::Answer;

#[derive(Answer)]
struct Marker {}

fun main() -> i32 {
    generated_answer()
}
```

## 解析入口

`syn` 提供两个通用解析函数：

```riddle
use syn::{Expr, Type, parse, parse_str};

let expr = parse::<Expr>(input);
let ty = parse_str::<Type>("&mut Vector<i32>");
```

- `parse::<T>(tokens)` 从 `TokenStream` 解析实现了 `Parse` 的类型。
- `parse_str::<T>(source)` 先对字符串进行词法分析，再执行同样的解析。
- 失败时返回 `syn::Error`；`Error` 包含 `span` 和 `message`，可用
  `error.emit()` 发出编译诊断。

当前内置实现为以下类型提供 `Parse`：

| 类型 | 用途 |
| --- | --- |
| `DeriveInput` | 解析 derive 宏接收的结构体或枚举 |
| `File` | 解析由多个条目或语句组成的 token 流 |
| `Item` | 解析一个顶层条目 |
| `Stmt` | 解析一条语句 |
| `Expr` | 解析一个表达式 |
| `Type` | 解析一个类型 |
| `Pat` | 解析一个模式 |

### 自定义 `Parse`

过程宏可以为自己的输入类型实现 `Parse`：

```riddle
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
                    Result::Err(Error::new(input.span(), "unexpected token"))
                }
            },
            Option::Some(tree) => {
                Result::Err(Error::new(tree.span(), "expected identifier"))
            },
            Option::None => {
                Result::Err(Error::new(input.span(), "expected identifier"))
            },
        }
    }
}
```

`ParseStream` 提供 `is_empty()`、`peek_ident()`、`peek_punct()`、`span()`、
`next()`、`remaining()` 和 `parse::<T>()`。这些接口直接操作结构化 token，
不会依赖字符串切分。

## `DeriveInput`

`DeriveInput` 为 derive 宏提供结构化输入：

```riddle
pub struct DeriveInput {
    pub attrs: Vector<Attribute>,
    pub vis: Visibility,
    pub ident: Ident,
    pub generics: Generics,
    pub data: Data,
}
```

`Visibility` 目前分为 `Inherited` 和 `Public`。`Data` 分为：

```riddle
pub enum Data {
    Struct(DataStruct),
    Enum(DataEnum),
}
```

结构体字段通过 `DataStruct.named` 和原始字段 token 提供；枚举通过
`DataEnum.items` 提供结构化变体。字段形状使用 `Fields` 表示：

```riddle
pub enum Fields {
    Unit,
    Named(Vector<Field>),
    Unnamed(Vector<Type>),
}
```

泛型信息位于 `Generics`：

- `tokens` 保存 `<...>`；
- `where_clause` 保存 `where ...`；
- `params` 包含 `GenericParam::Type` 和 `GenericParam::Const`；
- `predicates` 包含解析后的 `WherePredicate`。

`Attribute`、`Field`、`Variant`、泛型参数和 where 谓词同时保留自己的
`TokenStream`，因此宏既可以读取结构化字段，也可以无损地把原节点写回输出。
`DeriveInput::to_token_stream()` 返回完整输入的 token 副本。

## 语法节点

除 `DeriveInput` 外，`Item`、`Stmt`、`Expr`、`Type` 和 `Pat` 会校验当前
Riddle 语法并按类别保存 token。这些节点不是每个语法细节都有独立字段的完整 AST；
需要检查具体细节时，可以匹配类别后读取该变体中的 `TokenStream`，或使用
`Visit`、`Fold` 递归处理嵌套语法。

### `Item`

支持模块、`use`、函数、结构体、枚举、trait、impl、常量、类型别名和
`extern` 条目：

```riddle
match item {
    Item::Function(tokens) => println!("{}", tokens.to_string()),
    Item::Struct(tokens) => println!("{}", tokens.to_string()),
    _ => {},
}
```

### `Stmt`

`Stmt` 分为 `Item`、`Local`、`Expr`、`Break`、`Continue` 和 `Return`。
`File.stmts` 保存从一个完整 token 流解析出的语句。

### `Expr`

`Expr` 覆盖字面量、路径、块、元组、数组、结构体字面量、调用、字段访问、
索引、一元和二元表达式、转换、`?`、闭包、`if`、`while`、`for`、`match`、
`unsafe` 和宏调用。

### `Type`

`Type` 覆盖路径、引用、指针、元组、数组、常量类型、never 类型、
`impl Trait` 和宏类型。

### `Pat`

`Pat` 覆盖通配符、字面量、元组、结构体、枚举、绑定、引用和宏模式。

所有上述节点以及 `DeriveInput` 的结构化子节点都实现 `ToTokens`：

```riddle
use syn::{Expr, ToTokens, parse_str};

let expr = parse_str::<Expr>("value + 1").unwrap();
let mut output = TokenStream::new();
expr.to_tokens(&mut output);
```

## `quote!`

`quote!` 把 Riddle token 写入新的 `TokenStream`。`#name` 会插入实现了
`ToTokens` 的值：

```riddle
let name = Ident::new("answer", Span::call_site());
let value = parse_str::<Expr>("40 + 2").unwrap();

let output = quote! {
    fun #name() -> i32 { #value }
};
```

`quote!` 支持使用 `*` 重复一个向量，并可在 `*` 前放置一个分隔 token：

```riddle
let tuple = quote! { (#(#names),*) };
```

同一个重复块中的多个向量会按下标配对：

```riddle
let fields = quote! { { #(#names: #values),* } };
```

参与同一重复块的向量长度必须相等；长度不一致会使宏展开失败。重复块必须至少
包含一个 `#name`。当前重复语法支持 `#(...)*` 和带单个分隔 token 的
`#(...),*` 形式。

## 遍历与改写

`Visit` 以借用方式遍历节点。覆盖方法后调用对应的 `walk_*`，即可继续递归：

```riddle
use syn::{Expr, Visit};

struct ExprCounter {
    count: usize,
}

impl Visit for ExprCounter {
    fun visit_expr(&mut self, node: &Expr) {
        self.count += 1usize;
        syn::walk_expr(self, node);
    }
}
```

可覆盖的方法为 `visit_file`、`visit_item`、`visit_stmt`、`visit_expr`、
`visit_type`、`visit_pat` 和 `visit_derive_input`。对应的递归函数分别为
`walk_file`、`walk_item`、`walk_stmt`、`walk_expr`、`walk_type`、
`walk_pat` 和 `walk_derive_input`。

`Fold` 取得节点所有权并返回改写后的节点：

```riddle
use syn::{Expr, Fold, parse_str};

struct ReplaceTwo {}

impl Fold for ReplaceTwo {
    fun fold_expr(&mut self, node: Expr) -> Expr {
        let replace = match &node {
            Expr::Literal(tokens) => tokens.to_string().as_str() == "2",
            _ => false,
        };
        if replace {
            return parse_str::<Expr>("3").unwrap();
        }
        syn::fold_expr(self, node)
    }
}
```

可覆盖的方法为 `fold_file`、`fold_item`、`fold_stmt`、`fold_expr`、
`fold_type`、`fold_pat` 和 `fold_derive_input`。在自定义方法末尾调用同名的
`syn::fold_*` 函数可执行默认的递归改写。

## 当前边界

- `DeriveInput` 只接受结构体和枚举；Riddle 当前没有 union 条目。
- 通用语法节点保留分类后的 token，不提供与 Rust `syn` 完全同构的字段级 AST。
- `ParseStream` 提供最小的 token 游标接口，不包含 Rust `syn` 的全部解析宏和
  parser combinator。
- `quote!` 重复目前使用 `*`，分隔符为一个 token。

底层 `TokenStream`、`TokenTree`、`Span` 和诊断接口见
[Clue 构建器的过程宏章节](./clue.md#过程宏)。
