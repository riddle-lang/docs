# 枚举、模式与 match

结构体表示“这些字段同时存在”，枚举表示“这些形状只会出现一种”。模式负责拆开其中的数据，`match` 根据形状选择分支。`match` 的基础用法在[控制流](./control-flow.md#match-基础)已经介绍，本章完整讲解枚举定义、模式系统和穷尽性检查。

## 定义枚举

变体可以没有数据，也可以携带元组或具名字段：

```riddle
enum Message {
    Quit,
    Move(i32, i32),
    Write { text: &str },
}
```

枚举可以带类型参数和 `where` 约束：

```riddle
enum Slot<T> {
    Empty,
    Value(T),
}
```

标准库的 `Option<T>` 和 `Result<T, E>` 也是普通泛型枚举，并由 prelude 重导出其常用变体。

## 构造与匹配变体

使用枚举路径构造值，再用相同形状的模式取出 payload：

```riddle
fun describe(message: Message) -> i32 {
    match message {
        Message::Quit => 0,
        Message::Move(x, y) => x + y,
        Message::Write { text } => text.len() as i32,
    }
}
```

`match` 是表达式，每个 arm 必须产生兼容类型。编译器会检查枚举、布尔、unit、整数、元组和结构体模式是否穷尽；缺少分支会报告 `E0039`。

## 常用模式

当前模式包括：

- `_` 通配符；
- 标识符绑定与 `mut` 绑定；
- 字面量和路径；
- 元组、结构体与枚举变体；
- `&pattern` 与 `&mut pattern` 引用模式。

结构体模式可以只列出需要的字段：

```riddle
struct Point { x: i32, y: i32 }

fun x_of(point: Point) -> i32 {
    let Point { x, y: _ } = point;
    x
}
```

普通 `let` 没有失败分支，所以模式必须覆盖该类型的每个值。枚举变体和字面量通常是可反驳模式，应放在 `match` 中；直接写在普通 `let` 中会报告 `E0057`。需要在失败时离开当前控制流时，可以使用 `let-else`：

```riddle
let Some(value) = option else {
    return;
};
```

`let-else` 的失败分支必须发散，成功后的绑定会留在外层作用域。元组和结构体模式是不可反驳的，可以直接解构：

```riddle
let (a, b) = pair;             // OK
let Point { x, y } = point;    // OK
```

## 穷尽性检查

编译器使用模式矩阵检查 `match` 是否穷尽。检查会递归展开枚举 payload、元组和结构体字段，并识别 `bool`、`()` 与整数值域。缺少分支时会报告 `E0039` 和一个可覆盖的示例模式：

```riddle
enum State { Ready, Done(i32) }

fun value(state: State) -> i32 {
    match state {
        State::Ready => 0,
        State::Done(1) => 1,
        // E0039: missing pattern `State::Done(_)`
    }
}
```

整数匹配还会在诊断注记中列出未覆盖的连续区间。例如，只匹配 `u8` 的 `0` 和 `2` 时，注记会指出 `1` 与 `3..=255` 尚未覆盖。区间目前只用于诊断展示，不是可写在模式中的区间语法。

带 guard 的 arm 不计入穷尽性，因为 guard 可能在运行时为 `false`。浮点数、字符和字符串也需要用 `_` 或标识符绑定覆盖其余值。

未限定的标识符模式通常绑定并匹配任意值；唯一的例外是与期望枚举类型的 unit 变体同名时，它按该变体的构造器模式处理（因此 `match option { None => 0 }` 会因缺少 `Some` 而报穷尽性错误，而不是绑定名为 `None` 的任意值）。除此之外，下面的 `other` 不是常量，而是覆盖除前面 arm 之外所有剩余 `u8` 值的绑定：

```riddle
fun unsigned(value: u8) -> i32 {
    match value {
        0 => 0,
        other => 1,
    }
}
```

## guard 与绑定

arm 可以在模式后加条件：

```riddle
fun classify(value: Option<i32>) -> i32 {
    match value {
        Some(number) if number < 0 => -1,
        Some(0) => 0,
        Some(_) => 1,
        None => 2,
    }
}
```

guard 失败后继续检查后续 arm。guard 只能查看或借用非 `Copy` 模式绑定，不能取得其所有权（`E0307`）；把移动操作放到选中的 arm body 中。模式绑定的移动与析构规则见[移动语义](./move-semantics.md#模式绑定也会移动)。

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
