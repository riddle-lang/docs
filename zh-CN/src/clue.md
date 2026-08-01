# Clue 构建器

`clue` 是 Riddle 当前的项目构建器。它提供五个命令：

```bash
clue init [--bin|--lib] <path>
clue new [--bin|--lib] <path>
clue check [path] [--target <triple>]
clue build [path] [--target <triple>]
clue run [path] [--target <triple>] [-- <args>...]
```

`clue init` 在指定目录中初始化项目，`clue new` 创建新目录和项目；二者都会生成清单、入口源码和忽略文件。它们不会覆盖已有的 `Clue.toml` 或目标入口源码。`clue check` 检查整个项目但不生成 C，`clue build` 构建项目，`clue run` 先构建二进制项目再运行生成的程序。

二进制项目会保留 `.clue/build/<package-name>.c` 和默认的 `<package-name>.runtime.c`，并在同一目录生成 `<package-name>`；Windows 下扩展名为 `.exe`。设置 `CC` 时 Clue 会严格使用它，失败时不会静默回退；未设置时会探测 `cc`、`gcc`、`clang`、带版本后缀的 GCC/Clang，Windows 还会探测 `clang-cl` 和 `cl`。候选必须能够完成一次 C11 编译和链接。库项目仍只生成 C 源码，不会选择或链接运行时。

## 目标平台

Clue 按 `--target`、`RIDDLE_TARGET`、`Clue.toml` 的 `[build].target`、宿主平台的顺序选择目标：

```toml
[build]
target = "aarch64-unknown-linux-gnu"
```

当前严格限制为以下 7 个目标：

- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`
- `i686-unknown-linux-gnu`
- `x86_64-pc-windows-msvc`
- `i686-pc-windows-msvc`
- `aarch64-pc-windows-msvc`
- `aarch64-apple-darwin`

交叉构建二进制项目之前需要运行 `ridup target add <triple>`。目标组件提供 Riddle runtime，但不等于 C 工具链已经就绪：Linux 需要 sysroot，Windows MSVC 目标需要 Windows SDK 与 MSVC 库，macOS 需要 Apple SDK。`clue run` 只允许运行宿主目标；交叉产物应复制到目标系统运行。

## 项目布局

推荐布局：

```text
hello/
  .gitignore
  Clue.toml
  src/
    main.rid
```

二进制项目的清单包含一个 `[[bin]]` 目标：

```toml
[package]
name = "hello"
version = "0.1.0"

[[bin]]
name = "hello"
path = "src/main.rid"

[dependencies]
```

库项目使用 `[lib]` 和 `src/lib.rid`。如果清单没有显式目标，`clue build` 会按顺序寻找入口：

1. `src/main.rid`
2. `src/lib.rid`
3. `<package-name>.rid`
4. `main.rid`

旧项目仍可以在 `[package]` 中使用 `entry` 指定入口：

```toml
[package]
name = "hello"
entry = "src/bin/hello.rid"
version = "0.1.0"
```

## 运行时与分配器

二进制项目默认链接 Riddle 自带的保守式非移动 GC。要替换为自定义 GC、arena 或其他分配器，在项目根目录的 `Clue.toml` 中指定一个 C 源文件：

```toml
[runtime]
source = "runtime/custom_gc.c"
```

路径相对项目根目录解析。运行时源码必须实现以下 ABI：

```c
void rgc_init(void *stack_bottom);
void *rgc_alloc(size_t size);
void *rgc_realloc(void *ptr, size_t size);
void rgc_free(void *ptr);
void rgc_collect(void);
```

`rgc_alloc` 返回的地址必须满足普通 C 对象的对齐要求，并且在引用仍可能存在时不能移动。`rgc_realloc` 与 `rgc_free` 供标准库容器（如 `Vector`）显式管理缓冲区：`rgc_realloc` 迁移并保留原内容，`rgc_free` 立即释放且必须接受空指针；基于 malloc 的分配器可直接委托给 `realloc`/`free`。无回收分配器可以忽略 `stack_bottom`，并把 `rgc_collect` 实现为空函数。当前 ABI 不支持移动式 GC、finalizer 或多线程栈注册。

运行时属于最终进程，因此 `[runtime]` 只允许出现在二进制包；库和依赖包只生成 ABI 调用，不能选择运行时。

## 本地依赖

`[dependencies]` 目前支持本地 path 依赖：

```toml
[dependencies]
math = { path = "../math" }
```

也支持 Cargo 风格的重命名。依赖键会成为当前包里的模块名，`package` 指向依赖包自己的 `[package].name`：

```toml
[dependencies]
math = { package = "math-core", path = "../math-core" }
```

源码中按模块路径使用依赖键：

```riddle
fun main() -> i32 {
    math::one()
}
```

依赖包也使用自己的 `Clue.toml` 和入口文件。依赖键必须是合法模块名，也就是字母或 `_` 开头，后面跟字母、数字或 `_`。

作为依赖加载时，Clue 会优先使用 `[lib].path`；没有 `[lib]` 目标时，再依次寻找 `src/lib.rid`、`<package-name>.rid`、`lib.rid` 和 `src/main.rid`。依赖包需要用 `pub` 导出给调用方使用的函数、类型、模块或 `use` 重新导出。

## 过程宏

过程宏包使用 `[lib] proc-macro = true`：

```toml
[package]
name = "answer-macros"

