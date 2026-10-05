# 关于本书

这本书讲的是如何用 Riddle 写程序。它假设你已经会至少一门编程语言——知道什么叫类型、函数、循环和作用域——但不假设你会 Rust 或 Kotlin。

书分三层：

- 第一部分到第七部分是教程，按依赖顺序推进：先跑通一个项目，再学语言基础，然后是所有权、数据建模、错误处理、抽象机制和集合；
- 第八部分讲工程与工具：构建、宏、编辑器、FFI；
- 附录是查阅资料：当前能力边界、形式化语法和错误码。

Riddle 还是技术预览，语法和 ABI 都可能不兼容地变化。这本书只写仓库里已经实现、并能由源码、测试或命令行行为验证的东西；路线图上的功能不会写成现状。如果书里的描述和编译器的实际行为不一致，以实现为准，也欢迎直接提 issue 或 PR 修文档。

[Riddle 的设计取向](./into-riddle.md)解释这门语言想解决什么问题；[从 Rust 或 Kotlin 过来](./riddle-vs-rust-kotlin.md)给出相似写法之间的语义差异速查。

本书的教学顺序参考了 [The Rust Programming Language](https://doc.rust-lang.org/stable/book/)、[Rust 语言圣经](https://course.rs/) 和 [Kotlin 官方文档中文版](https://book.kotlincn.net/) 的组织方式，但没有照搬它们的语言特性。
