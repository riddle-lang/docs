# Clue 构建器

`clue` 是 Riddle 当前的项目构建器。它提供五个命令：

```bash
clue init [--bin|--lib] <path>
clue new [--bin|--lib] <path>
clue check [path]
clue build [path]
clue run [path] [-- <args>...]
```

`clue init` 在指定目录中初始化项目，`clue new` 创建新目录和项目；二者都会生成清单、入口源码和忽略文件。它们不会覆盖已有的 `Clue.toml` 或目标入口源码。`clue check` 检查整个项目但不生成 C，`clue build` 构建项目，`clue run` 先构建二进制项目再运行生成的程序。

二进制项目会保留 `.clue/build/<package-name>.c`，并在同一目录生成 `<package-name>`；Windows 下扩展名为 `.exe`。Clue 优先使用 `CC` 指定的编译器，否则依次探测 `cc`、`gcc`、`clang`，Windows 还会探测 `clang-cl` 和 `cl`。库项目仍只生成 C 源码，不会链接可执行文件。

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

Clue 会缓存构建指纹。`Clue.toml`、展开后的源码、当前 Riddle 编译器版本、目标平台或 C 编译器选择发生变化时会重新构建；没有变化且输出文件仍存在时会输出 `fresh`。

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
