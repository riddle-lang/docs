# 开始使用 Riddle

因为 Riddle 还没有稳定到可以固定周期发布版本，所以从源码构建仍然是当前最可靠的体验方式。
这一章会带你准备环境，并写下第一段 Riddle 代码。

在本章中，你将学习以下内容：

- 在 macOS、Linux、BSD 及 Windows 上准备 Rust 工具链；
- 从源码构建 Riddle；
- 编写并读懂一个最小的 Riddle 程序；
- 知道接下来应该从哪些概念继续学习。

## 一段 Riddle 代码

先看一段完整一些的 Riddle 代码：

```riddle
struct Foo {
    x: i32,
    y: i32,
}

trait Bar {
    fun bar(value: i32) -> i32;
}

impl Bar for Foo {
    fun bar(value: i32) -> i32 {
        value
    }
}

impl Foo {
    fun help(&self) -> &str {
        "HELP"
    }
}
```

这段代码展示了 Riddle 中几个重要概念：

- `struct Foo` 定义数据的形状；
- `trait Bar` 定义一组能力；
- `impl Bar for Foo` 为 `Foo` 实现 trait；
- `impl Foo` 为 `Foo` 添加自己的方法；
- `fun help(&self) -> &str` 定义带接收者和返回类型的方法。

Riddle 的设计会尽量让这些概念保持直观。你可以先把它理解成一门偏工程化的语言：代码由数据、函数、trait 和 impl 组织起来，值的传递遵循移动语义，引用是否逃逸会决定对象放在栈上还是提升到运行时管理的堆区域。

## 学习路线

建议按下面的顺序阅读：

- 先完成“安装 Riddle 环境”；
- 读“你好，Riddle”，理解一个小程序由哪些部分组成；
- 进入“Riddle 基础”，学习变量、函数、表达式和控制流；
- 进入“数据与抽象”，学习结构体、trait 和 impl；
- 最后阅读“所有权与内存”，理解 Riddle 为什么选择移动、引用和自动 GC 提升。

这些章节不会把 Riddle 当成一组语法规则来背诵，而是会像一本使用教程一样，从代码出发解释每个语言部分解决什么问题。
