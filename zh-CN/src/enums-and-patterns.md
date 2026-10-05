# 枚举、模式与 match

枚举的每个变体可以不带数据、带元组数据，或带命名字段：

```riddle
enum Message {
    Quit,
    Write(i32),
    Move { x: i32, y: i32 },
}
```

变体不能写 `pub`，也没有显式判别值（`A = 1` 是语法错误）。结构体风格的变体字段可以写 `pub`；元组变体的元素不能写 `mut`，结构体变体的字段写 `mut` 报 `E0014`。

## 构造与匹配

```riddle
fun describe(message: Message) {
    match message {
        Message::Quit => println!("quit"),
        Message::Write(code) => println!("write {}", code),
        Message::Move { x, y } => println!("move {} {}", x, y),
    }
}

fun main() {
    describe(Message::Quit);
    describe(Message::Write(3));
    describe(Message::Move { x: 1, y: 2 });
}
```

每个 arm 是「模式 + 可选 guard + `=>` + 表达式」。arm 体是块时逗号可以省略。`match` 是表达式，所有 arm 的类型必须兼容。

## 模式

| 形态 | 例子 |
| --- | --- |
| 通配 | `_` |
| 绑定 | `x`、`mut x` |
| 字面量 | `0`、`1.5`、`'a'`、`"s"`、`true` |
| 元组 | `(a, b)`、`()` |
| 引用 | `&p`、`&mut p`、`&&p` |
| 结构体 | `Point { x, y: 0 }` |
| 枚举变体 | `Some(x)`、`E::A` |
| 或模式 | `A \| B`，只在 match 臂的顶层 |

没有 `ref` / `ref mut`、没有 `@` 绑定、没有切片模式 `[a, b]`、没有区间模式 `1..=5`、不能在备选内部再嵌或模式（`Some(1 | 2)`），字面量模式也不能带负号。

## 或模式

```riddle
enum Color { Red, Green, Blue }

fun code(color: Color) -> i32 {
    match color {
        Color::Red | Color::Green => 1,
        Color::Blue => 2,
    }
}

fun main() {
    println!("{}", code(Color::Green));
}
```

臂首可以写一个多余的 `|`，没有语义。备选不能绑定变量：`E::A(x) | E::B(x)` 报 `E0050`，需要在臂体里绑定，或者拆成两个 arm。或模式只属于 match 臂，`let A | B = v` 和 `if let A | B = v` 都不接受。

## 穷尽性

`match` 必须覆盖全部取值，否则报 `E0039` 并指出缺少的模式：

```riddle
enum State { Idle, Running }

fun label(state: State) -> &str {
    match state {
        State::Idle => "idle",
    }
}
```

带 guard 的 arm 不参与穷尽性判断：`x if x < 0 => ...` 不能顶替 `_`。`!` 类型的值不需要任何 arm。

## guard

guard 是 `if` 加一个 `bool` 表达式，可以使用模式绑定的名字：

```riddle
fun classify(n: i32) -> &str {
    match n {
        x if x < 0 => "negative",
        0 => "zero",
        _ => "positive",
    }
}

fun main() {
    println!("{}", classify(-3));
}
```

在 guard 里移动绑定值报 `E0307`，因为 guard 可能对同一个值求值多次。

## 引用与匹配

拿 `&T` 去匹配时，模式里的绑定自动变成引用，不需要写 `&`：

```riddle
fun main() {
    let value = Some(5);
    let reference = &value;
    match reference {
        Some(n) => println!("{}", *n),
        None => println!("none"),
    }
}
```

也可以显式写引用模式 `&pattern` / `&mut pattern`，它们的含义与显式解引用一致。默认引用模式下再写 `mut` 或 `&mut` 会报 `E0010`。

## 解构赋值

`(a, b) = pair;` 和 `Point { x, y } = point;` 都会写回左值。右侧先求值并存进一个临时位置，再逐个分量存到左边的目标上，所以左边互相重叠也没问题——`(a, b) = (b, a);` 就是标准的交换写法。结构体形态按字段名配对，与书写顺序无关；元组和结构体可以互相嵌套，逐层展开。

```riddle
struct Point {
    x: i32,
    y: i32,
}

fun main() {
    let mut a = 0;
    let mut b = 0;
    (a, b) = (1, 2);
    println!("{} {}", a, b); // 1 2
    (a, b) = (b, a);
    println!("{} {}", a, b); // 2 1

    let mut point = Point { x: 0, y: 0 };
    Point { x: point.x, y: point.y } = Point { x: 5, y: 6 };
    println!("{} {}", point.x, point.y); // 5 6
}
```

左边的每个分量都得是可写的地方（变量、字段、下标），不是模式绑定。同一个名字出现两次不会报错，按书写顺序依次写入，最后一次生效。
