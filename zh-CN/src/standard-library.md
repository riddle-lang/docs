# 常用标准库

Riddle 会自动加载随编译器附带的标准库。prelude 提供日常使用频率最高的类型、变体和 trait；集合、解析、时间、格式化器与底层输出函数需要从对应模块显式导入。

集合（`String`、`Vector`、`HashMap` 等）的用法在[集合](./collections.md)一章；迭代协议在[闭包与迭代器](./functional.md)。本页是 API 与行为的速查。

## Prelude 中有什么

普通程序可以直接使用：

- `Option`、`Result`、`Some`、`None`、`Ok`、`Err`；
- `String`、`Vector`；
- `Copy`、`Clone`、`Drop`、`Default`、`Into`、`drop` 和比较 trait；
- 标准 `Debug`、`Clone`、`Copy`、`Default`、`Hash`、`PartialEq`、`Eq`、`PartialOrd`、`Ord` 派生；
- `Iterator` 与 `IntoIterator` 协议。

函数式标准宏不属于 prelude，也不需要导入。当前包括 `format!`、`panic!`、`print!`、`println!`，断言宏 `assert!`、`assert_eq!`、`assert_ne!`、`debug_assert!`、`debug_assert_eq!`、`debug_assert_ne!`，以及 `todo!`、`unimplemented!`、`unreachable!` 和向量字面量 `vec!`。

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

格式宏当前支持多个 `{}` / `{:?}`、`{0}` 位置参数（可重复引用任意参数）、`{name}` 命名捕获（隐式读取调用处的同名局部变量）、尾随逗号以及 `{{` / `}}`；格式串的语法、说明符合法性与命名捕获的存在性会在编译期校验，但位置索引是否越界、实参数量是否足够，以及未实现的宽度、对齐和填充说明符不会在编译期拒绝——例如 `{1}`、参数不足或 `{:>5}` 会静默通过并在运行时输出空内容。

`print!` / `println!` 通过隐藏的标准库输出入口和 `std::fmt::{Debug, Display, Formatter, Result}` 支持字符串、布尔、字符、整数和浮点标量；`Display` 输出 UTF-8 字符，浮点数固定输出 6 位小数。字符串和字符的 `Debug` 输出会添加引号并转义 `\\`、`\n`、`\r`、`\t`、`\0`；字符串转义双引号 `\"`，字符转义单引号 `\'`。格式化 trait 不在 prelude 中，底层输出入口不属于用户 API。

`panic!()` 使用消息 `explicit panic`；`panic!("value={}", value)` 与其他格式宏共享编译期格式串检查，并保留宏调用位置用于 panic 诊断。底层 `std::panic` 模块及其 `panic(message)` 入口仅供标准库和编译器使用，不会进入普通补全。

`assert_eq!` / `assert_ne!` 只求值左右表达式一次，失败时显示两侧的 `Debug` 值；所有断言宏都支持自定义格式化消息。`todo!`、`unimplemented!` 和 `unreachable!` 返回 `!` 并产生对应的 panic 消息。Riddle 当前没有按构建配置关闭 debug assertion 的能力，因此 `debug_assert!`、`debug_assert_eq!` 和 `debug_assert_ne!` 始终执行。

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

`std::parse` 提供一组溢出安全的解析入口，`std::time` 提供时间戳与休眠：

```riddle
use std::parse::parse_i32;
use std::time::{sleep, Duration, time_now};

fun main() {
    let value = parse_i32("42").unwrap_or(0);
    println!("value={} now={}", value, time_now());
    sleep(Duration::from_millis(50));
}
```

`parse_i32` / `parse_i64` / `parse_u64` / `parse_usize` 只解析十进制；空串、单独的负号、非法字符和超出目标范围的输入返回 `None`，`parse_with_radix` 支持 2–36 进制。`time_now` 转发到 C `time` 并返回 `i64`；`Duration` 提供 `from_secs` / `from_millis` / `as_secs` / `as_millis`，`sleep` 转发到运行时垫片。

## 进程参数

`std::env::args_os()` 返回 `Vector<std::ffi::OsString>`，无损保留宿主参数。Unix 保存原始字节；Windows 直接解析 `GetCommandLineW`，使用 WTF-8 保存 UTF-16，因此孤立代理项也不会丢失。`OsString::as_encoded_bytes()` 只适合在同一平台和版本内传递，`into_string()` 在参数不是有效 Unicode 时返回原值。

