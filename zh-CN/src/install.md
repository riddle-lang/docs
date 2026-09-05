# 安装 Riddle 工具链

最省事的方式是下载预编译发布包，它不要求本机先安装 Rust。只有从源码安装 Riddle 时才需要仓库固定的 Rust 1.97.1；可以参考[Rust 圣经的安装章节](https://course.rs/first-try/installation.html)或 Rust 官方的 [rustup](https://rustup.rs/) 页面。

## 下载预编译版本

[GitHub Releases](https://github.com/riddle-lang/riddle/releases) 提供 Windows、Linux 和 macOS 的预编译 zip。下载对应平台和架构的文件，解压后把二进制所在目录加入 `PATH`。发布包包含 `clue`、`riddle-lsp`、`riddlec`、`riddle`、README 和 Apache-2.0 许可证。

## 使用 ridup 管理工具链

[`ridup`](https://github.com/riddle-lang/ridup) 负责安装、选择并代理 Riddle 工具链。尚未安装 ridup 时，可以从源码安装：

```bash
cargo install --git https://github.com/riddle-lang/ridup --locked
```

ridup 提供三个发布通道：`stable` 下载最新正式 Release，`nightly` 下载每日构建，`canary` 下载 `main` 最新源码并在本机执行 release 构建。安装并选择通道：

```bash
ridup toolchain install stable
ridup toolchain install nightly
ridup toolchain install canary
ridup default stable
ridup show
ridup toolchain list
```

重复执行 `toolchain install` 会更新相应通道。stable 和 nightly 会选择当前宿主的发布归档并校验 SHA-256；canary 需要本机已有 Rust 和 Cargo，不需要 Git。宿主工具链实际按完整 triple 安装，例如 `stable-x86_64-pc-windows-msvc`，`stable`、`nightly` 和 `canary` 是指向当前宿主版本的便捷名称。

本地构建或已解压工具链可以直接链接：

```powershell
ridup toolchain link dev D:\Code\riddle\target\debug
ridup default dev
ridup run dev clue --version
```

项目可用 `riddle-toolchain.toml` 固定工具链：

```toml
[toolchain]
channel = "canary"
```

选择优先级依次是代理参数（例如 `clue +dev build`）、`RIDUP_TOOLCHAIN`、最近目录的 `ridup override set <toolchain>`、最近的 `riddle-toolchain.toml`、默认工具链。以 `clue`、`riddlec`、`riddle` 或 `riddle-lsp` 名称安装的 ridup 可执行文件会作为代理，运行所选工具链中的同名组件。

交叉目标独立于宿主工具链安装：

```bash
ridup target add aarch64-unknown-linux-gnu
ridup target list
```

首版只支持 `x86_64-unknown-linux-gnu`、`aarch64-unknown-linux-gnu`、`i686-unknown-linux-gnu`、`x86_64-pc-windows-msvc`、`i686-pc-windows-msvc`、`aarch64-pc-windows-msvc` 和 `aarch64-apple-darwin`，其他 triple 会被拒绝。

### 如何选择 Release 资产

Release 中有两种 zip，名称里的 `target-` 表示交叉编译目标，不表示当前宿主平台：

| 文件名模式 | 用途 | 内容 |
| --- | --- | --- |
| `riddle-v<version>-<platform>-<arch>.zip` | 安装当前机器上的 Riddle 工具链 | `clue`、`riddle-lsp`、`riddlec`、`riddle` 等可执行文件 |
| `riddle-v<version>-target-<triple>.zip` | 为指定目标进行交叉构建 | `runtime.c`、`target.toml` 和许可证；不包含 `clue`、`riddle`、`riddlec` 或 `riddle-lsp` |

例如，在 Windows x86_64 上使用 `riddle-v0.2.3-windows-x86_64.zip` 安装工具；要构建 `aarch64-unknown-linux-gnu` 程序，则运行 `ridup target add aarch64-unknown-linux-gnu` 安装对应目标组件。目标组件不会替代 Linux sysroot、Windows SDK/MSVC 库或 Apple SDK，也不需要单独加入 `PATH`。

`target add` 会先安装 Riddle runtime，再询问是否安装匹配的 LLVM/Clang。目标组件已安装和 C 工具链已就绪是两个独立状态；Linux 还需要目标 sysroot，Windows MSVC 目标需要 Windows SDK 与 MSVC 库，macOS 需要 Apple SDK。缺少这些系统组件时仍可运行 `clue check`，也可用 `riddlec` 生成可移植 C，但 Clue 不会把该目标报告为可链接状态。

所有目标命令都可用 `--toolchain <name>` 指定工具链。C 工具链可以自动探测或单独配置：

```powershell
ridup c-toolchain install aarch64-unknown-linux-gnu
ridup target configure aarch64-unknown-linux-gnu --compiler C:\LLVM\bin\clang.exe --sysroot D:\sysroots\aarch64-linux-gnu
ridup target remove aarch64-unknown-linux-gnu
```

## 从源码构建

找一个适合存放代码的目录，执行下述命令：

```bash
git clone https://github.com/riddle-lang/riddle --depth=1
cd riddle
cargo install --path . --features install-bins --force --target-dir "${TMPDIR:-/tmp}/riddle-install"
```

这会一次安装 `clue`、`riddle-lsp`、`riddlec` 和 `riddle`。在 PowerShell 中也可以写成：

```powershell
cargo install --path . --features install-bins --force --target-dir "$env:TEMP\riddle-install"
```

如果只验证这四个安装二进制的构建，请限定根发行包，避免 workspace 中的同名开发包重复输出：

```bash
cargo build -p riddle --release --features install-bins --bins
```

如果只想在源码目录中临时运行，也可以使用：

```bash
cargo run -p riddle -- fmt --help
cargo run -p riddlec -- --help
```

安装后可用以下命令确认版本：

```bash
riddlec --version
clue --version
riddle --version
riddle-lsp --version
```

## 验证源码树

提交源码变更前，运行完整 workspace 测试、安装入口检查、格式检查和严格 Clippy：

```bash
cargo test --workspace --all-targets
cargo check -p riddle --features install-bins --bins
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

根包的 `install-bins` feature 负责发布 `clue`、`riddle-lsp`、`riddlec` 和 `riddle`。不要把 `--all-features` 加到 workspace 测试命令中，否则根发行包与成员 crate 的同名二进制会触发 Cargo 输出文件碰撞警告；独立的 `cargo check` 已覆盖这些安装入口。

该命令检查 Clippy 默认启用的全部规则，并把告警视为错误。`pedantic`、`nursery` 和 `cargo` 是独立的实验性或额外风格类别，不属于仓库的合并门槛。

需要实时诊断和语义高亮时，继续阅读[编辑器与 LSP](./editor-support.md)。

当前命令行入口是 `riddlec`：

```bash
riddlec [--verbose] [--no-std] [--backend c] [--target <triple>] [--output <file>] <file>...
```

例如，创建一个项目，再把入口文件通过 C backend 生成 C 源码：

```bash
clue new hello
cargo run -p riddlec -- --backend c --output hello.c hello/src/main.rid
```

C backend 只写出调用 `rgc` ABI 的 C 源码，不会调用系统编译器。二进制发行包附带默认 `runtime.c` 与 `args_runtime.c`；如需本机可执行文件，可以运行 `cc hello.c runtime.c args_runtime.c -o hello`。`clue build` 会自动完成这一步。

## 构建文档

本文档使用 `mdBook` 编写。如果你想在本地预览文档，可以安装 mdBook：

```bash
cargo install mdbook
```

然后在中文文档目录下构建或预览：

```bash
cd docs/zh-CN
mdbook build
mdbook serve --open
```

构建结果会输出到仓库中的 `dist/zh-CN` 目录。

## 常见问题

### `cargo build` 失败怎么办？

请先确认 Rust 版本足够新。当前项目使用 Rust 2024 edition，并通过根目录的 `rust-toolchain.toml` 固定 Rust `1.97.1`：

```bash
rustup toolchain install 1.97.1
```

### 如何运行 C backend 的输出？

`riddlec --backend c` 只生成 `.c` 文件。请使用系统中的 `cc`、`gcc` 或 `clang`，把生成文件与发行包附带的 `runtime.c` 和 `args_runtime.c` 一起编译；默认运行时不依赖 Boehm GC，因此不需要 `-lgc`。`clue build` 会自动完成这一步。

### 示例文件在哪里？

仓库不单独维护 `examples/` 目录。可以使用 `clue new` 创建最小项目；其他语言能力以本书中的可运行代码片段和测试为准。

不过示例可能会跟随语言设计快速变化。学习 Riddle 的主要概念时，请按目录继续阅读“通用编程概念”“所有权与内存”和“结构体与枚举”。
