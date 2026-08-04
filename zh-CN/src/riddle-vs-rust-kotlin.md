# 从 Rust 或 Kotlin 转到 Riddle

Riddle 同时借用了 Rust 和 Kotlin 容易辨认的写法，但相同关键字不代表相同语义。本页只比较当前已经实现的行为。

## 语法速查

| 主题 | Riddle | Rust | Kotlin |
|------|--------|------|--------|
| 函数 | `fun add(x: i32) -> i32` | `fn add(x: i32) -> i32` | `fun add(x: Int): Int` |
| 不可变绑定 | `let value = 1;` | `let value = 1;` | `val value = 1` |
| 可变绑定 | `let mut value = 1;` | `let mut value = 1;` | `var value = 1` |
| 数据类型 | `struct`、`enum` | `struct`、`enum` | `class`、`data class`、`enum class` |
| 共享行为 | `trait` + `impl` | `trait` + `impl` | `interface`、继承与扩展函数 |
| 分支匹配 | `match` | `match` | `when` |
| 可恢复失败 | `Option`、`Result`、`?` | `Option`、`Result`、`?` | 可空类型、异常，以及库类型 `Result` |
| 可增长顺序容器 | `Vector<T>` | `Vec<T>` | `MutableList<T>` |
| 项目工具 | `clue` + `Clue.toml` | Cargo + `Cargo.toml` | Gradle/Maven |

## 与 Rust 的关键出入

### 所有权相似，存储策略不同

Riddle 和 Rust 都默认移动非 `Copy` 值，也都区分 `&T` 与 `&mut T`。区别在于，Riddle 不提供显式生命周期参数：编译器追踪引用来源，并在引用可能越过当前栈帧时把值提升到保守式非移动 GC 堆。

GC 只决定存储位置，不代替所有权。移动后使用、冲突借用和 `Drop` 仍按静态规则检查。Rust 教程中关于生命周期标注、`Box`、`Rc`、`Arc` 或 trait object 的章节不能直接映射到当前 Riddle。

### 语法只是子集与重新组合

Riddle 使用 Rust 风格的尾表达式、`struct`、`enum`、`trait`、`impl`、`match`、`mod` 和 `use`，但当前没有 `if let`、`let else`、区间模式、`dyn Trait` 或声明式宏。泛型和 callable 主要通过静态单态化实现。

### Cargo 与 Clue 不是同一个工具

Clue 借用了部分 Cargo 清单形状，但当前依赖只支持本地 path，不支持 registry、版本求解、git 依赖或 lockfile。不要把 Cargo 选项直接写入 `Clue.toml`。

## 与 Kotlin 的关键出入

### `fun` 相同，返回规则不同

Riddle 的块可以产生值，函数体最后一个没有分号的表达式就是返回值：

```riddle
fun double(value: i32) -> i32 {
    value * 2
}
```

Kotlin 的块体函数通常使用显式 `return`，单表达式函数则写成 `fun double(value: Int) = value * 2`。不要因为两者都使用 `fun` 就照搬函数体规则。

### 没有类、可空类型或异常语法

Riddle 当前用结构体表示数据，用 trait 和 impl 表示共享行为，没有类继承、`T?`、`null`、`throw`、`try` 或 `catch`。可能缺失的值使用 `Option<T>`，可恢复失败使用 `Result<T, E>`，不可恢复路径使用 `panic`。

### 不是 Kotlin 式托管对象模型

Riddle 值会移动，引用会借用，实现 `Drop` 的值在所有者结束时确定性析构。逃逸到 GC 堆不会把值变成可随意共享的对象，也不会取消借用检查。

### 平台与生态范围不同

Kotlin 文档按 JVM、Native、JavaScript、Wasm 和多平台组织内容。Riddle 当前只维护 C11 后端，并由目标组件与系统 C 工具链共同决定能否链接；因此本书不会复制 Kotlin 的平台章节。

## 阅读外部教程时的原则

可以借用 Rust Book 的概念顺序、Rust 圣经的学习路径和 Kotlin 文档的分类方式，但每段代码都应按 Riddle 的[形式化语法](./grammar.md)和[当前工具链状态](./compiler-status.md)重新确认。遇到相似名称时，先查本书对应章节，不要默认 API 或边界条件也相同。
