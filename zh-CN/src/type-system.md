# 类型系统

Riddle 的类型系统是静态类型的。每个变量、参数、返回值在编译期都有确定的类型。

## 标量类型

| 类型 | 描述 | 大小（字节） |
|------|------|-------------|
| `i8`, `i16`, `i32`, `i64`, `isize` | 有符号整数 | 1–8, 指针宽度 |
| `u8`, `u16`, `u32`, `u64`, `usize` | 无符号整数 | 1–8, 指针宽度 |
| `f32`, `f64` | 浮点数 | 4–8 |
| `bool` | 布尔值 (`true` / `false`) | 1 |
| `char` | Unicode 字符 | 4 |
| `()` | 单元类型（空） | 0 |
| `!` | Never（发散） | 0 |

`()` 同时是单元类型和它唯一的值；`unit` 不是 Riddle 的类型名。

`!` 没有任何值，用作永不返回的函数的返回类型。标准库的 `panic(message)` 返回 `!`，当前实现直接调用普通 C `abort()`，暂不输出消息，因此 `panic` 可以出现在需要任意值类型的位置：

```riddle
fun value(valid: bool) -> i32 {
    if valid { 42 } else { panic("invalid value") }
}
```

### 字面量后缀

整数和浮点数字面量可以带有类型后缀：

```riddle
let a = 42i32;     // i32
let b = 255u8;     // u8
let c = 1.0f64;    // f64
let d = 3.14f32;   // f32
```

### 整数字面量格式

当前词法层可用的是十进制整数字面量和类型后缀：

```riddle
let dec = 1000000;
let sized = 42usize;
```

### 字符转换

`char` 可以使用 `as` 转换成任意整数类型，结果是该字符的 Unicode 码点；整数不能直接转换成 `char`，因为并非所有整数都是合法的 Unicode 标量值。

```riddle
let code_point = '中' as u32; // 20013
```

## 复合类型

### 可调用值与 `Fn` 能力

命名函数项和每个匿名函数表达式都有独立的具体类型。需要在函数边界接受可调用值时，使用参数位置的 `impl Fn`、`impl FnMut`、`impl FnOnce`，或显式泛型 bound：

```riddle
fun apply(f: impl Fn(i32) -> i32, value: i32) -> i32 {
    f(value)
}

fun apply_twice<F>(mut f: F, value: i32) -> i32
where F: FnMut(i32) -> i32
{
    f(value);
    f(value)
}
```

每个参数位置的 `impl Fn*` 引入一个独立的隐藏泛型类型。显式泛型参数可以让多个位置共享同一个具体类型。返回位置的 `impl Fn*` 隐藏一个具体返回类型；所有返回路径必须产生同一个匿名函数表达式或同一个命名函数项实例。

`Fn` 可以共享调用并满足 `FnMut`、`FnOnce` 要求；`FnMut` 需要可变调用并满足 `FnOnce` 要求；`FnOnce` 调用时消耗可调用值。安全命名函数项自动满足这三种能力。每个泛型实例仍是独立的函数项类型，不安全函数项不会满足安全的 `Fn*` bound。

匿名函数参数推断是单态的，同一个匿名函数值不能分别按不同参数类型调用。编译器根据捕获位置的实际用法推断 `Fn`、`FnMut` 或 `FnOnce`；捕获可精确到静态字段和元组元素。可调用值在后端使用调用地址、可选环境和环境析构地址表示，但调用仍然静态单态化。当前没有 `dyn Fn*`，也不能由用户手动实现 `Fn`、`FnMut` 或 `FnOnce`。

### 数组 `[T; N]`

固定大小数组，元素类型和长度在编译期确定。

```riddle
let nums: [i32; 3] = [1, 2, 3];
let repeated: [i32; 3] = [0; 3];
let mut arr: [i32; 2] = [10, 20];
arr[0] = 99;  // 需要 `mut`
```

