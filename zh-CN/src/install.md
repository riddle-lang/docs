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
target/debug/riddle
```

你也可以直接运行：

```bash
cargo run
```

当前 `main.rs` 更像是一个编译器前端演示程序：它会解析内置的 Riddle 源码片段，构建语法树并降级到 HIR，然后打印函数体信息。
因此，此阶段还不能把它当成稳定的 `riddlec input.rid` 命令行编译器使用。

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

### 为什么没有 `riddlec` 命令？

当前仓库的包名是 `riddle`，生成的可执行文件也叫 `riddle`。
独立的 `riddlec` 命令行接口还没有在当前代码中稳定下来。

### 示例文件在哪里？

仓库中有一个示例文件：

```text
riddle/examples/example.rid
```

不过示例可能会跟随语言设计快速变化。学习 Riddle 的主要概念时，请优先阅读本书后续的“Riddle 基础”“数据与抽象”和“所有权与内存”。
