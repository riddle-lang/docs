# 编写过程宏

过程宏是宏包导出的、在编译期运行的 Riddle 函数。它收到的是 token 而不是文本，返回的 token 会被插回调用点再继续解析。宏包由`clue`编译成宿主平台的动态库，由独立的 runner 进程按需执行。

宏包代码只在过程宏宿主里编译：`clue` 编译宿主时前置注入`std/std/proc_macro.rid`与`std/std/syn.rid`，并内置`quote!`。`riddlec`单独编译不了这些片段，所以本页的宏包代码与调用方代码都用 text 围栏。

## 宏包清单

`clue new`没有`--proc-macro`选项，先建普通库再改清单：

```bash
clue new --lib answer-macros
```

```toml
[package]
name = "answer-macros"
version = "0.1.0"

[lib]
name = "answer-macros"
path = "src/lib.rid"
proc-macro = true

[dependencies]
```

`proc-macro = true`把包的类别定为过程宏包：产物是`answer-macros.proc-macro`（动态库）加`answer-macros.proc-macro-runner`（可执行文件），不会链进使用方的程序。宏包可以依赖另一个宏包（本地 path 依赖即可），`clue check`也能直接检查宏包自身。

宿主里可直接使用`TokenStream`、`TokenTree`、`Group`、`Ident`、`Punct`、`Literal`、`Span`、`Diagnostic`、`Delimiter`、`Spacing`、`ToTokens`与`syn`模块，不需要声明依赖；`quote!`也是内置的，不需要导入。细节见[内置 `syn` 与 `quote!`](./syn.md)。

## 三种导出属性

| 种类 | 导出属性 | 签名 | 调用位置 |
| --- | --- | --- | --- |
| 函数式宏 | `#[proc_macro]` | `fun (input: TokenStream) -> TokenStream` | `name!(...)`，出现在表达式、条目、类型、模式位置 |
| derive 宏 | `#[proc_macro_derive(Name)]` | `fun (input: TokenStream) -> TokenStream` | `#[derive(Name)]`，用于结构体与枚举 |
| 属性宏 | `#[proc_macro_attribute]` | `fun (args: TokenStream, item: TokenStream) -> TokenStream` | `#[name(...)]`，用于条目 |

构建宏包时逐条校验签名，任一条不满足都会让构建失败：

- 函数必须是`pub`；
- 不能有泛型参数；
- 参数个数固定：属性宏两个`TokenStream`，函数式宏与 derive 宏一个；
- 返回类型必须是`TokenStream`；
- 一个函数最多挂一个导出属性，宏名不能重复，整个包一个宏都不导出也会失败。

这些检查发生在`clue`侧，报的是普通错误文本（退出码 1），没有错误码前缀。

## 展开过程

编译器先在 token 文档里定位调用点，把调用点的参数整体作为平衡的 token tree 交给宏，再把结果写回文档重新解析，如此循环到没有可展开的调用。宏看到的是 token tree，空白和注释不在其中。

- derive 宏与属性宏的输出必须是顶层条目，否则报 E0400（`derive macro output must contain only top-level items`、`attribute macro output must contain only top-level items`）。
- 输出里的宏会继续展开，嵌套深度上限 32，超过时报`process macro expansion exceeded the maximum depth of 32`。
- 函数式宏的展开结果直接替换调用点，所以输出必须符合所在位置的语法：表达式位置输出表达式，条目位置输出条目。
- 属性宏只能标记条目，不能标记语句或表达式。

## 第一个函数式宏

```text
#[proc_macro]
pub fun answer(_input: TokenStream) -> TokenStream {
    TokenStream::from_str("42").unwrap_or(TokenStream::new())
}
```

`TokenStream::from_str`做词法分析，失败返回`LexError`；这里用`unwrap_or`退回空流。参数名写`_input`表示不读输入，Riddle 也允许未使用的参数。

使用方照常声明依赖并导入宏：

```toml
[dependencies]
answer_macros = { package = "answer-macros", path = "../answer-macros" }
```

```text
use answer_macros::answer;

fun main() -> i32 {
    answer!()
}
```

## derive 宏

derive 宏拿到整个条目的 token。用`syn::parse`解析成`DeriveInput`比手写 token 遍历可靠：

```text
use crate::std::vector::Vector;
use syn::{Attribute, Data, DeriveInput, parse};

fun skipped(attrs: &Vector<Attribute>) -> bool {
    for attr in attrs.as_slice() {
        if attr.tokens.to_string().contains("skip") {
            return true;
        }
    }
    false
}

#[proc_macro_derive(Getters, attributes(getter))]
pub fun derive_getters(input: TokenStream) -> TokenStream {
    let parsed = match parse::<DeriveInput>(input) {
        Result::Ok(value) => value,
        Result::Err(error) => {
            error.emit();
            return TokenStream::new();
        },
    };

    let mut getter_fns = Vector::new();
    match &parsed.data {
        Data::Struct(data) => {
            for field in data.named.as_slice() {
                if skipped(&field.attrs) {
                    continue;
                }
                let field_name = &field.ident;
                let field_ty = &field.ty;
                getter_fns.push(quote! {
                    pub fun #field_name(&self) -> &#field_ty {
                        &self.#field_name
                    }
                });
            }
        },
        Data::Enum(_) => {
            Diagnostic::error(
                parsed.ident.span(),
                "Getters can only be derived for structs",
            ).emit();
            return TokenStream::new();
        },
    }

    let struct_name = &parsed.ident;
    let generic_params = &parsed.generics.tokens;
    let where_clause = &parsed.generics.where_clause;
    quote! {
        impl #generic_params #struct_name #generic_params #where_clause {
            #(#getter_fns)*
        }
    }
}
```

