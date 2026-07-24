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

`!` 没有任何值，用作永不返回的函数的返回类型。标准库的 `panic(message)` 返回 `!`；C 后端会把消息写入标准错误并调用 `abort()`，因此 `panic` 可以出现在需要任意值类型的位置：

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

## 复合类型

### 函数类型 `fun(A, B) -> R`

函数类型描述参数和返回值相同的可调用值：

```riddle
let inc: fun(i32) -> i32 = fun(x) { x + 1 };
let answer = inc(41);
```

函数类型按签名结构匹配，命名函数也可以转换成相同签名的函数值。匿名函数参数推断是单态的，同一个值不能分别按不同类型调用。

函数值在运行时由调用地址、可选闭包环境和环境析构地址组成。非捕获匿名函数和命名函数使用空环境与空析构函数；捕获匿名函数的环境保存共享引用、可变引用或移入的值。编译器根据捕获方式推断 `Fn`、`FnMut` 或 `FnOnce` 调用能力，局部变量和控制流汇合会保留该能力。

当前表面语法只能写 `fun(A) -> R`，该显式类型表示可重复调用的 `Fn`。因此 `FnMut` 或 `FnOnce` 闭包不能赋给这种显式类型，也不能通过使用这种类型的参数或返回值边界；目前还没有单独书写 `FnMut`、`FnOnce` 函数类型的语法。

### 数组 `[T; N]`

固定大小数组，元素类型和长度在编译期确定。

```riddle
let nums: [i32; 3] = [1, 2, 3];
let repeated: [i32; 3] = [0; 3];
let mut arr: [i32; 2] = [10, 20];
arr[0] = 99;  // 需要 `mut`
```

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
let p: *const i32;
let q: *mut i32;
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

对**不定长类型**（`str`）的引用是**胖指针**：两个机器字，包含地址和额外的元数据（对于 `&str` 是字节长度）。

| 类型 | 指针类别 | C 表示 |
|------|---------|-----------------|
| `&i32` | 瘦（8 字节） | `int32_t*` |
| `&str` | 胖（16 字节） | 内部为 `struct { const char* ptr; size_t len; }`；C 导入边界使用 `const char*` |

## 定长与不定长类型

一个类型如果在编译期已知其大小，则称为**定长（sized）**。大多数类型都是定长的。

### 不定长类型

目前只有 `str` 是不定长的。不定长类型不能作为局部变量、参数、返回值或普通字段，必须作为引用或原始指针的目标使用；裸 `str` 也可以作为 `impl` 的目标。

```riddle
// let s: str = "hello";  // 错误: str 是不定长的
let s: &str = "hello";    // 正确: &str 是胖指针
```

`Sized` 概念确保栈分配、移动语义和调用约定始终处理已知大小。未来 `[T]`（切片）也将是不定长的。`str` 和 `&str` 的具体用法见 [字符串](./strings.md)。

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
| `*const T` | `T*` |
| `*mut T` | `T*` |
| `[T; N]` | C 数组，作为字段时写成 `T field[N]` |
| `enum` | 带 `tag` 和 payload 字段的 C `struct` |
| `fun(A) -> R` | `{ call, env, drop }` 闭包结构；`call` 与 `drop` 接收隐藏环境参数 |
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
