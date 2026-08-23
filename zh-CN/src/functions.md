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

泛型函数的类型参数、推断、显式实参和 const 泛型见[泛型](./generics.md)一章。

## 可调用参数与返回值

参数位置使用 `impl Fn`、`impl FnMut` 或 `impl FnOnce` 接收匿名函数和安全命名函数项，返回位置的 `impl Fn*` 隐藏一个具体返回类型；需要运行时分派时可使用拥有或借用的 `dyn Fn*`。`Fn`、`FnMut`、`FnOnce` 只能作为编译器提供的 callable 能力使用，用户代码不能手动实现它们。完整的捕获规则、调用能力与限制见[闭包与迭代器](./functional.md#可调用参数与返回值)。

## 函数声明

有些函数可能只声明签名，具体实现由外部提供：

```riddle
fun external_log(value: i32);
```

这种形式以分号结束，没有函数体。
