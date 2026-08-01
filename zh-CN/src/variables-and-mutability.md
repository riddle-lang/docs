# 变量与可变性

变量是给值起名字的方式。在 Riddle 中，变量默认不可变。
这个默认选择让代码更容易推理：当你看到一个普通绑定时，就可以假设它不会在后续被改写。

## 使用 let 创建绑定

最简单的变量绑定使用 `let`：

```riddle
fun main() {
    let answer = 42;
    print!("{}", answer)
}
```

这里的 `answer` 绑定到整数 `42`。默认情况下，你不能重新给 `answer` 赋值。

## 默认不可变

下面的代码表达了 Riddle 不希望你在普通绑定上做的事情：

```riddle
fun main() {
    let answer = 42;
    answer = 43; // error: answer 不可变
}
```

不可变默认值有两个好处。
第一，它减少了意外修改。第二，它让移动和引用规则更容易理解，因为一个值不会在你没有注意到的地方被改掉。

## 使用 mut 表示可变

如果一个变量确实需要变化，需要显式写出 `mut`：

```riddle
fun main() {
    let mut count = 0;
    count = count + 1;
    print!("{}", count)
}
```

`mut` 是一种提醒：这个绑定后面会发生变化。读代码的人看到 `mut`，就知道需要关注这个值的更新路径。

## 解构绑定

`let` 后面写的是一个模式，所以可以一次拆开元组或结构体：

```riddle
struct Point { x: i32, y: i32 }

fun main() {
    let (a, b) = (1, 2);
    let Point { x, y } = Point { x: 3, y: 4 };
    let (_, second) = (10, 20); // 用 `_` 丢弃不需要的部分
    print!("{}", a + b + x + y + second)
}
```

`mut` 属于单个绑定，而不是整条 `let`。想让其中一个元素可变，就写在它自己前面：

```riddle
fun main() {
    let (mut count, step) = (0, 5);
    count = count + step;
    print!("{}", count)
}
```

`let mut (count, step) = ...` 不是合法写法。

`let` 没有备选分支，所以它的模式必须匹配该类型的每一个值。枚举变体、字面量这类只覆盖部分取值的模式会报告 `E0057`，需要改用 `match`。

## 类型标注

变量可以写类型标注：

```riddle
fun main() {
    let age: i32 = 18;
    let name: &str = "Riddle";
}
```

很多时候类型可以从初始化表达式推导出来。需要让意图更清楚，或者编译器无法推导时，可以写出类型。

## 延迟初始化

`let` 可以先声明、后赋值。带类型标注的绑定直接使用标注类型；没有标注时，编译器会从首次赋值推断类型：

```riddle
fun main() {
    let value: i32;
    value = 10;

    let inferred;
    inferred = 20;
}
```

不可变绑定的首次赋值不需要 `mut`；如果要在首次赋值后再次赋值，声明时必须写 `mut`：

```riddle
let once: i32;
once = 1;             // OK
once = 2;             // E0031

let mut many: i32;
many = 1;
many = 2;             // OK
```

使用前没有在所有路径上完成赋值会报告 `E0059`。分支需要分别初始化：

```riddle
fun choose(flag: bool) -> i32 {
    let value: i32;
    if flag { value = 10; } else { value = 20; }
    value
}
```

如果某条路径没有赋值，后续使用就是错误：

```riddle
fun incomplete(flag: bool) -> i32 {
    let value: i32;
    if flag { value = 10; }
    value // E0059
}
```

## const 常量

`const` 用于定义编译期常量，必须写明类型并初始化：

```riddle
const MAX: i32 = 100;
const GREETING: &str = "hello";
```

`const` 可以出现在顶层模块和 `impl` 块中。与 `let` 不同，`const` 的值在编译期确定，不能省略类型标注。
