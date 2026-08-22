# 泛型、Trait 与模块

掌握数据形状和错误处理之后，就可以用 Riddle 的类型与模块机制组织较大的程序。本部分按“先统一类型，再定义行为，最后划分边界”的顺序展开：

1. 泛型让同一份逻辑适用于多种类型；
2. trait 声明共享能力，`impl` 为具体类型提供行为；
3. 模块、可见性、`use` 和包依赖划分名字与 API 边界。

Riddle 当前没有 Kotlin 式类继承。共享行为可以通过静态 trait bound，也可以通过对象安全的借用 trait object（`&dyn Trait` / `&mut dyn Trait`）传递；拥有所有权的动态 trait object 仍未实现。