```text
use answer_macros::Getters;

#[derive(Getters)]
struct Point<T> where T: Copy {
    x: T,
    y: T,
}

fun main() -> i32 {
    let point = Point { x: 1, y: 2 };
    *point.x() + *point.y()
}
```

要点：

- 解析失败时先`error.emit()`再返回空`TokenStream`，让调用点看到定位到输入的错误；宏里`panic`只会让 worker 失败，用户得到的是展开失败而不是有位置的诊断。
- `parsed.data`、`parsed.generics`按字段取，`data.named.as_slice()`按借用遍历；不要用结构体模式拆`DeriveInput`（原因见「常见问题」）。
- `#(#getter_fns)*`把`Vector`里的每个`TokenStream`按顺序展开；同一个重复块里的多个变量长度必须相等，否则宏进程 panic，本次展开以 E0400 失败。
- 宏返回的 token 会被重新解析，展开失败的诊断定位到调用点，也就是`#[derive(...)]`那一行。

## 属性宏

属性宏收到属性括号里的 token 和被标记的整个条目，返回的必须是条目：

```text
#[proc_macro_attribute]
pub fun trace_level(args: TokenStream, item: TokenStream) -> TokenStream {
    if args.is_empty() {
        Diagnostic::error(
            Span::call_site(),
            "trace_level requires a numeric argument",
        ).emit();
        return TokenStream::new();
    }

    let mut output = TokenStream::new();
    output.extend(TokenStream::from_str("const TRACE_LEVEL: i32 = ").unwrap_or(TokenStream::new()));
    output.extend(args);
    output.extend(TokenStream::from_str(";").unwrap_or(TokenStream::new()));
    output.extend(item);
    output
}
```

```text
use answer_macros::trace_level;

#[trace_level(3)]
fun main() -> i32 {
    TRACE_LEVEL
}
```

`#[trace_level(3)]`展开成`const TRACE_LEVEL: i32 = 3;`再加原来的条目。参数 token 原样插入输出，属性宏只管条目这一层。

## helper 属性

`#[proc_macro_derive(Name, attributes(a, b))]`为这个 derive 注册 helper 属性。helper 属性只能出现在该 derive 标记的条目、枚举变体和字段上；没有注册就用会报`cannot find attribute ...; derive helper attributes must be declared`。上面的`Getters`注册了`getter`，字段写成：

```text
#[derive(Getters)]
struct User {
    name: String,
    #[getter(skip)]
    password_hash: String,
}
```

helper 属性连同`#`和方括号一起出现在`Field.attrs`里，宏用`attr.tokens.to_string().contains("skip")`判断即可。同一个 helper 名字重复声明会在构建宏包时报错。

## 诊断与 span

`Diagnostic`有四个级别，`emit()`把它们交给编译器：

```text
Diagnostic::error(span, "message").emit();
Diagnostic::warning(span, "message").emit();
Diagnostic::note(span, "message").emit();
Diagnostic::help(span, "message").emit();
```

span 决定错误指向哪里：

- 输入 token 自带的 span（`field.ident.span()`）指向源码里的具体位置；
- `Span::call_site()`指向整个宏调用，`Span::mixed_site()`当前与它等价；
- `span.join(other)`返回覆盖两者的`Option<Span>`。

`syn`的`Error`也带`span`与`message`，`error.emit()`等价于发一条 error 级诊断。

## 导入与命名

宏名与类型、trait、值不在同一个命名空间，可以同名。derive 宏、属性宏和函数式宏都需要`use`导入才能用短名，不导入时写限定路径`#[derive(answer_macros::Getters)]`。分组、别名、glob 和`pub use`重导出都支持：

```text
use answer_macros::{Getters, answer as value, trace_level};

#[trace_level(3)]
#[derive(Getters)]
struct User {
    name: i32,
}

fun main() -> i32 { value!() }
```

## worker

每个宏包对应一个常驻子进程，第一次展开时才启动，之后复用：

- 单次展开超时 10 秒，超时后 worker 被杀掉，错误是`proc-macro`加宏名加`exceeded the 10 second timeout`，下次展开重新启动；
- 请求与响应的消息上限都是 16 MiB，展开结果另有 128 条的缓存上限；
- 宏里的`panic`由 worker 承担，`clue` 把它报成本次展开失败，不会跟着崩；
- stdout 是宏与`clue`之间的私有协议通道，所以宏里的`print`、`println!`输出走 stderr；
- 协议版本与线格式是内部实现，不构成对外接口。

## 常见问题

- `cannot find derive macro ... in this scope; import it with use package::...;`：没有导入，或者宏包没有导出这个名字。
- `cannot find macro ... in this scope`：函数式宏的导入缺失。
- `cannot find attribute ...; derive helper attributes must be declared with attributes(...)`：字段上用了没有注册的 helper 属性。
- `derive macro output must contain only top-level items`：derive 输出里混进了语句或表达式。
- 展开超时（`exceeded the 10 second timeout`）也可能是宏自己卡住：用结构体模式拆`DeriveInput`（漏掉私有字段`tokens`）后再移动`data`，当前实现会停在这里，改用`parsed.data`这样的字段访问。
- 宏返回空`TokenStream`通常意味着前面的诊断已经发出，先看诊断。