[lib]
path = "src/lib.rid"
proc-macro = true
```

宏函数由 Riddle 编写并且必须公开。derive 宏和函数式宏使用
`TokenStream -> TokenStream` 签名，属性宏接收属性参数与被标记条目两个 `TokenStream`：

```riddle
#[proc_macro_derive(Answer, attributes(answer))]
pub fun derive_answer(input: TokenStream) -> TokenStream {
    TokenStream::from_str("fun generated_answer() -> i32 { 42 }")
        .unwrap_or(TokenStream::new())
}

#[proc_macro]
pub fun answer(input: TokenStream) -> TokenStream {
    TokenStream::from_str("42").unwrap_or(TokenStream::new())
}

#[proc_macro_attribute]
pub fun replace(args: TokenStream, item: TokenStream) -> TokenStream {
    item
}
```

`TokenStream` 由 `TokenTree` 序列组成，而不是保存原始源码字符串。`TokenTree` 分为
`Group`、`Ident`、`Punct` 和 `Literal`；分组递归包含另一个 `TokenStream`，每个 token
都带有输入中的字节范围。宏可以借用或取得 token 的所有权进行迭代：

```riddle
for tree in &input {
    match tree {
        TokenTree::Ident(ident) => println!("{}", ident.as_str()),
        TokenTree::Group(group) => {
            for nested in group.stream() {
                let span = nested.span();
            }
        },
        _ => {},
    }
}
```

`TokenStream::from_str` 会执行词法分析，失败时返回 `LexError`，并把新 token 的位置设为当前宏调用点；`to_string()` 则提供源码文本视图。空白和注释不属于 token，因此不会逐字保留。`TokenStream::clone()` 共享底层 token，首次修改时才复制。Clue 与宏宿主之间传递结构化 token tree，编译器也直接把输出 token 送回解析器，不会把整个展开结果重新做一次词法分析。

使用方把宏包声明为本地 path 依赖，再把 derive 宏导入独立的宏命名空间：

```toml
[dependencies]
answer_macros = { package = "answer-macros", path = "../answer-macros" }
```

```riddle
use answer_macros::{Answer, answer, replace};

#[answer]
#[derive(Answer)]
struct Value {}

#[replace]
fun old_value() -> i32 { 0 }

fun main() -> i32 { answer!() }
```

宏导入支持 `use answer_macros::{Answer as GenerateAnswer};` 和
`use answer_macros::*;`。宏名可以与类型、trait 或值同名而不冲突；不导入时仍可使用
`#[derive(answer_macros::Answer)]` 限定写法。derive 只能用于结构体和枚举；Riddle 当前没有
union 条目。`pub use` 可以在模块中重导出过程宏，混合导入会保留同一条 `use` 中的普通名称。
函数式宏可用于表达式、条目、类型和模式位置。`attributes(answer)` 注册的 helper 属性只在
对应 derive 的输入条目、枚举变体和字段上有效，未注册的 helper 属性会在调用宏之前报错。

Clue 会把过程宏包编译为宿主平台进程，而不会把它拼入目标程序。一次分析中的调用复用同一个进程；derive 和属性宏输出必须是顶层条目，函数式宏输出必须适合调用位置。宏诊断会使用传入的 `Span`，复制到输出的 token 也会把后续编译错误映回原位置；使用 `Span::call_site()` 创建的 token 和诊断则指向宏调用。生成代码中的宏会继续展开，最大深度为 32。过程宏包可以通过本地 path 依赖使用另一个过程宏包，`clue check` 也能直接检查过程宏包自身。LSP 会识别宏导入和调用，并提供分类高亮、悬停、定义跳转、引用、别名重命名和按宏种类过滤的补全。

模块、`use`、`pub use` 和可见性规则见 [模块、use 与枚举](./modules-and-enums.md)。

## 项目诊断

```bash
clue check
```

Clue 会展开入口文件声明的外部模块和所有本地 path 依赖，再运行完整的编译检查。错误位置会映射回实际的 `.rid` 文件，而不是统一显示为项目入口文件。

`riddle-lsp` 使用相同的项目加载规则。打开 Clue 项目中的文件时，诊断会包含模块和本地依赖，并优先使用编辑器中尚未保存的内容；任一文件变化后，所有已打开文档的诊断都会刷新。

## 构建缓存

Clue 会缓存构建指纹。`Clue.toml`、展开后的源码、运行时源码、当前 Riddle 编译器版本、目标平台，或者 C 编译器的实际路径与版本发生变化时会重新构建；没有变化且输出文件仍存在时会输出 `fresh`。成功的 C11 兼容性探测也按编译器身份缓存。

## 运行项目

```bash
clue run
clue run path/to/project -- arg1 arg2
```

`run` 只接受二进制项目，并把 `--` 后的参数原样传给程序。程序退出码会成为 `clue run` 的退出码。

## 作为 Rust 库使用

`clue` crate 公开项目创建、检查、构建和项目分析 API。

```rust
use clue::{ProjectKind, build, check, new, run};
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new("hello");
    new(root, ProjectKind::Binary)?;
    check(root)?;
    build(root)?;
    run(root, &[])?;
    Ok(())
}
```

`ProjectKind::Library` 用于库项目。需要初始化已有目录时使用 `init`，其覆盖保护与命令行版本相同。

## 当前限制

- 只支持 Cargo 风格的本地 path 依赖，不支持 registry、版本解析、git 依赖或 lockfile；
- 库目标当前只输出 C 源码，不生成静态库或动态库；
- 二进制构建和运行需要系统中存在受支持的 C 编译器。
