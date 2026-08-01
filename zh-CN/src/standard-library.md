# 常用标准库

Riddle 会自动加载随编译器附带的标准库。prelude 提供日常使用频率最高的类型、变体和 trait；集合、解析、时间、格式化器与底层输出函数需要从对应模块显式导入。

集合（`String`、`Vector`、`HashMap` 等）的用法在[集合](./collections.md)一章；迭代协议在[闭包与迭代器](./functional.md)。本页是 API 与行为的速查。

## Prelude 中有什么

普通程序可以直接使用：

- `Option`、`Result`、`Some`、`None`、`Ok`、`Err`；
- `String`、`Vector`；
- `Copy`、`Clone`、`Drop`、`Default`、`Into` 和比较 trait；
- `drop`、`panic`、`print!`、`println!` 与标准 `#[derive(Debug)]`；
- `Iterator` 与 `IntoIterator` 协议。

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
