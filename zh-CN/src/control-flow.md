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

标准库提供了三个常用可迭代值：

- `range(start, end)` 产生半开区间 `[start, end)`；
- 固定长度数组 `[T; N]` 会通过 `ArrayIter<T, N>` 逐个按值产出元素，元素类型不需要实现 `Copy`；
- `Vector<T>` 会在循环中按值产出当前保存的元素并消耗向量。

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

## break 与 continue

`break` 立即结束最近一层循环，`continue` 跳到最近一层循环的下一次迭代：

```riddle
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

当前模式支持 `_`、标识符绑定、字面量、路径、引用、元组、结构体和枚举变体。

## 引用模式与匹配人体工学

显式引用模式会解构恰好一层、且可变性必须相同的引用：

```riddle
fun read(reference: &mut i32) -> i32 {
    let &mut copied = reference;
    copied
}

fun mixed(mut value: i32) -> i32 {
    let (&mut copied, plain) = (&mut value, 4);
    copied + plain
}
```

显式模式内的绑定按值取得内容。上例的 `copied` 是 `i32` 副本，不是 `&mut i32`；若内容不是 `Copy`，会报告 `E0308`。`&pattern` 不能匹配 `&mut T`，`&mut pattern` 也不能匹配 `&T`。

元组、结构体、枚举和字面量等非引用模式遇到引用输入时会自动逐层解引用，并继承默认绑定模式：

```riddle
struct Pair { left: i32, right: i32 }

fun update(pair: &mut Pair) {
    let Pair { left, right } = pair;
    *left = 10;   // left: &mut i32
    *right = 20;  // right: &mut i32
}
```

经过共享引用时，内部绑定最终都是共享引用；只经过可变引用时则得到可变引用。裸标识符模式不会自动解引用，因此 `let whole = pair;` 仍让 `whole` 取得整个引用值。Riddle 没有 `ref` / `ref mut` 语法。

结构化模式自动解引用后，如果默认绑定模式已经变为引用，内部不能再写 `mut binding` 或显式 `&pattern` / `&mut pattern`。需要显式引用模式时，应让它出现在默认 `move` 模式的位置。

未限定的标识符模式会绑定并匹配任意值。因此下面的 `other` 不是常量，而是覆盖除前面 arm 之外所有剩余 `u8` 值的绑定：

```riddle
fun unsigned(value: u8) -> i32 {
    match value {
        0 => 0,
        other => 1,
    }
}
```

编译器使用模式矩阵检查 `match` 是否穷尽。检查会递归展开枚举 payload、元组和结构体字段，并识别 `bool`、`()` 与整数值域。缺少分支时会报告 `E0039` 和一个可覆盖的示例模式；整数匹配还会在诊断注记中列出未覆盖的连续区间。例如，只匹配 `u8` 的 `0` 和 `2` 时，注记会指出 `1` 与 `3..=255` 尚未覆盖。区间目前只用于诊断展示，不是可写在模式中的区间语法。

带 guard 的 arm 不计入穷尽性，因为 guard 可能在运行时为 `false`。浮点数、字符和字符串也需要用 `_` 或标识符绑定覆盖其余值。
