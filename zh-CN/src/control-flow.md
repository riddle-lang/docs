# 控制流

控制流决定程序在不同条件下执行哪些代码。Riddle 提供 `if`、`while`、`for` 和 `match`。

## if 表达式

`if` 根据条件选择一个分支：

```riddle
fun sign(x: i32) -> i32 {
    if x < 0 {
        -1
    } else if x == 0 {
        0
    } else {
        1
    }
}
```

这里整个 `if` 是函数体的尾表达式，因此它的结果就是函数返回值。

## 分支也是块

每个分支都是一个块。块的尾表达式就是这个分支的值：

```riddle
fun choose(flag: bool) -> i32 {
    let value = if flag {
        10
    } else {
        20
    };

    value
}
```

因为 `if` 会产生值，所以两个分支应该产生兼容的类型。

## 没有 else 的 if

如果你只需要在条件成立时执行一些动作，可以不写 `else`：

```riddle
fun print_if_positive(x: i32) {
    if x > 0 {
        print(x);
    }
}
```

这种写法更像普通语句。它适合日志、提前检查和局部动作。

## while 循环

`while` 会在条件成立时反复执行块：

```riddle
fun count_to_three() {
    let mut i = 0;

    while i < 3 {
        print(i);
        i = i + 1;
    }
}
```

循环中经常会用到 `mut`，因为循环变量需要更新。

## for 循环

`for` 使用 `IntoIterator` / `Iterator` 协议遍历值：

```riddle
fun sum_to_three() -> i32 {
    let mut sum = 0;

    for item in range(0, 3) {
        sum += item;
    }

    sum
}
```

标准库提供了两个常用可迭代值：

- `range(start, end)` 产生半开区间 `[start, end)`；
- 固定长度数组 `[T; N]` 会通过 `ArrayIter<T, N>` 逐个按值产出元素，元素类型不需要实现 `Copy`。

```riddle
fun use_array() -> i32 {
    let mut sum = 0;

    for item in [1, 2, 3] {
        sum += item;
    }

    sum
}
```

用户类型只要实现 `IntoIterator`，并让它的 `IntoIter` 实现 `Iterator`，也可以用于 `for`。MIR 降级会把这类循环降成 `into_iter` 和 `next` 方法调用。

## match 表达式

`match` 根据值的形状选择分支：

```riddle
enum Option {
    None,
    Some(i32),
}

fun unwrap_or_zero(value: Option) -> i32 {
    match value {
        Option::Some(n) => n,
        Option::None => 0,
    }
}
```

`match` arm 可以带 guard：

```riddle
fun classify(n: i32) -> i32 {
    match n {
        x if x < 0 => -1,
        0 => 0,
        _ => 1,
    }
}
```

当前模式支持 `_`、标识符绑定、字面量、路径、元组、结构体和枚举变体。

## 小结

- `if` 可以作为表达式产生值；
- 分支是块，块的尾表达式决定分支结果；
- 没有 `else` 的 `if` 适合执行动作；
- `while` 用于条件循环；
- `for` 用于遍历实现 `IntoIterator` 的值；
- `match` 用于按模式分支；
- 循环状态通常需要 `mut`。
