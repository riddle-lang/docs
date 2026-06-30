# 安装 Riddle 环境

因为 Riddle 是使用 Rust 编写的，所以在编译之前请先安装 Rust。
如果你还没有安装，可以参考 [Rust 圣经的安装章节](https://course.rs/first-try/installation.html) 或 Rust 官方的 [rustup](https://rustup.rs/) 页面。

安装完成后，请先确认 `cargo` 可用：

```bash
cargo --version
```

如果命令能输出版本号，就可以继续构建 Riddle。

## 从源码构建

找一个适合存放代码的目录，执行下述命令：

```bash
git clone https://github.com/riddle-lang/riddle --depth=1
cd riddle
cargo build
```

构建完成后，调试版可执行文件通常会出现在：

```text
target/debug/riddlec
```

你也可以直接运行：

```bash
cargo run -p riddlec -- --help
```

当前命令行入口是 `riddlec`：

```bash
riddlec [--verbose] [--backend c] [--output <file>] <file>...
```

例如，把 `examples/index.rid` 通过 C backend 编译为本机可执行文件：

```bash
cargo run -p riddlec -- --backend c examples/index.rid
```

C backend 会生成 C 代码，并调用系统中的 `cc`、`gcc` 或 `clang`。因此本机需要可用的 C 编译器和 Boehm GC（链接参数为 `-lgc`）。如果 `--output` 指向 `.c` 或 `.h` 文件，`riddlec` 只写出 C 源码，不继续编译。

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

### 为什么 `--backend c` 找不到 C 编译器？

请确认系统上可以直接运行 `cc --version`、`gcc --version` 或 `clang --version` 中的至少一个命令。C backend 还需要 Boehm GC；如果链接阶段提示找不到 `-lgc`，需要先安装对应开发包。

### 示例文件在哪里？

仓库中的示例文件放在：

```text
riddle/examples/
```

不过示例可能会跟随语言设计快速变化。学习 Riddle 的主要概念时，请优先阅读本书后续的“Riddle 基础”“数据与抽象”和“所有权与内存”。
