# Clue 构建器

`clue` 是 Riddle 当前的项目构建器。它提供四个命令：

```bash
clue init [--bin|--lib] <path>
clue new [--bin|--lib] <path>
clue check [path]
clue build [path]
```

`clue init` 在指定目录中初始化项目，`clue new` 创建新目录和项目；二者都会生成清单、入口源码和忽略文件。它们不会覆盖已有的 `Clue.toml` 或目标入口源码。`clue check` 检查整个项目但不生成 C，`clue build` 检查项目后生成 C 源码。

Clue 适合把多文件 Riddle 程序放进一个项目目录里构建。它不会替代 `riddlec` 的所有参数：当前输出固定为 `.clue/build/<package-name>.c`，也不会继续调用 C 编译器生成本机可执行文件。

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

模块、`use`、`pub use` 和可见性规则见 [模块、use 与枚举](./modules-and-enums.md)。

## 项目诊断

```bash
clue check
```

Clue 会展开入口文件声明的外部模块和所有本地 path 依赖，再运行完整的编译检查。错误位置会映射回实际的 `.rid` 文件，而不是统一显示为项目入口文件。

`riddle-lsp` 使用相同的项目加载规则。打开 Clue 项目中的文件时，诊断会包含模块和本地依赖，并优先使用编辑器中尚未保存的内容；任一文件变化后，所有已打开文档的诊断都会刷新。

## 构建缓存

Clue 会缓存构建指纹。`Clue.toml`、展开后的源码或当前编译器版本发生变化时会重新生成 C 源码；没有变化时会输出 `fresh`。

## 作为 Rust 库使用

`clue` crate 公开项目创建、检查、构建和项目分析 API。

```rust
use clue::{ProjectKind, build, check, new};
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new("hello");
    new(root, ProjectKind::Binary)?;
    check(root)?;
    build(root)?;
    Ok(())
}
```

`ProjectKind::Library` 用于库项目。需要初始化已有目录时使用 `init`，其覆盖保护与命令行版本相同。

## 当前限制

- 只支持 Cargo 风格的本地 path 依赖，不支持 registry、版本解析、git 依赖或 lockfile；
- 输出固定为 C 源码文件；
- 运行生成的 C 程序仍需使用系统 C 编译器，或直接使用 `riddlec --backend c`。
