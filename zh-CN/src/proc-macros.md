# 编写过程宏

过程宏是运行在编译期、接收 Riddle 源码 token 并生成新代码的函数。它比
声明式宏更强大，也更容易写错。本章从一个空目录开始，逐步完成一个真实的
宏包：包含函数式宏、derive 宏和属性宏各一个，并解释每一行代码为什么这样写。

## 三种过程宏

| 种类 | 导出属性 | 签名 | 调用位置 |
| --- | --- | --- | --- |
| 函数式宏 | `#[proc_macro]` | `fun (input: TokenStream) -> TokenStream` | 表达式、条目、类型、模式：`name!(...)` |
| derive 宏 | `#[proc_macro_derive(Name, attributes(...))]` | `fun (input: TokenStream) -> TokenStream` | `#[derive(Name)]` 结构体或枚举 |
| 属性宏 | `#[proc_macro_attribute]` | `fun (args: TokenStream, item: TokenStream) -> TokenStream` | `#[name(...)]` 条目 |

宏展开发生在普通解析之前：属性宏和 derive 宏先于解析被展开，因此它们的参数
以平衡 token tree 表示，编译器不会预先解析其内部语法。生成代码中的宏会继续
展开，最大深度为 32。

## 创建过程宏包

过程宏包是一个独立的库包，由 `[lib] proc-macro = true` 标记。CLI 目前只能
创建二进制或普通库，先建库再改清单：

```bash
clue new --lib answer-macros
```

然后把 `Clue.toml` 的 `[lib]` 目标改为：

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

过程宏包自动获得 `proc_macro` 模块（提供 `TokenStream`、`TokenTree`、`Span`、
`Diagnostic` 等）以及内置的 `syn` 和 `quote!`，不需要声明任何依赖。宏函数用
Riddle 编写、必须公开，并且签名必须严格匹配上表。包不导出任何宏时 `clue check`
会报错。

宏包本身不会被链接进使用方的程序。Clue 把它编译成宿主平台进程；每个宏包
第一次调用时懒启动一个独立 worker，后续调用复用该进程。单次调用最多 10 秒，
输入和输出各受 16 MiB 上限保护；worker 崩溃或超时会被丢弃，并在下一次调用时
重新启动，不会带崩 Clue。

## 心智模型：token，不是文本

宏看到的不是源码字符串，而是一棵递归的 token tree。四种 `TokenTree`：

- `Ident` — 标识符，如 `getters`；
- `Punct` — 单个标点字符，如 `::`、`->` 由多个 `Punct` 组成；
- `Literal` — 数字、字符串、字符字面量；
- `Group` — 配对的 `()`、`{}`、`[]`，内部递归包含另一个 `TokenStream`。

每个 token 都带有一个 `Span`（源码中的字节范围）。空白和注释不属于 token，
不会逐字保留，所以宏无法感知缩进和注释。

`TokenStream` 可以借用迭代、按值迭代、`push`/`extend`、`len()`/`is_empty()`。
`TokenStream::from_str` 对字符串做词法分析，失败时返回 `LexError`；
`to_string()` 把 token 渲染回源码文本，常用于调试。`clone()` 共享底层 token，
首次修改时才复制。

## 第一个函数式宏

在 `src/lib.rid` 中写一个完全忽略输入、固定输出 `42` 的宏：

```riddle
#[proc_macro]
pub fun answer(_input: TokenStream) -> TokenStream {
    TokenStream::from_str("42").unwrap_or(TokenStream::new())
}
```

参数名前加 `_` 表明宏不读取输入。把它放回参数名 `input` 也可以，Riddle 允许
参数未使用，只是习惯上用 `_` 让意图更明确。

在另一个包中依赖并调用它：

```toml
[dependencies]
answer_macros = { package = "answer-macros", path = "../answer-macros" }
```

```riddle
use answer_macros::answer;

fun main() -> i32 {
    answer!()
}
```

函数式宏可以用在表达式、条目、类型和模式位置，输出必须适合调用位置：
`answer!()` 出现在表达式里，输出就必须是表达式。

## 实战一：derive 宏

