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

## if let 表达式

`if let` 用一个模式代替布尔条件：匹配成功时执行第一个分支，并把模式里的绑定引入分支作用域：

```riddle
fun describe(value: Option<i32>) -> i32 {
    if let Some(n) = value {
        n
    } else {
        0
    }
}
```

它等价于一个只关心一种情况的 `match`：匹配成功的分支对应模式臂，`else` 分支对应 `_` 通配臂（不写 `else` 时相当于空的 `_` 臂）。绑定只在匹配成功的分支内可见，`else` 分支和语句之后都看不到它。

模式可以使用任何匹配模式（枚举、结构体、元组、字面量等），但不支持 `if` guard：

```riddle
fun first_of(pair: Option<(i32, i32)>) -> i32 {
    if let Some((first, _)) = pair {
        first
    } else {
        0
    }
}
```

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

## while let 循环

`while let` 在每次迭代时重新求值条件表达式，并在模式匹配成功时执行循环体，匹配失败时结束循环：

```riddle
fun drain(mut current: Option<i32>) -> i32 {
    let mut total = 0;

    while let Some(value) = current {
        total += value;
        current = if value > 0 { Some(value - 1) } else { None };
    }

    total
}
```

与 `if let` 一样，模式绑定只在循环体内可见，且不支持 `if` guard。因为条件表达式每次迭代都会重新求值，它适合配合返回 `Option` 的迭代协议消费序列。

## loop 循环

`loop` 是无条件无限循环，只会在 `break` 时结束：

```riddle
fun next_power_of_two(mut n: u32) -> u32 {
    loop {
        if n >= 1024 {
            break;
        }
        n = n * 2;
    }
    n
}
```

与 `while` 和 `for` 不同，`loop` 是会产生值的表达式：在 `loop` 内可以写 `break 值;` 把值交给整个循环表达式。所有 `break` 值的类型会被合并为循环的结果类型：

```riddle
fun first_match(limit: i32) -> i32 {
    let mut i = 0;

    let found = loop {
        if i >= limit {
            break -1;
        }
        if i % 7 == 0 && i > 0 {
            break i;
        }
        i += 1;
    };

    found
}
```

带值的 `break` 只对 `loop` 有效；在 `while` 或 `for` 中写 `break 值;` 会报错。如果一个 `loop` 没有任何可达的 `break`，它永远不会结束，类型是 `!`（never），可以出现在任何期待值的位置。

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

`std::ops::range(start, end)` 产生半开区间 `[start, end)`，使用前需要显式导入。更常见的是直接写区间表达式：`for i in 0..3` 等价于 `for i in range(0, 3)`；`a..b` 脱糖为 `std::ops::range(a, b)`，`a..=b` 脱糖为 `range_inclusive(a, b)`，都不需要导入。固定长度数组、`Vector`、切片和 `&str` 也都可以直接用于 `for`；如何为自定义类型实现 `IntoIterator`，见[闭包与迭代器](./functional.md)。

循环头不只是单个变量名，可以是任何不可反驳模式，遍历时直接解构元素：

```riddle
fun total(pairs: [(i32, i32); 2]) -> i32 {
    let mut sum = 0;

    for (key, value) in pairs {
        sum += key + value;
    }

    sum
}
```

与 `let` 一样，`for` 没有备选分支，所以枚举变体、字面量这类只覆盖部分取值的可反驳模式不能写在循环头，会报告 `E0057`；需要区分情况时在循环体内使用 `match`。

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

`break` 和 `continue` 只能用在循环体中，且不支持标签。`break;` 在三种循环中都可用；`break 值;` 只对 `loop` 有效，见上文 `loop` 循环一节。

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
