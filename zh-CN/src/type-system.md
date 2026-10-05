# 数据类型

Riddle 是静态类型语言：每个绑定、参数、返回值和表达式都有编译期类型，大部分局部绑定可以推断。

## 标量

| 类型 | 含义 |
| --- | --- |
| `i8` `i16` `i32` `i64` `isize` | 有符号整数 |
| `u8` `u16` `u32` `u64` `usize` | 无符号整数 |
| `f32` `f64` | 浮点数 |
| `bool` | `true` / `false` |
| `char` | Unicode 标量值 |
| `()` | unit，也是空元组 |
| `!` | never，表示不会正常产生值 |

`isize` 和 `usize` 跟随目标指针宽度。字面量和常量值的范围检查用的是所选目标（`riddlec --target`、`RIDDLE_TARGET`，或 Clue 的 `[build].target`）的宽度，不是运行编译器的机器：32 位 triple 下 `4294967296usize` 报 `E0011`，64 位 triple 下合法。`riddle run` 和 `riddle repl` 走的 MIR 解释器在任何宿主上都把 `usize` 当成一个 8 字节字，所以这条路径固定按 64 位检查。没有 `i128` / `u128` / `f16` / `f128`：词法器接受这些后缀，类型检查报 `E0011`。

数值字面量可以带进制、下划线和类型后缀：

```riddle
fun main() {
    let integer = 42i32;
    let byte = 255u8;
    let mask = 0xff_00u16;
    let permissions = 0o755;
    let flags = 0b1010_0101u8;
    let single = 3.14f32;
    let double = 1.0f64;
    println!("{} {} {} {} {} {} {}", integer, byte, mask, permissions, flags, single, double);
}
```

整数运算按位宽回绕；除零和有符号最小值除 `-1` 会终止进程；移位计数按位宽取模；有符号右移是算术右移。

`char as 整数` 得到 Unicode 码点，`u8 as char` 也允许。其他整数不能直接转成 `char`。

## 元组

元组是定长异构值，用逗号区分于分组括号，字段按位置访问：

```riddle
fun main() {
    let pair: (i32, bool) = (42, true);
    let single: (i32,) = (42,);
    let unit: () = ();
    let (number, flag) = pair;
    let _: () = unit;
    println!("{} {} {}", number, flag, single.0);
}
```

`(2)` 只是整数 `2`，`(2,)` 才是单元素元组。

## 数组、切片与不定长类型

`[T; N]` 是长度写在类型里的数组，`[T]` 是长度未知的切片：

```riddle
fun main() {
    let values: [i32; 3] = [1, 2, 3];
    let zeros: [i32; 3] = [0; 3];
    let slice: &[i32] = &values;
    println!("{} {}", values[0], slice[1]);
}
```

数组可以直接索引和 `for` 遍历，切片方法（`len`、`is_empty`、`get`、`iter` 等）也能在数组值上直接调用：接收者按值传到 `impl [T]` 的方法时需要 `{指针, 长度}` 这一对，编译器会在调用点把数组提升成切片，`values.len()` 和 `(&values).len()` 等价。数组长度是类型的一部分，所以 `[i32; 3]` 到 `&[i32]` 的转换只影响传参方式，不改变数组本身。

`str`、`[T]`、`dyn Trait` 是不定长类型，只能出现在引用、原始指针或 `impl` 目标位置；对它们的引用是两字胖指针（数据地址 + 长度）。

数组长度可以来自 `const` 或 const 泛型参数：

```riddle
struct Buffer<T, const N: usize> {
    data: [T; N],
}

fun main() {
    let buffer: Buffer<i32, 3> = Buffer { data: [1, 2, 3] };
    println!("{}", buffer.data[2]);
}
```

## 引用与原始指针

`&T` 是共享引用，`&mut T` 是可变引用，两者都遵守借用规则，见[引用、借用与逃逸](./references-and-escape.md)。

`*const T` / `*mut T` 是给 FFI 和底层实现用的原始指针，不参与借用检查，解引用要在 `unsafe` 里，见 [FFI 与 C 后端](./ffi-and-tooling.md)。

## 字符串

`str` 是 UTF-8 内容，`&str` 是指向它的胖指针，字符串字面量就是 `&str`：

```riddle
fun main() {
    let greeting: &str = "hello";
    let raw: &str = r#"say "hi""#;
    println!("{} {} {} {} {}", greeting, raw, greeting.len(), greeting.is_empty(), greeting.as_bytes()[0]);
}
```

`len()` 返回 UTF-8 字节数而不是字符数。`&str` 可以直接 `for` 遍历，按 UTF-8 解码产出 `char`。可增长的 `String` 见[集合](./collections.md)。

## 结构体、枚举与泛型

`struct` 和 `enum` 定义名义类型，参数化写法不需要在 `>` 之间加空格：

```riddle
struct Pair<A, B> {
    first: A,
    second: B,
}

enum Slot<T> {
    Empty,
    Value(T),
}

fun main() {
    let slot: Slot<Pair<i32, bool>> = Slot::Value(Pair { first: 1, second: true });
    match slot {
        Slot::Value(pair) => println!("{} {}", pair.first, pair.second),
        Slot::Empty => println!("empty"),
    }
}
```

## 类型转换

隐式转换只有几种：字面量到期望的数值类型、`&[T; N]` 到 `&[T]`（可变性必须一致）、具体类型到 `&dyn Trait` / `dyn Trait`、`&dyn Child` 到 `&dyn Parent`。没有 `i32` 到 `i64`、没有 `i32` 到 `f64`、没有 `char` 到 `u32`。

`as` 支持这些组合：

| 源 | 目标 |
| --- | --- |
| 整数 | 整数、浮点、`bool`、原始指针 |
| 浮点 | 整数、浮点 |
| `bool`、`char` | 整数 |
| `u8` | `char` |
| 原始指针 | 原始指针 |
| `&T` | `*const T` / `*mut T`（`T` 必须 sized；要 `*mut` 时源必须是 `&mut`） |

其余组合报 `E0012`。原始指针不能转回整数。裸指针与切片、`&[u8]` 与 `&str` 之间的布局转换要写在 `unsafe` 里。

```riddle
fun main() {
    let wide = 1i32 as i64;
    let back = wide as i32;
    let code = '中' as u32;
    let letter = 65u8 as char;
    println!("{} {} {} {}", wide, back, code, letter);
}
```
