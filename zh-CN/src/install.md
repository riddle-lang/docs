# 安装 Riddle 环境

因为 Riddle 是使用 Rust 编写的，所以在编译之前请先安装 Rust。
如果你还没有安装，可以参考 [Rust 圣经的安装章节](https://course.rs/first-try/installation.html) 或 Rust 官方的 [rustup](https://rustup.rs/) 页面。

安装完成后，请先确认 `cargo` 可用：

```bash
cargo --version
```

如果命令能输出版本号，就可以继续构建 Riddle。

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

`riddlec --backend c` 只生成 `.c` 文件。请使用系统中的 `cc`、`gcc` 或 `clang` 编译该文件；生成代码自带 GC，不需要 `-lgc`。

### 示例文件在哪里？

仓库不单独维护 `examples/` 目录。可以使用 `clue new` 创建最小项目；其他语言能力以本书中的可运行代码片段和测试为准。

不过示例可能会跟随语言设计快速变化。学习 Riddle 的主要概念时，请优先阅读本书后续的“Riddle 基础”“数据与抽象”和“所有权与内存”。
