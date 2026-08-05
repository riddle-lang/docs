# 安装 Riddle 工具链

最省事的方式是下载预编译发布包，它不要求本机先安装 Rust。只有从源码安装 Riddle 时才需要较新的 Rust stable；可以参考[Rust 圣经的安装章节](https://course.rs/first-try/installation.html)或 Rust 官方的 [rustup](https://rustup.rs/) 页面。

## 下载预编译版本

[GitHub Releases](https://github.com/riddle-lang/riddle/releases) 提供 Windows、Linux 和 macOS 的预编译 zip。下载对应平台和架构的文件，解压后把二进制所在目录加入 `PATH`。发布包包含 `clue`、`riddle-lsp`、`riddlec`、README 和 Apache-2.0 许可证。

使用 ridup 时，宿主工具链按完整 triple 安装，例如 `stable-x86_64-pc-windows-msvc`，并保留 `stable` 作为便捷名称。交叉目标单独安装：

```bash
ridup target add aarch64-unknown-linux-gnu
ridup target list
```

首版只支持 `x86_64-unknown-linux-gnu`、`aarch64-unknown-linux-gnu`、`i686-unknown-linux-gnu`、`x86_64-pc-windows-msvc`、`i686-pc-windows-msvc`、`aarch64-pc-windows-msvc` 和 `aarch64-apple-darwin`，其他 triple 会被拒绝。

`target add` 会先安装 Riddle runtime，再询问是否安装匹配的 LLVM/Clang。目标组件已安装和 C 工具链已就绪是两个独立状态；Linux 还需要目标 sysroot，Windows MSVC 目标需要 Windows SDK 与 MSVC 库，macOS 需要 Apple SDK。缺少这些系统组件时仍可运行 `clue check`，也可用 `riddlec` 生成可移植 C，但 Clue 不会把该目标报告为可链接状态。

## 从源码构建

找一个适合存放代码的目录，执行下述命令：

```bash
git clone https://github.com/riddle-lang/riddle --depth=1
cd riddle
cargo install --path . --features install-bins --force --target-dir "${TMPDIR:-/tmp}/riddle-install"
```

这会一次安装 `clue`、`riddle-lsp` 和 `riddlec`。在 PowerShell 中也可以写成：

```powershell
cargo install --path . --features install-bins --force --target-dir "$env:TEMP\riddle-install"
```

如果只验证这三个安装二进制的构建，请限定根发行包，避免 workspace 中的同名开发包重复输出：

```bash
cargo build -p riddle --release --features install-bins --bins
```

如果只想在源码目录中临时运行，也可以使用：

```bash
cargo run -p riddlec -- --help
```

安装后可用以下命令确认版本：

```bash
riddlec --version
clue --version
riddle-lsp --version
```

## 验证源码树

提交源码变更前，运行完整 workspace 测试、安装入口检查、格式检查和最高等级 Clippy：

```bash
cargo test --workspace --all-targets
cargo check -p riddle --features install-bins --bins
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features --keep-going -- -D warnings -D clippy::pedantic -D clippy::nursery -D clippy::cargo -A clippy::multiple_crate_versions
```

根包的 `install-bins` feature 只负责发布 `clue`、`riddle-lsp` 和 `riddlec`。不要把 `--all-features` 加到 workspace 测试命令中，否则根发行包与成员 crate 的同名二进制会触发 Cargo 输出文件碰撞警告；独立的 `cargo check` 已覆盖这些安装入口。

Clippy 唯一排除的规则是 `multiple_crate_versions`。当前 Cargo 依赖元数据同时包含 `hashbrown 0.14/0.17` 和 `syn 2/3`；该例外不屏蔽源码 lint，也不能用新增 `#[allow(clippy::...)]` 代替修复。升级依赖后先用 `cargo tree -d` 审计活动依赖，再移除 `-A clippy::multiple_crate_versions` 重跑 Clippy；无告警时即可删除这个例外。

需要实时诊断和语义高亮时，继续阅读[编辑器与 LSP](./editor-support.md)。

当前命令行入口是 `riddlec`：

```bash
riddlec [--verbose] [--backend c] [--target <triple>] [--output <file>] <file>...
```

例如，创建一个项目，再把入口文件通过 C backend 生成 C 源码：

```bash
clue new hello
cargo run -p riddlec -- --backend c --output hello.c hello/src/main.rid
```

C backend 只写出调用 `rgc` ABI 的 C 源码，不会调用系统编译器。二进制发行包附带默认 `runtime.c`；如需本机可执行文件，可以运行 `cc hello.c runtime.c -o hello`。`clue build` 会自动完成这一步。

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

请先确认 Rust 版本足够新。当前项目使用 Rust 2024 edition，因此建议保持 stable 工具链为较新版本：

```bash
rustup update stable
```

### 如何运行 C backend 的输出？

`riddlec --backend c` 只生成 `.c` 文件。请使用系统中的 `cc`、`gcc` 或 `clang`，把生成文件与发行包附带的 `runtime.c` 一起编译；默认运行时不依赖 Boehm GC，因此不需要 `-lgc`。`clue build` 会自动完成这一步。

### 示例文件在哪里？

仓库不单独维护 `examples/` 目录。可以使用 `clue new` 创建最小项目；其他语言能力以本书中的可运行代码片段和测试为准。

不过示例可能会跟随语言设计快速变化。学习 Riddle 的主要概念时，请按目录继续阅读“Riddle 基础”“所有权与内存”和“数据建模与抽象”。