derive 宏接收整个结构体或枚举的 token。裸手解析 token 容易出错，应该先用
`syn` 解析成结构化输入。下面实现一个 `Getters` 宏：为结构体的每个命名字段
生成同名的 `&self` 取值方法。

```riddle
use syn::{Data, DeriveInput, Generics, parse};

#[proc_macro_derive(Getters)]
pub fun derive_getters(input: TokenStream) -> TokenStream {
    let parsed = match parse::<DeriveInput>(input) {
        Result::Ok(value) => value,
        Result::Err(error) => {
            error.emit();
            return TokenStream::new();
        },
    };

    // 把结构体按字段拆开，取得字段所有权以便插值进 quote!。
    let DeriveInput {
        attrs: _attrs,
        vis: _vis,
        ident: struct_name,
        generics,
        data,
    } = parsed;

    let Generics {
        tokens: generic_params,
        where_clause,
        params: _params,
        predicates: _predicates,
    } = generics;

    match data {
        Data::Struct(data_struct) => {
            if data_struct.named.is_empty() {
                Diagnostic::error(
                    struct_name.span(),
                    "Getters requires at least one named field",
                ).emit();
                return TokenStream::new();
            }

            let mut getter_fns = Vector::new();
            for field in data_struct.named {
                let field_name = field.ident;
                let field_ty = field.ty;
                getter_fns.push(quote! {
                    pub fun #field_name(&self) -> &#field_ty {
                        &self.#field_name
                    }
                });
            }

            // #generic_params 展开为 <...>，要出现两次：
            // impl<T> 和类型名后的 Foo<T>。
            quote! {
                impl #generic_params #struct_name #generic_params #where_clause {
                    #(#getter_fns)*
                }
            }
        },
        Data::Enum(_) => {
            Diagnostic::error(
                struct_name.span(),
                "Getters can only be derived for structs",
            ).emit();
            TokenStream::new()
        },
    }
}
```

使用方：

```riddle
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

- `parse::<DeriveInput>` 失败时用 `error.emit()` 发出带位置的诊断，然后返回
  空 `TokenStream`，而不是 `panic`。宏内部 panic 只会让宿主进程失败，产生
  一条不友好的错误。
- `Data::Struct` / `Data::Enum` 分派后，`DataStruct.named` 是命名字段向量；
  空字段结构体（`struct Marker {}`）也要考虑。
- `quote!` 中 `#name` 插值实现 `ToTokens` 的值；`#(#getter_fns)*` 把向量展开
  为重复块。同一个重复块中的多个向量按下标配对，长度必须相等。
- 诊断和复制到输出的 token 会保留源位置，因此生成的代码出错时，编译错误会
  映回字段本身，而不是宏调用点。

## 实战二：属性宏

属性宏接收两个参数：属性里的参数 token 和被标记的整个条目。它的输出必须是
顶层条目。下面实现一个 `#[trace_level(3)]`：把参数数值生成一个常量，放在
原条目之前——演示"读参数 + 透传条目"的典型组合：

```riddle
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
    output.extend(TokenStream::from_str(
        "const TRACE_LEVEL: i32 = "
    ).unwrap_or(TokenStream::new()));
    output.extend(args);
    output.extend(TokenStream::from_str(";").unwrap_or(TokenStream::new()));
    output.extend(item);
    output
}
```

使用方：

```riddle
use answer_macros::trace_level;

#[trace_level(3)]
fun main() -> i32 {
    TRACE_LEVEL
}
```

参数 token 会原样插入输出，因此调用 `#[trace_level(3)]` 生成
`const TRACE_LEVEL: i32 = 3;`。属性宏最常见的形态就是"检查参数后原样返回
条目"，例如为 API 路由做校验；完全不改写时直接返回 `item` 即可。注意属性
宏不能改写语句或表达式，只能处理条目。

## helper 属性

`#[proc_macro_derive(Name, attributes(helper))]` 会注册一个 helper 属性，
只允许出现在该 derive 的条目、枚举变体和字段上。未注册的属性在宏调用之前
就会报错。在 `Getters` 上注册 `getter`，允许字段用 `#[getter(skip)]` 跳过：