固定数组和切片的安全索引会在 C backend 中检查边界；越界会向 stderr 输出 `riddle: index out of bounds` 并终止进程。原始指针索引仍属于 `unsafe`，不做这个检查。需要可恢复的访问时使用切片的 `get` / `get_mut`，它们返回 `Option`。

整数的 `+`、`-`、`*`、位运算和移位按目标整数宽度回绕；除零以及有符号最小值除以 `-1` 会终止进程。移位计数按位宽取模，有符号右移是确定的算术右移。浮点转整数向零截断，`NaN` 转为零，超出目标范围时钳制到最小值或最大值。

数组长度也可以来自 const 泛型参数：

```riddle
struct Buffer<T, const N: usize> {
    data: [T; N],
}

let b: Buffer<i32, 3> = Buffer { data: [1, 2, 3] };
```

### 元组 `(A, B, ...)`

定长异构集合。

```riddle
let pair: (i32, bool) = (42, true);
```

### 原始指针 `*const T` 和 `*mut T`

原始指针是低层指针类型，不参与借用检查：

```riddle
let p: *const i32 = 0usize as *const i32;
let q: *mut i32 = 0usize as *mut i32;
```

当前它们主要用于类型系统和后端映射，还没有像引用那样的高级安全约束。
在文档示例里，把它们理解成“低层、显式、只看类型签名”的指针类型就够了。

### 结构体

带名字段的记录类型。

```riddle
struct Point {
    x: i32,
    y: i32,
}

let p = Point { x: 1, y: 2 };
let x = p.x;  // 字段访问
```

结构体可以带类型参数，也可以用 `where` 子句约束类型参数：

```riddle
trait Marker {}

struct Box<T> {
    value: T,
}

struct Marked<T>
where T: Marker
{
    value: T,
}

let n: Box<i32> = Box { value: 1 };
```

### 枚举

带标签的联合体。变体可以是 unit、元组或结构体形式。

```riddle
enum Option {
    None,
    Some(i32),
}

let val = Option::Some(42);
```

枚举也可以带类型参数和 `where` 子句：

```riddle
enum Option<T> {
    None,
    Some(T),
}

enum Slot<T>
where T: Marker
{
    Some(T),
    None,
}
```

标准库还提供 Rust 风格的 `Option<T>` 和 `Result<T, E>`，并通过 prelude 重导出：

```riddle
let value: Option<i32> = Some(1);
let result: Result<i32, bool> = Ok(1);
```

枚举可以用 unit、tuple 和 struct 变体模式匹配。编译器会递归检查 payload 模式是否穷尽，guard 失败时继续尝试后续 arm，并把 payload 绑定为声明中的实际类型：

```riddle
enum Message {
    Quit,
    Number(i32),
    Pair { left: i32, right: i32 },
}

fun value(message: Message) -> i32 {
    match message {
        Message::Quit => 0,
        Message::Number(number) if number > 10 => number,
        Message::Number(number) => number + 1,
        Message::Pair { left, right } => left + right,
    }
}
```

### 泛型类型参数和 const 参数

当前实现支持函数、结构体、枚举和 `impl` 上的类型参数。类型参数使用 Rust 风格尖括号：

```riddle
struct Pair<A, B> {
    left: A,
    right: B,
}

let p: Pair<i32, bool> = Pair { left: 1, right: true };
```

泛型参数列表中也可以声明 const 参数。当前 const 参数主要用于数组长度，显式类型实参中直接写整数：

```riddle
struct Buffer<T, const N: usize> {
    data: [T; N],
}

let b: Buffer<i32, 3> = Buffer { data: [1, 2, 3] };
```

嵌套类型参数不需要在 `>` 之间插入空格：

```riddle
let b: Box<Box<Box<i32>>> = Box {
    value: Box {
        value: Box { value: 1 },
    },
};
```

当前泛型能力偏向单态化。函数和 impl 的类型参数支持 `<T: Trait>`、`<T: A + B>`、`Trait<Assoc = Type>` 和 `where T: Trait` bound；结构体和枚举可以使用 `where` 子句约束类型参数：

```riddle
trait Marker {}

struct Box<T>
where T: Marker
{
    value: T,
}
```

