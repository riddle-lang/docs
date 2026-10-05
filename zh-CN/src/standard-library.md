# 常用标准库

标准库随 `riddlec` 一起编译，不需要在 `Clue.toml` 里声明依赖，名字都以 `std::` 开头。一部分通过 prelude 直接可用，其余要显式 `use`。

## prelude 里有什么

prelude 精确包含这些名字：`Option`、`Some`、`None`、`Result`、`Ok`、`Err`、`String`、`Vector`、`Clone`、`Copy`、`Default`、`Into`、`Drop`、`drop`、`Eq`、`Ord`、`PartialEq`、`PartialOrd`、`Iterator`、`IntoIterator`。

不在 prelude：`From`、`Hash`、`Display`、`Debug`、`Formatter`、`Ordering`、`Range` 与 `range`，四个集合类型，以及 `std::parse`、`std::fs`、`std::io`、`std::env`、`std::time`、`std::random` 里的全部内容。派生宏也不经过 prelude，`#[derive(Debug)]` 展开成 `crate::std::fmt::Debug` 全路径。

```riddle
use std::collections::HashMap;
use std::parse::parse_i32;

fun main() {
    let mut counts: HashMap<i32, i32> = HashMap::new();
    counts.insert(1, parse_i32("2").unwrap_or(0));
    println!("{:?}", counts.get(&1).is_some());
    println!("{}", counts.len());
}
```

## 格式宏与说明符

函数宏在编译期展开，不需要导入：`assert`、`assert_eq`、`assert_ne`、`debug_assert`、`debug_assert_eq`、`debug_assert_ne`、`format`、`panic`、`print`、`println`、`todo`、`unimplemented`、`unreachable`、`vec`，以及过程宏用的 `quote`。没有 `write!`、`writeln!`、`stringify!`、`concat!`、`matches!`。

占位符只有四种形态，格式串必须是字符串字面量：

| 占位符 | 要求 |
| --- | --- |
| `{}`、`{:?}` | 对应实参实现 `Display` / `Debug` |
| `{0}`、`{0:?}` | 按位置引用实参，可以重复引用同一个实参 |
| `{name}`、`{name:?}` | 读取调用处同名局部变量，不是命名实参 |

宽度、精度、进制和对齐都不支持，`{:>5}` 报 `E0400`；实参比占位符少也报 `E0400`。`println!("{a}", a = 1)` 这种命名实参写法不可用，报 `E0050`：

```riddle
fun main() {
    println!("[{:>5}]", 1i32);      // E0400
}
```

```riddle
fun main() {
    println!("{} {}", 1i32);        // E0400
}
```

`Display` 为 `&str`、`String`、`bool`、`char`、全部整数、`f32`/`f64` 和 2 到 6 元组实现。`Vector`、`HashMap`、`Option`、`Result` 只有 `Debug`，`println!("{}", values)` 报 `E0035`；引用同样不参与自动解引用，`key: &i32` 用 `{}` 或 `{:?}` 都报 `E0035`，要先写 `*key`：

```riddle
fun main() {
    let values = vec![1, 2, 3];
    println!("{:?}", values);
    println!("{}", values);      // E0035
}
```

浮点的 `{}` 和 `{:?}` 输出相同：固定 6 位小数、直接截断，特殊值输出 `NaN`、`inf`、`-inf`、`-0.000000`。字符串和字符的 `Debug` 加引号并转义 `\n`、`\r`、`\t`、`\0`、反斜杠和引号本身。

```riddle
fun main() {
    println!("{} {:?}", 1.5f64, 1.5f64);       // 1.500000 1.500000
    println!("{}", 0.9999999f64);               // 0.999999
    println!("{:?}", "a\nb");                   // "a\nb"
    println!("{:?}", 'x');                      // 'x'
    println!("{}", (1i32, 2i32));               // (1, 2)
}
```

