# 控制流

控制流决定程序在不同条件下执行哪些代码。Riddle 提供 `if`、`while`、`for` 和 `match`。

`match` 在这里先介绍基本用法；引用模式、穷尽性检查和匹配人体工学等完整规则需要结构体和枚举知识，放在[枚举、模式与 match](./enums-and-patterns.md)一章。

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
        print!("{}", x);
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
        print!("{}", i);
        i = i + 1;
    }
}
```

循环中经常会用到 `mut`，因为循环变量需要更新。

## for 循环

`for` 使用 `IntoIterator` / `Iterator` 协议遍历值：

```riddle
use std::ops::range;

fun sum_to_three() -> i32 {
    let mut sum = 0;

    for item in range(0, 3) {
        sum += item;
    }

    sum
}
```

`std::ops::range(start, end)` 产生半开区间 `[start, end)`，使用前需要显式导入。固定长度数组、`Vector`、切片和 `&str` 也都可以直接用于 `for`；如何为自定义类型实现 `IntoIterator`，见[闭包与迭代器](./functional.md)。

## break 与 continue

`break` 立即结束最近一层循环，`continue` 跳到最近一层循环的下一次迭代：

```riddle
use std::ops::range;

fun first_three_odd_sum() -> i32 {
    let mut sum = 0;

    for value in range(0, 10) {
        if value == 6 {
            break;
        }
        if value % 2 == 0 {
            continue;
        }
        sum += value;
    }

    sum
}
```

当前只支持无值、无标签的 `break;` 和 `continue;`，并且只能在 `while` 或 `for` 循环体中使用。

## match 基础

`match` 根据值的形状选择分支。最简单的用法是匹配字面量：

```riddle
fun classify(n: i32) -> i32 {
    match n {
        0 => 0,
        _ => 1,
    }
}
```

arm 由模式、可选的 `if` guard 和 `=>` 后的表达式组成：

```riddle
fun classify(n: i32) -> i32 {
    match n {
        x if x < 0 => -1,
        0 => 0,
        _ => 1,
    }
}
```

标准库的 `Option<T>` 也是通过 `match` 处理的常见对象：

```riddle
fun unwrap_or_zero(value: Option<i32>) -> i32 {
    match value {
        Some(n) => n,
        None => 0,
    }
}
```

`Some` / `None` 由 prelude 重导出，不需要显式导入。`match` 是表达式，每个 arm 必须产生兼容类型。

模式系统、`let` 解构与穷尽性检查的完整规则见[枚举、模式与 match](./enums-and-patterns.md)。
