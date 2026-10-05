# 控制流

## if

`if` 是表达式，分支都是块，块的值就是分支的值：

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

没有 `else` 时整个 `if` 的类型是 `()`，两个分支都参与类型检查：

```riddle
fun main() {
    if 1 > 0 {
        println!("positive");
    }
}
```

`if` 的条件必须是 `bool`，没有隐式转换。

## if let

`if let` 用一个模式代替条件，匹配成功时执行第一个分支，绑定只在那个分支内可见：

```riddle
fun describe(value: Option<i32>) -> i32 {
    if let Some(n) = value {
        n
    } else {
        0
    }
}
```

模式可以是任何模式，但不能带 `if` guard；需要 guard 时用 `match`。等价写法是只写两个 arm 的 `match`。

## while 与 while let

`while` 在条件为 `true` 时反复执行循环体，类型是 `()`：

```riddle
fun count_to_three() {
    let mut i = 0;
    while i < 3 {
        println!("{}", i);
        i += 1;
    }
}
```

`while let` 每次迭代重新求值条件，模式匹配失败时结束循环，适合消费会耗尽的序列：

```riddle
fun drain(mut current: Option<i32>) -> i32 {
    let mut total = 0;
    while let Some(value) = current {
        total += value;
        current = Some(value - 1);
    }
    total
}
```

与 `if let` 一样，绑定只在循环体内可见，也不支持 guard。

## loop

`loop` 只由 `break` 结束，并且会产生值：`break 值;` 的值就是整个 `loop` 表达式的值。

```riddle
fun first_multiple_of_seven(limit: i32) -> i32 {
    let mut i = 0;
    loop {
        if i >= limit {
            break -1;
        }
        if i > 0 && i % 7 == 0 {
            break i;
        }
        i += 1;
    }
}
```

所有 `break` 的值必须是同一个类型。没有任何可达 `break` 的 `loop` 类型是 `!`，可以用在需要其他类型的位置。带值的 `break` 只能出现在 `loop` 里，在 `while` 或 `for` 中写 `break 值;` 报 `E0065`。

## for

`for` 遍历实现了 `IntoIterator` 的值：

```riddle
fun sum_to_three() -> i32 {
    let mut sum = 0;
    for item in 0..3 {
        sum += item;
    }
    sum
}
```

循环头可以是任何不可反驳模式，元素直接解构：

```riddle
fun total(pairs: [(i32, i32); 2]) -> i32 {
    let mut sum = 0;
    for (key, value) in pairs {
        sum += key + value;
    }
    sum
}
```

可反驳模式（枚举变体、字面量）不能写在循环头，会报 `E0057`，需要区分情况时在循环体里 `match`。

数组、切片、`&str`、`Vector`、`HashMap`、集合都能直接遍历；遍历共享容器时元素是引用（`&i32` 之类），打印前要先解引用。为自定义类型实现 `IntoIterator` 见[匿名函数与迭代器](./functional.md)。

## break 与 continue

`break` 结束最近一层循环，`continue` 跳到下一次迭代：

```riddle
fun sum_odds_below_six() -> i32 {
    let mut sum = 0;
    for value in 0..10 {
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

两者都只能出现在循环体内，循环不支持标签。`break;` 在三种循环里都可用；带值的 `break` 只对 `loop` 有效。循环控制语句写错位置报 `E0042`（带值但不在 `loop` 里是 `E0065`）。

## match 基础

`match` 按值的形状选择分支，每个 arm 由模式、可选 guard 和 `=>` 后的表达式组成：

```riddle
fun classify(n: i32) -> i32 {
    match n {
        x if x < 0 => -1,
        0 => 0,
        _ => 1,
    }
}
```

`match` 是表达式，所有 arm 必须产生兼容的类型，并且必须覆盖全部取值，否则报 `E0039`。`Option` 和 `Result` 由 prelude 重导出，可以直接写 `Some`、`None`、`Ok`、`Err`。

完整的模式语法、或模式与穷尽性规则见[枚举、模式与 match](./enums-and-patterns.md)。
