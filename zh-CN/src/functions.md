# 函数

函数是 Riddle 程序的基本组织单位。它把一段逻辑命名，让代码可以被复用、测试和组合。

当前 Riddle 使用 `fun` 定义函数。

## 定义函数

一个最小的函数可以没有参数，也没有显式返回类型：

```riddle
fun greet() {
    print("hello")
}
```

函数名后面是一对括号，函数体放在 `{}` 中。

## 参数

参数写在括号里，每个参数都带类型：

```riddle
fun greet(name: &str) {
    print(name)
}
```

多个参数使用逗号分隔：

```riddle
fun add(a: i32, b: i32) -> i32 {
    a + b
}
```

参数也是绑定。把值传入函数时，默认会发生移动。对于简单数字这类值，语言可以选择复制或优化，但从语义上你应该先理解为“值交给了函数”。

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

泛型函数在 C backend 中会按实际调用生成单态化版本。当前泛型只支持简单类型参数，尚未实现 where 约束和 trait bound。

## 函数声明

有些函数可能只声明签名，具体实现由外部提供：

```riddle
fun print(value: i32);
```

这种形式以分号结束，没有函数体。

## 小结

- 使用 `fun` 定义函数；
- 参数必须写类型；
- 返回类型写在 `->` 后面；
- 函数体尾表达式可以作为返回值；
- `return` 用于提前返回；
- 函数可以带类型参数 `<T>`，C backend 会单态化；
- 当前泛型不支持 where 约束和 trait bound。
