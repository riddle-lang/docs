# 变量与可变性

`let` 创建绑定，默认不可变：重新赋值报 `E0031`。需要更新时写 `let mut`。

```riddle
fun main() {
    let answer = 42;
    let mut count = 0;
    count += 1;
    println!("{} {}", answer, count);
}
```

可变性属于绑定，不属于值：同一个值可以先被不可变绑定持有，再被可变绑定持有。

## 类型标注与推断

可以写类型，也可以让编译器从初始化式推断。字面量没有期望类型时默认整数是 `i32`、浮点是 `f64`：

```riddle
fun main() {
    let age: i32 = 18;
    let name: &str = "Riddle";
    let ratio = 0.5;
    println!("{} {} {}", age, name, ratio);
}
```

没有隐式数值提升：`i32` 不会自动变成 `i64` 或 `f64`，要转换就写 `as`，见[数据类型](./type-system.md)。

## 遮蔽

再写一次 `let` 会创建新绑定，可以换类型：

```riddle
fun main() {
    let label = "hello";
    let label = label.len();
    println!("{}", label); // 5
}
```

被遮蔽的值不会提前析构，它一直活到作用域结束。给一个实现了 `Drop` 的类型就能看出来：

```riddle
struct R { n: i32 }

impl std::ops::Drop for R {
    fun drop(&mut self) {
        println!("drop {}", self.n);
    }
}

fun main() {
    let r = R { n: 1 };
    let r = R { n: 2 };
    println!("end");
}
```

输出是 `end`、`drop 2`、`drop 1`。Rust 会在遮蔽那一行析构旧值，Riddle 不会。

## 解构绑定

`let` 后面是模式，可以直接拆开元组和结构体：

```riddle
struct Point { x: i32, y: i32 }

fun main() {
    let (a, b) = (1, 2);
    let Point { x, y } = Point { x: 3, y: 4 };
    let (_, second) = (10, 20);
    println!("{}", a + b + x + y + second);
}
```

`mut` 写在单个绑定前面，不能修饰整条语句：`let (mut count, step) = (0, 5);` 合法，`let mut (count, step) = ...` 是语法错误。

普通 `let` 没有分支，模式必须覆盖该类型的全部取值，枚举变体和字面量这类可反驳模式报 `E0057`。需要处理「匹配失败」时用 `let-else`：

```riddle
fun unwrap_or_zero(value: Option<i32>) -> i32 {
    let Some(number) = value else {
        return 0;
    };
    number
}
```

`else` 块必须发散（`return`、`break`、`continue` 或无限 `loop`），否则报 `E0066`。匹配成功后绑定在后面的代码里可用，变体载荷同样会绑到名字上；`clue build` 产出的可执行文件与 `riddle run` / `riddle repl` 在这件事上行为一致。

## 延迟初始化

绑定可以先声明、后赋值，编译器检查每条路径：

```riddle
fun choose(flag: bool) -> i32 {
    let value: i32;
    if flag {
        value = 10;
    } else {
        value = 20;
    }
    value
}
```

不可变绑定的首次赋值不需要 `mut`；第二次赋值报 `E0031`。某条路径上没有赋值就读取，报 `E0059`。

## const

`const` 声明编译期常量，必须写类型并给初始化式：

```riddle
const WIDTH: usize = 8;
const HEIGHT: usize = WIDTH / 2;

fun main() {
    let grid: [i32; 32] = [0; WIDTH * HEIGHT];
    println!("{}", grid[0]);
}
```

`const` 可以写在模块顶层，也可以写在 `impl` 块里，后者用 `类型::名字` 访问：

```riddle
struct Scale { factor: i32 }

impl Scale {
    const DEFAULT: i32 = 1;
}

fun main() {
    println!("{}", Scale::DEFAULT);
}
```

初始化式能用的东西比想象中少：字面量、其它常量、二元运算、无语句的块、元组/数组/结构体字面量、一元运算、字段访问、`as` 和下标。函数调用、`if`、`match`、循环、赋值都不算常量表达式，报 `E0060`。

求值器按有符号 `i128` 建模，再按申明类型截断并查范围，所以下面这些都能折叠：

```riddle
const N: i32 = -1;          // ok
const F: f64 = 1.5;         // ok，浮点常量不参与折叠，也不被拒绝
const S: &str = "hi";       // ok，同上
const C: char = 'x';        // ok
const B: bool = true;       // ok
const A: usize = 2 - 3;     // E0011：结果超出 usize 范围
```

常量值超出申明类型报 `E0011`。求值成功的非负整数常量可以用作数组长度和 const 泛型实参。