`assert_eq!` 和 `assert_ne!` 只求值两侧一次，失败时打印两侧的 `Debug` 值，所有断言宏都接受自定义消息。`todo!`、`unimplemented!`、`unreachable!` 以固定消息 panic。`debug_assert` 系列与对应的 `assert` 系列行为相同，当前没有按构建配置关闭它们的开关。`println!()` 只输出换行，`print!()` 什么都不输出；写 stderr 用 `std::io` 的 `eprint`、`eprintln`。

## 标准派生

编译器内置 9 个派生宏：`Debug`、`Clone`、`Copy`、`Default`、`Hash`、`PartialEq`、`Eq`、`PartialOrd`、`Ord`，可用于结构体和 unit、tuple、named 三类枚举变体。

- `Clone`、`Default`、`Hash` 与比较按字段声明顺序工作；
- `PartialEq` 在变体不同时返回 `false`；
- `PartialOrd` 和 `Ord` 先按变体声明顺序、再按 payload 字典序比较，`PartialOrd` 原样传播字段返回的 `None`；
- `Copy` 和 `Eq` 生成标记 impl，但仍然校验字段：`#[derive(Copy)]` 遇到 `String` 字段报 `E0041`，只派生 `Eq` 而没有 `PartialEq` 报 `E0036`；
- 泛型参数自动获得相应 bound，`Wrapper<T>` 的 `Clone` impl 要求 `T: Clone`。

```riddle
#[derive(Clone, Debug, PartialEq, Eq)]
struct Config { retries: i32, label: String }

#[derive(Default, Debug)]
struct Settings { retries: i32 }

#[derive(Default, PartialEq, Eq, PartialOrd, Ord, Debug)]
enum State {
    #[default]
    Idle,
    Running(i32),
}

fun main() {
    let a = Config { retries: 3, label: String::from_str("x") };
    let b = a.clone();
    println!("{:?} {}", b, a == b);

    let settings: Settings = Default::default();
    println!("{}", settings.retries);

    let state: State = Default::default();
    println!("{}", state == State::Idle);
}
```

结构体的 `Default` 逐字段调用 `Default::default()`；枚举必须用 `#[default]` 标记恰好一个 unit 变体，否则展开阶段报 `E0400`。调用时写 `Default::default()` 并靠绑定的类型标注选择实现，`Settings::default()` 这种关联函数写法不可用。

```riddle
#[derive(Default)]
enum State {
    Idle,
    Running(i32),
}

fun main() {
    let state: State = Default::default();      // E0400
    println!("{}", state == State::Idle);
}
```

## 解析

`std::parse` 只解析整数，不解析浮点：

| 函数 | 返回 |
| --- | --- |
| `parse_i32(&str)`、`parse_i64(&str)`、`parse_u64(&str)`、`parse_usize(&str)` | `Result<T, ParseIntError>` |
| `parse_with_radix(&str, radix: u32)` | `Result<i64, ParseIntError>`，`radix` 取 2 到 36 |

`ParseIntError::kind(&self) -> &ParseIntErrorKind` 给出四种原因：`Empty`、`InvalidDigit`、`PosOverflow`、`NegOverflow`。没有 `FromStr` trait，也没有 `"12".parse::<i32>()` 这种写法。

```riddle
use std::parse::{parse_i32, parse_with_radix, ParseIntErrorKind};

fun main() {
    let decimal = parse_i32("42").unwrap_or(0);
    let hex = parse_with_radix("ff", 16u32).unwrap_or(0);
    match parse_i32("12x") {
        Ok(number) => println!("{}", number),
        Err(reason) => match reason.kind() {
            ParseIntErrorKind::Empty => println!("empty"),
            ParseIntErrorKind::InvalidDigit => println!("invalid digit"),
            ParseIntErrorKind::PosOverflow => println!("overflow"),
            ParseIntErrorKind::NegOverflow => println!("underflow"),
        },
    }
    println!("{} {}", decimal, hex);
}
```

## 时间与随机