```riddle
#[proc_macro_derive(Getters, attributes(getter))]
pub fun derive_getters(input: TokenStream) -> TokenStream {
    // ... 解析 DeriveInput 同上 ...
    match data {
        Data::Struct(data_struct) => {
            let mut getter_fns = Vector::new();
            for field in data_struct.named {
                let field_name = field.ident;
                let field_ty = field.ty;

                let mut skip = false;
                for attr in field.attrs {
                    if attr.tokens.to_string().contains("skip") {
                        skip = true;
                    }
                }
                if skip {
                    continue;
                }

                getter_fns.push(quote! {
                    pub fun #field_name(&self) -> &#field_ty {
                        &self.#field_name
                    }
                });
            }
            // ...
        },
        Data::Enum(_) => { /* 同上 */ },
    }
}
```

使用方：

```riddle
use answer_macros::Getters;

#[derive(Getters)]
struct User {
    name: String,
    #[getter(skip)]
    password_hash: String,
}
```

`Attribute.tokens` 保存完整属性 token（含 `#[`），用 `to_string()` 检查内容
是最直接的读法。helper 属性由编译器从输入中保留，普通属性（如 `#[deprecated]`）
会原样出现在 `attrs` 里。

## 诊断与 span

`Diagnostic` 支持四级：

```riddle
Diagnostic::error(span, "message").emit();
Diagnostic::warning(span, "message").emit();
Diagnostic::note(span, "message").emit();
Diagnostic::help(span, "message").emit();
```

span 决定错误指向哪里：

- 使用输入 token 自带的 span（如 `field.ident.span()`），错误指向源码中的
  具体位置；
- 使用 `Span::call_site()` 创建的新 token 和诊断指向整个宏调用；
- `Span::mixed_site()` 目前等价于 `call_site()`；
- 多个 span 可用 `span.join(other)` 合并成覆盖两者的区间。

诊断消息返回为 `syn::Error` 时同样可用 `error.emit()`，见 `syn` 章节的
`Parse` 实现。

## 在项目中使用宏

derive 宏使用独立的宏命名空间，必须 `use` 导入才能按名字使用；不导入时仍可
用限定路径 `#[derive(answer_macros::Getters)]`。支持分组、别名、glob 和
模块内 `pub use` 重导出：

```riddle
use answer_macros::{Getters, answer as value, trace_level};

#[trace_level(3)]
#[derive(Getters)]
struct User {
    name: String,
}

fun main() -> i32 { value!() }
```

宏名可以与类型、trait 或值同名而不冲突；混合 `use` 会保留同一条 `use` 中的
普通名称。derive 只能放在结构体和枚举上（Riddle 当前没有 union）。

## 调试与常见问题

- 用 `input.to_string()` 或 `println!("{}", tree.to_string())` 观察宏收到的
  token，是最直接的调试手段。
- `syn` 解析失败：`error.emit()` 会显示期望的语法，对照 `DeriveInput` 的
  结构检查输入是否合法。
- "must contain only top-level items"：derive 或属性宏输出了非顶层条目。
- "derive helper attributes must be declared"：字段上使用了未注册的 helper
  属性，检查 `attributes(...)` 列表。
- "cannot find derive macro `X`"：没有导入宏或包没有导出该宏，检查 `use`。
- 空输出：宏返回了 `TokenStream::new()`，通常是因为诊断已经发出——先看
  诊断再看代码。

## 边界

- 没有 union 条目；`DeriveInput` 只接受结构体和枚举。
- `quote!` 重复使用 `*`，分隔符为单个 token。
- `ParseStream` 是最小 token 游标，不包含 Rust `syn` 的全部解析宏。
- 过程宏包可以依赖另一个过程宏包（本地 path 依赖），`clue check` 也能直接
  检查宏包自身。

完整的 `syn` 与 `quote!` API 参考见[内置 `syn` 与 `quote!`](./syn.md)，
宏包清单、导入与展开机制见 [Clue 构建器的过程宏章节](./clue.md#过程宏)。
