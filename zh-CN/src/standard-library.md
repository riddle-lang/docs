# 常用标准库

Riddle 会自动加载随编译器附带的标准库。prelude 提供日常使用频率最高的类型、变体和 trait；集合、解析、时间、格式化器与底层输出函数需要从对应模块显式导入。

集合（`String`、`Vector`、`HashMap` 等）的用法在[集合](./collections.md)一章；迭代协议在[闭包与迭代器](./functional.md)。本页是 API 与行为的速查。

## Prelude 中有什么

普通程序可以直接使用：

- `Option`、`Result`、`Some`、`None`、`Ok`、`Err`；
- `String`、`Vector`；
- `Copy`、`Clone`、`Drop`、`Default`、`Into`、`drop`、`panic` 和比较 trait；
- 标准 `Debug`、`Clone`、`Copy`、`Default`、`Hash`、`PartialEq`、`Eq`、`PartialOrd`、`Ord` 派生；
- `Iterator` 与 `IntoIterator` 协议。

`print!` 与 `println!` 不是 prelude 条目，而是编译器直接提供的内置宏，不需要导入即可使用。

同名并不表示与 Rust 标准库具有完整相同的 API。应以本页和[当前工具链状态](./compiler-status.md)列出的实现为准。

## 格式化输出

`{}` 要求参数实现 `Display`，`{:?}` 要求实现 `Debug`：

```riddle
#[derive(Debug)]
struct Point {
    x: i32,
    y: i32,
}

fun main() {
    let point = Point { x: 3, y: 4 };
    println!("point={:?}", point);
    println!("x={} y={}", point.x, point.y);
}
```

格式宏当前支持多个 `{}` / `{:?}`、尾随逗号以及 `{{` / `}}`。索引参数、命名参数和其他格式说明符尚未实现。

`print!` / `println!` 通过 `std::io::{print, println, print_debug}` 和 `std::fmt::{Debug, Display, Formatter, Result}` 支持字符串、布尔、字符、整数和浮点标量；`Display` 输出 UTF-8 字符，浮点数固定输出 6 位小数。字符串和字符的 `Debug` 输出会添加引号并转义 `\\`、`\"`、`\n`、`\r`、`\t`、`\0`。格式化 trait 和底层输出函数不在 prelude 中。

## 标准派生

编译器内置 `Debug`、`Clone`、`Copy`、`Default`、`Hash`、`PartialEq`、`Eq`、`PartialOrd` 和 `Ord` 派生，可用于结构体和 unit、tuple、named 三类枚举变体。`Clone`、`Default`、`Hash` 和比较派生按字段声明顺序工作；`PartialEq` 在枚举变体不同时返回 `false`；`PartialOrd` / `Ord` 先比较枚举变体声明顺序，再按 payload 做字典序比较，`PartialOrd` 会原样传播字段返回的 `None`；`Copy` 和 `Eq` 生成标记 impl。泛型类型参数会自动获得相应 trait bound，例如 `Wrapper<T>` 的 `Clone` impl 要求 `T: Clone`。

结构体的 `Default` 会逐字段调用 `Default::default()`。枚举必须用 `#[default]` 标记恰好一个 unit 变体：

```riddle
#[derive(Default, PartialEq, Eq, PartialOrd, Ord)]
enum State {
    #[default]
    Idle,
    Running(i32),
}
```

`Copy` 派生仍会经过字段和枚举 payload 校验。比较 trait 保持标准库的父 trait 关系，因此通常按 `PartialEq, Eq, PartialOrd, Ord` 一起派生；只派生 `Eq`、`PartialOrd` 或 `Ord` 而没有所需的父 trait impl 会产生类型错误。

## 解析与时间

当前标准库提供两个小型入口：

```riddle
use std::parse::parse_i32;
use std::time::time_now;

fun main() {
    let value = parse_i32("42").unwrap_or(0);
    let now = time_now();
    println!("value={} now={}", value, now);
}
```

`parse_i32` 只解析十进制 `i32`，目前不报告整数溢出。`time_now` 转发到 C `time` 并返回 `i64`。

## 完整 API 清单

| 模块 | 内容 |
|------|------|
| `std::option::Option<T>` | `is_some`、`is_none`、`unwrap_or`、`or` |
| `std::result::Result<T, E>` | `is_ok`、`is_err`、`unwrap_or`、`ok`、`err` |
| `std::string::String` | `new`、`from_str`、`as_str`、`len`、`capacity`、`is_empty`、`push_str`、`clear` |
| `std::str`（impl） | `len`、`is_empty`、`as_bytes`，以及按 Unicode `char` 遍历的 `StrIter` |
| `std::vector::Vector<T>` | `new`、`len`、`capacity`、`is_empty`、`push`、`pop`、`get`、`get_mut`、`swap`、`clear`、`as_slice`、读写下标和按值迭代 |
| `std::collections` | `HashMap`、`HashSet`（键需 `Hash + Eq`）、`TreeMap`、`TreeSet`（键需 `Ord`） |
| `std::iter` | `Iterator`、`IntoIterator` 协议 |
| `std::slice` | `SliceIter`、`SliceIterMut`，以及 `[T]` 的长度、边界检查访问、原始指针访问和借用迭代 |
| `std::array` | 按值、共享借用和可变借用数组迭代器 |
| `std::ops` | `Range`、`range(start, end)`、`Drop`，以及算术、位运算、移位、复合赋值和 `Index` / `IndexMut` trait |
| `std::marker` | `Copy` |
| `std::clone` | `Clone` |
| `std::cmp` | `Ordering`、`PartialEq`、`Eq`、`PartialOrd`、`Ord` |
| `std::default` | `Default`，为标量、`Option<T>`、`String` 和 `Vector<T>` 提供默认值 |
| `std::convert` | `Into<T>`，`?` 错误传播使用的错误转换协议 |
| `std::hash` | `Hash`，通过共享借用为标量提供确定性的 `usize` 哈希值 |
| `std::fmt` / `std::io` | `Debug`、`Display`、`Formatter` 和底层输出函数 |
| `std::parse` / `std::time` | `parse_i32`、`time_now` |

`Vector<T>` 会拒绝零大小元素并检查容量乘法溢出；下标越界调用 `panic`。错误传播的完整规则见[错误处理](./error-handling.md)。
