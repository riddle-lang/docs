# 函数

函数是 Riddle 程序的基本组织单位。它把一段逻辑命名，让代码可以被复用、测试和组合。

当前 Riddle 使用 `fun` 定义函数。

## 定义函数

一个最小的函数可以没有参数，也没有显式返回类型：

```riddle
fun greet() {
    print!("{}", "hello")
}
```

函数名后面是一对括号，函数体放在 `{}` 中。

## 参数

参数写在括号里，每个参数都带类型：

```riddle
fun greet(name: &str) {
    print!("{}", name)
}
```

多个参数使用逗号分隔：

```riddle
fun add(a: i32, b: i32) -> i32 {
    a + b
}
```

参数也是绑定。传入非 `Copy` 值会移动所有权；整数、布尔值等实现了 `Copy` 的类型则按复制语义传入。完整规则见[移动语义](./move-semantics.md)。

## 返回值

返回类型写在 `->` 后面：

```riddle
fun square(x: i32) -> i32 {
    x * x
}
```

函数体最后一个没有分号的表达式就是返回值。

这和下面显式写 `return` 的形式表达同样的意图：

```riddle
fun square(x: i32) -> i32 {
    return x * x;
}
```

Riddle 鼓励在简单函数中使用尾表达式，因为它能减少样板代码。

## 提前返回

当你需要提前结束函数时，可以使用 `return`：

```riddle
fun abs(x: i32) -> i32 {
    if x < 0 {
        return -x;
    }

    x
}
```

`return` 更适合错误分支、提前退出或复杂控制流。普通计算则可以交给尾表达式。

## 泛型函数

函数可以带类型参数，让同一份逻辑适用于多种类型：

```riddle
fun id<T>(value: T) -> T {
    value
}

fun main() {
    let n = id(1);       // T 推断为 i32
    let b = id(true);    // T 推断为 bool
}
```

多个类型参数用逗号分隔：

```riddle
fun pair<A, B>(first: A, second: B) -> (A, B) {
    (first, second)
}
```

类型参数可以带 trait bound：

```riddle
fun copy_id<T: std::marker::Copy>(value: T) -> T {
    value
}
```

多个 bound 用 `+` 连接，例如 `<T: Named + Tagged>`。bound 也可以约束关联类型，例如 `<T: std::ops::Add<Output = T>>`。

也可以把约束写成 `where` 子句：

```riddle
fun read<T>(value: T) -> i32
where T: Named
{
    value.name()
}
```

调用泛型函数或方法时，编译器会联合全部实参与调用位置的期望返回类型推断类型参数，实参的书写顺序不影响推导；也可以在函数名后用 Rust 风格的 `::<...>` 显式指定：

```riddle
fun main() {
    let n = id::<i32>(1);   // 显式指定 T = i32
    let b = id::<bool>(true);
}
```

方法的显式类型实参使用相同语法，例如 `value.convert::<Target>()`。调用泛型类型上的关联函数时，类型实参写在类型路径段上：

```riddle
let values = Vector::<i32>::new();
let converted = Wrapper::<i32>::convert::<bool>();
```

这里第一组参数选择 `impl<T>` 的 `T`，末尾一组参数选择关联函数自己的泛型参数。类型标注中仍然写作 `Vector<T>`，不需要 `::`。

编译器会检查推断或显式给出的实参类型是否满足 bound；函数体内可以通过 bound 调用 trait 方法，C backend 会在单态化后静态分派到具体 impl。

函数也支持 const 泛型参数。当前常见用法是把数组长度作为编译期参数：

```riddle
fun len<const N: usize>(values: [i32; N]) -> i32 {
    0
}

fun main() {
    let n = len([1, 2, 3]); // N 推断为 3
}
```

## 可调用参数与返回值

参数位置使用 `impl Fn`、`impl FnMut` 或 `impl FnOnce` 接收匿名函数和安全命名函数项，返回位置的 `impl Fn*` 隐藏一个具体返回类型。`Fn`、`FnMut`、`FnOnce` 只能作为编译器提供的静态能力使用；当前不支持 `dyn Fn*`，用户代码也不能手动实现它们。完整的捕获规则、调用能力与限制见[闭包与迭代器](./functional.md#可调用参数与返回值)。

## 函数声明

有些函数可能只声明签名，具体实现由外部提供：

```riddle
fun external_log(value: i32);
```

这种形式以分号结束，没有函数体。