`std::env::args()` 返回 `Vector<String>`；只要任一参数不能转换为 Unicode，该函数就会 panic。需要处理任意系统参数时应使用 `args_os()`。

## 完整 API 清单

| 模块 | 内容 |
|------|------|
| `std::option::Option<T>` | `is_some`、`is_none`、`unwrap`、`expect`、`unwrap_or`、`unwrap_or_else`、`map`、`map_or`、`and_then`、`and`、`or`、`or_else` |
| `std::result::Result<T, E>` | `is_ok`、`is_err`、`unwrap`、`expect`、`unwrap_or`、`unwrap_or_else`、`map`、`map_or`、`map_err`、`and_then`、`and`、`ok`、`err` |
| `std::ffi::OsString` | `new`、`from_str`、`as_encoded_bytes`、`from_encoded_bytes_unchecked`（unsafe）、`into_string`、`len`、`is_empty` |
| `std::env` | `args_os`、`args` |
| `std::string::String` | `new`、`from_str`、`from_utf8`、`as_str`、`as_bytes`、`len`、`capacity`、`is_empty`、`push_str`、`push_char`、`clear`、`slice`、`trim`、`contains`、`find`、`starts_with`、`ends_with`、`split`、`replace`、`to_ascii_uppercase`、`to_ascii_lowercase` |
| `std::str`（impl） | `len`、`is_empty`、`as_bytes`、`contains`、`find`、`starts_with`、`ends_with`、`slice`、`trim`、`split`、`replace`、`to_ascii_uppercase`、`to_ascii_lowercase`，以及按 Unicode `char` 遍历的 `StrIter` |
| `std::vector::Vector<T>` | `new`、`len`、`capacity`、`is_empty`、`push`、`pop`、`insert`、`remove`、`get`、`get_mut`、`swap`、`sort`、`contains`、`retain`、`clear`、`as_slice`、`as_ptr`、`iter`、`iter_mut`、`from_iterator`、`from_elem`、读写下标和按值迭代 |
| `std::collections` | `HashMap`、`HashSet`（键需 `Hash + Eq`）、`TreeMap`、`TreeSet`（键需 `Ord`），四类集合均提供 `remove`，`HashMap` 另有 `get_or_insert` |
| `std::iter` | `Iterator`、`IntoIterator` 协议；`Iterator` 的默认方法含 `map`、`filter`、`chain`、`inspect`、`count`、`nth`、`fold`、`for_each`、`all`、`any`、`find`、`position` 和 `collect`；`std::iter` 另提供急切的 `map_into` / `filter_into`，适配器 `enumerate` / `take` / `skip` / `take_while` / `skip_while` / `zip`，`min` / `max`，以及 `DoubleEndedIterator` |
| `std::slice` | `SliceIter`、`SliceIterMut`，以及 `[T]` 的长度、边界检查访问、原始指针访问和借用迭代 |
| `std::array` | 按值、共享借用和可变借用数组迭代器 |
| `std::fs` | `FsFile`（`open`、`create`、`append`、`read`、`write`、`flush`、`read_to_string`）、`exists`、`metadata`、`read_dir`，以及整文件 `read_to_string` / `write` |
| `std::random` | `random_u32`、`random_u64`、`random_bool`、`random_below` |
| `std::ops` | `Range`、`RangeInclusive`、`range(start, end)`、`range_inclusive(start, end)`、`Drop`，以及算术、位运算、移位、复合赋值和 `Index` / `IndexMut` trait |
| `std::marker` | `Copy` |
| `std::clone` | `Clone` |
| `std::cmp` | `Ordering`、`PartialEq`、`Eq`、`PartialOrd`、`Ord` |
| `std::default` | `Default`，为标量、`Option<T>`、`String` 和 `Vector<T>` 提供默认值 |
| `std::convert` | `Into<T>` 与 `From<T>`，`?` 错误传播使用的错误转换协议 |
| `std::hash` | `Hash`，通过共享借用为标量提供确定性的 `usize` 哈希值 |
| `std::fmt` / `std::io` | `Debug`、`Display`、`Formatter` 和底层输出函数 |
| `std::parse` | `parse_i32`、`parse_i64`、`parse_u64`、`parse_usize`、`parse_with_radix` |
| `std::time` | `time_now`、`Duration`（`from_secs`、`from_millis`、`as_secs`、`as_millis`）和 `sleep` |

`Vector<T>` 会拒绝零大小元素并检查容量乘法溢出；下标越界调用 `panic`。错误传播的完整规则见[错误处理](./error-handling.md)。