`std::time` 里 `time_now() -> i64` 返回秒级时间戳，`Duration` 由 `from_secs(u64)`、`from_millis(u64)` 构造，`as_secs`、`as_millis` 取回数值，`sleep(Duration)` 阻塞当前线程。`Duration` 没有 `Debug`、`Clone`、`PartialEq`，也没有算术运算符；没有 `Instant` 和 `SystemTime`。

`std::random` 提供 `random_u32()`、`random_u64()`、`random_bool()` 和 `random_below(bound: u32)`；`bound` 为 0 时返回 0，否则取模，不保证无偏。

```riddle
use std::time::{sleep, time_now, Duration};

fun main() {
    let start = time_now();
    sleep(Duration::from_millis(20));
    println!("{} {}", start <= time_now(), Duration::from_secs(2).as_millis());
}
```

## 进程参数

`std::env::args_os() -> Vector<OsString>` 无损保留宿主传入的参数，`std::env::args() -> Vector<String>` 是它的 Unicode 版本，任一参数不是有效 Unicode 时 panic（消息 `process argument is not valid Unicode`）。第一个参数是程序自身，用 `riddle run` 跑脚本时是脚本路径。

参数是 `OsString`，方法有 `new()`、`from_str(&str)`、`as_encoded_bytes(&self) -> &[u8]`、`unsafe from_encoded_bytes_unchecked(&[u8])`、`len`、`is_empty` 和 `into_string(self) -> Result<String, OsString>`。没有 `OsStr`、`CString`，也没有 `Hash`、`Ord`。

```riddle
use std::env::args_os;

fun main() {
    let args = args_os();
    for arg in &args {
        println!("{}", arg.len());
    }
}
```

遍历要写 `for arg in &args`：`args_os().iter()` 返回 `SliceIter`，它没有 `IntoIterator`，放进 `for` 报 `E0035`。

## 模块地图

| 模块 | 内容 |
| --- | --- |
| `std::option` / `std::result` | `Option`、`Result` 及其方法 |
| `std::vector` / `std::string` | `Vector`、`String`，见[集合](./collections.md) |
| `std::collections` | `HashMap`、`HashSet`、`TreeMap`、`TreeSet`、`Entry`，见[集合](./collections.md) |
| `std::iter` | `Iterator`、`IntoIterator`、适配器与自由函数，见[匿名函数与迭代器](./functional.md) |
| `std::ops` | 运算符 trait、`Drop`、`Range`、`range`、`range_inclusive` |
| `std::cmp` / `std::hash` / `std::clone` / `std::default` / `std::convert` / `std::marker` | 比较、哈希、克隆、默认值、`Into`/`From`、`Copy` |
| `std::fmt` | `Display`、`Debug`、`Formatter`、`Error` |
| `std::io` | `eprint`、`eprintln`、`read_line`、`BufReader`、`ReadError` |
| `std::fs` | `FsFile`、`read_to_string`、`write`、`exists`、`remove`、`rename`、`copy`、`metadata`、`read_dir`、`FsError` |
| `std::env` / `std::ffi` | `args`、`args_os`、`OsString` |
| `std::parse` / `std::time` / `std::random` / `std::process` | 整数解析、时间与休眠、随机数、`exit` |
| `std::mem` | `drop`、`replace`、`size_of`、`swap`、`take` |
| `std::char` / `std::slice` / `std::array` | ASCII 判断与大小写转换、切片与数组方法 |

没有 `std::vec`（模块名是 `std::vector`）、`std::num`、`std::debug`、`std::thread`、`std::sync`、`std::path`、`std::error`。

## 完整 API 文档

`clue doc` 生成当前包的 HTML 参考：先跑一次完整检查，通过后写到 `<PATH>/.clue/doc/index.html`，每个模块一页，页名把模块路径的 `::` 换成 `-`（例如 `std-collections-hash_map.html`）。默认只收录 `pub` 条目，`--document-private-items` 放开过滤；检查不干净时报 `documentation requires a clean check` 并且不写文件。标准库的现成产物在 `std/.clue/doc/`，命令行细节见 [Clue 构建器](./clue.md)。
