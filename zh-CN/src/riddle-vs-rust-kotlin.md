# 从 Rust 或 Kotlin 过来

Riddle 借用了 Rust 和 Kotlin 里好认的写法，但关键字相同不代表语义相同。下面只比较当前已经实现的行为。

## 速查

| 主题 | Riddle | Rust | Kotlin |
|------|--------|------|--------|
| 函数 | `fun add(x: i32) -> i32` | `fn add(x: i32) -> i32` | `fun add(x: Int): Int` |
| 不可变绑定 | `let value = 1;` | `let value = 1;` | `val value = 1` |
| 可变绑定 | `let mut value = 1;` | `let mut value = 1;` | `var value = 1` |
| 数据建模 | `struct`、`enum` | `struct`、`enum` | `class`、`data class`、`enum class` |
| 共享行为 | `trait` + `impl` | `trait` + `impl` | 接口、继承、扩展函数 |
| 分支匹配 | `match` | `match` | `when` |
| 可恢复失败 | `Option`、`Result`、`?` | `Option`、`Result`、`?` | 可空类型与异常 |
| 可增长序列 | `Vector<T>` | `Vec<T>` | `MutableList<T>` |
| 项目工具 | `clue` + `Clue.toml` | Cargo | Gradle / Maven |

## 相对 Rust

**没有生命周期参数。** 编译器自己追踪引用来源，判断值能不能留在栈上；引用需要活过当前栈帧时，值被提升到 GC 堆。移动后使用、借用冲突和 `Drop` 时序仍然按静态规则检查，GC 只影响存储位置。

**没有 `Box`、`Rc`、`Arc`。** 堆存储是自动的，共享一个值仍然靠引用，不靠引用计数。裸 `dyn Trait` 本身就是拥有所有权的值：开 GC 时分配在 GC 堆，关 GC 时走 `riddle_alloc` / `riddle_free`。

**没有生命周期，也就没有生命周期标注带来的类型体操**，泛型和方法解析更简单，代价是表达力下降：需要精确控制值何时被回收时，只能靠作用域和 `Drop`。

**声明式宏（`macro_rules!`）不存在。** 需要生成代码时写过程宏，见[编写过程宏](./proc-macros.md)。

## 相对 Kotlin

**`fun` 相同，块的返回值规则不同。** 函数体的最后一个表达式就是返回值，不需要 `return`：

```riddle
fun double(value: i32) -> i32 {
    value * 2
}
```

Kotlin 里等价写法要么用 `return`，要么写成单表达式函数。别因为都叫 `fun` 就照搬函数体规则。

**没有类、可空类型和异常。** 数据用结构体，共享行为用 trait 和 impl。可能缺失的值用 `Option<T>`，可恢复失败用 `Result<T, E>`，不可恢复路径用 `panic`。没有 `null`、`throw`、`try`、`catch`。

**值会移动。** 把非 `Copy` 值传出去之后原绑定就不能再用。提升到 GC 堆不会把值变成可以随便共享的对象，也不会取消借用检查。实现 `Drop` 的值在所有者结束时析构。

**平台支持只有 C11 后端。** 能否链接由目标组件和本机 C 工具链决定，没有 JVM、JS 或 Wasm 目标。

## 读外部教程时

Rust 和 Kotlin 的资料可以借来理解概念，但每段代码都要按[形式化语法](./grammar.md)和[当前工具链状态](./compiler-status.md)重新确认。名字相同的地方，边界条件往往不同。