bound 提供的 trait 方法会在单态化后静态分派。

函数也可以带简单类型参数，调用时由实参类型推断：

```riddle
fun id<T>(value: T) -> T {
    value
}

let n = id(1);
```

## 引用类型 `&T` 和 `&mut T`

引用指向一个值而不获取所有权。

- `&T` — 共享（不可变）引用
- `&mut T` — 可变（独占）引用

```riddle
let x = 42;
let r: &i32 = &x;        // 共享引用
let rm: &mut i32 = &mut x; // 可变引用
```

### 瘦指针与胖指针

对**定长类型**（大多数类型）的引用是**瘦指针**：单个机器字，包含值的地址。

对**不定长类型**（`str` 和 `[T]`）的引用是**胖指针**：两个机器字，包含地址和长度元数据。

| 类型 | 指针类别 | C 表示 |
|------|---------|-----------------|
| `&i32` | 瘦（8 字节） | `int32_t*` |
| `&str` | 胖（16 字节） | 内部为 `struct { const char* ptr; size_t len; }`；C 导入边界使用 `const char*` |
| `&[T]` / `&mut [T]` | 胖（16 字节） | 内部为 `struct { void* ptr; size_t len; }` |

## 定长与不定长类型

一个类型如果在编译期已知其大小，则称为**定长（sized）**。大多数类型都是定长的。

### 不定长类型

`str` 和 `[T]` 是不定长类型。不定长类型不能作为局部变量、参数、返回值或普通字段，必须作为引用或原始指针的目标使用；裸类型也可以作为 `impl` 的目标。

```riddle
// let s: str = "hello";  // 错误: str 是不定长的
let s: &str = "hello";    // 正确: &str 是胖指针
let values = [1, 2, 3];
let slice: &[i32] = &values; // 正确: 数组引用自动携带长度
```

`Sized` 概念确保栈分配、移动语义和调用约定始终处理已知大小。切片提供 `len`、`is_empty`、`get`、`get_mut`、`iter` 和 `iter_mut`；共享和可变切片引用都可用于 `for`。`str` 和 `&str` 的具体用法见 [字符串](./strings.md)。

## C ABI 映射

当 Riddle 函数通过 `--backend c` 编译为 C 时，类型映射如下：

| Riddle | C |
|--------|---|
| `i8` / `i16` / `i32` / `i64` | `int8_t` / `int16_t` / `int32_t` / `int64_t` |
| `u8` / `u16` / `u32` / `u64` | `uint8_t` / `uint16_t` / `uint32_t` / `uint64_t` |
| `isize` / `usize` | `ptrdiff_t` / `size_t` |
| `bool` | `bool` |
| `char` | `uint32_t` |
| `()` | `void` |
| `&T`（定长） | `T*` |
| `&[T]` / `&mut [T]` | 内部 `riddle_slice` 胖指针；C extern 不接受，需分别传指针和长度 |
| `*const T` | `T*` |
| `*mut T` | `T*` |
| `[T; N]` | C 数组，作为字段时写成 `T field[N]`；`N = 0` 使用严格 C11 兼容的占位存储，逻辑长度仍为零 |
| `enum` | 带 `tag` 和 payload 字段的 C `struct` |
| `Fn*` 可调用值（内部表示） | `{ call, env, drop }` 闭包结构；`call` 与 `drop` 接收隐藏环境参数 |
| `&str`（Riddle 内部） | `struct { const char* ptr; size_t len; }` |
| `&str`（C 导入参数/返回值） | `const char*` |
| `&str`（带函数体的 C 导出定义） | `riddle_str { ptr, len }` |

## 属性

Riddle 支持 Rust 风格外部属性：

```riddle
#[note]
struct Item {
    #[field]
    value: i32,
}

fun id(#[param] value: #[ty] i32) -> i32 {
    #[expr] value
}
```

普通属性会保留在 AST/HIR 中。当前编译器识别 `#[lang = "..."]`，用于把标准库中的特殊 trait 标记为内置项。
