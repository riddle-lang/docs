# 数据类型

Riddle 是静态类型语言。每个绑定、参数、返回值和表达式都会在编译期得到一个具体类型；多数局部绑定可以从初始化表达式推断，函数边界通常显式写出类型。

本章只介绍日常代码首先需要的类型。结构体、枚举、trait、callable、底层 ABI 和属性分别放在后续专题中。

## 标量类型

| 类型 | 含义 |
|------|------|
| `i8`、`i16`、`i32`、`i64`、`isize` | 有符号整数 |
| `u8`、`u16`、`u32`、`u64`、`usize` | 无符号整数 |
| `f32`、`f64` | 浮点数 |
| `bool` | `true` 或 `false` |
| `char` | Unicode 标量值 |
| `()` | unit 类型及其唯一值 |
| `!` | 永不产生值的 never 类型 |

`isize` 与 `usize` 跟随目标指针宽度。`unit` 不是 Riddle 类型名，空结果写作 `()`。

### 字面量与后缀

数值字面量可以显式指定类型：

```riddle
let integer = 42i32;
let byte = 255u8;
let single = 3.14f32;
let double = 1.0f64;
```

当前整数字面量只支持十进制形式及类型后缀，不支持 Rust 的十六进制、八进制、二进制或分隔符写法。

词法器会额外接受 `i128`、`u128`、`f16`、`f128` 后缀，但类型系统只支持 8 到 64 位的整数和 `f32` / `f64`，这些后缀会在类型检查时报 `E0011`。

整数算术按目标位宽回绕。除零以及有符号最小值除以 `-1` 会终止进程；移位计数按位宽取模。有符号右移使用算术右移。

### char 与数值转换

`char as Integer` 得到 Unicode 码点。`u8 as char` 也受支持，因为任意 `u8` 都是合法 Unicode 标量值；其他整数不能直接转换成 `char`。

```riddle
let code_point = '中' as u32; // 20013
let letter = 65u8 as char;    // 'A'
```

更完整的 `as` 转换范围见[表达式与块](./expressions-and-blocks.md#常见表达式)。

### Never 类型

`!` 表示表达式永远不会正常产生值。标准宏 `panic!(...)`、`todo!(...)`、`unimplemented!(...)` 和 `unreachable!(...)` 返回 `!`，所以可以出现在需要其他结果类型的分支：

```riddle
fun require(valid: bool) -> i32 {
    if valid { 42 } else { panic!("invalid state: {}", valid) }
}
```

当前 panic 运行时会输出源位置和消息，然后调用 C `abort()`；它不会进行栈展开或恢复。可恢复失败应使用 `Option` 或 `Result`，详见[错误处理](./error-handling.md)。

## 元组

元组是定长异构值。逗号用于区分元组与普通分组括号：

```riddle
let pair: (i32, bool) = (42, true);
let single: (i32,) = (42,);
let unit: () = ();
```

元组元素也可以用数字字段访问，索引从 `0` 开始：

```riddle
let number = pair.0;
let flag = pair.1;
```

元组可以通过模式拆开：

```riddle
let (number, flag) = pair;
```

## 固定长度数组

数组类型写作 `[T; N]`，元素类型与长度都在编译期确定：

```riddle
let values: [i32; 3] = [1, 2, 3];
let zeros: [i32; 3] = [0; 3];

let mut pair = [10, 20];
pair[0] = 99;
```

数组和切片的普通索引会检查边界，越界时向 stderr 输出 `riddle: index out of bounds` 并终止进程。需要可恢复的访问时，先借用为切片，再使用 `get` 或 `get_mut`。

数组长度可以来自 const 泛型参数：

```riddle
struct Buffer<T, const N: usize> {
    data: [T; N],
}

let buffer: Buffer<i32, 3> = Buffer { data: [1, 2, 3] };
```

## 引用

引用暂时访问一个值而不取得所有权：

- `&T` 是共享引用，可以同时存在多个；
- `&mut T` 是独占可变引用，存活期间不能再创建冲突引用。

```riddle
let mut value = 42;
let shared: &i32 = &value;
let copied = *shared;

let exclusive: &mut i32 = &mut value;
*exclusive = 43;
```

借用检查、自动重借用和引用来源将在[引用与逃逸](./references-and-escape.md)详细解释。

## 切片与不定长类型

`[T]` 和 `str` 是不定长类型，不能直接作为局部变量、参数、返回值或普通字段，必须位于引用或原始指针后。对它们的引用同时携带数据地址和长度：

```riddle
let values = [1, 2, 3];
let slice: &[i32] = &values;
let text: &str = "hello";
```

切片提供 `len`、`is_empty`、`get`、`get_mut`、`iter` 和 `iter_mut`；共享和可变切片引用都可用于 `for`。`&[T]` / `&mut [T]` 可由对应可变性的数组引用自动转换。

## 字符串

`str` 表示不定长的字符串内容，`&str` 表示可传递的字符串引用值。裸 `str` 只能作为引用、原始指针或 `impl` 的目标，不能作为独立值使用。

`&str` 是对 `str` 的引用，由两个机器字组成：指向 UTF-8 数据的指针和字节长度（胖指针）。字符串字面量 `"..."` 的类型就是 `&str`：

```riddle
let greeting: &str = "hello";
```

如果字符串内容里包含很多引号或反斜杠，可以使用 raw string。raw string 不解释转义，结束符由 `#` 的数量决定：

```riddle
let a: &str = r"hello";
let b: &str = r#"say "hello""#;
let c: &str = r###"content with "# inside"###;
```

`#[lang = r#"copy"#]` 这类属性字符串也支持 raw string。

`&str` 可以自由地在函数之间传递——它只是一个胖指针值：

```riddle
fun greet(name: &str) {
    // name 是调用方传入的字符串切片的借用
}

fun main() {
    greet("Riddle");
}
```

`&str` 通过标准库提供字节长度、空值判断和字节切片视图：

```riddle
let text: &str = "hello";
let length = text.len();                    // 5usize（UTF-8 字节数，不是字符数）
let empty = text.is_empty();                // false
let bytes = text.as_bytes();                // &[u8]

for ch in "A中🙂" {
    // ch: char，按 UTF-8 解码
}
```

`as_bytes` 不复制数据，返回共享字节切片。`&str` 可直接用于 `for`，迭代器按 UTF-8 解码并依次产出 Unicode `char`。

可增长的 `String` 属于集合，见[集合](./collections.md)。`&str` 在 C 后端的 ABI 表示见[FFI 与底层工具链](./ffi-and-tooling.md#extern-c)。

## 结构体、枚举与泛型类型

用户可以定义带字段的结构体和带变体的枚举：

```riddle
struct Pair<A, B> {
    first: A,
    second: B,
}

enum Slot<T> {
    Empty,
    Value(T),
}
```

嵌套泛型不需要在 `>` 之间插入空格：

```riddle
let value: Slot<Pair<i32, bool>> = Slot::Value(Pair {
    first: 1,
    second: true,
});
```

函数、trait 与 `impl` 的类型参数可以直接带 trait bound；结构体和枚举通过 `where` 子句约束类型参数。const 参数声明自己的整数类型，当前主要用于数组长度。构造、模式匹配与行为实现分别见[结构体](./structs.md)、[枚举、模式与 match](./enums-and-patterns.md)、[Trait](./traits.md)和[impl 块](./impls.md)。

## 原始指针

`*const T` 和 `*mut T` 是供 FFI 与底层实现使用的原始指针，不参与普通引用的借用跟踪。解引用和索引必须位于 `unsafe` 中：

```riddle
let pointer = 0usize as *const i32;
// unsafe { *pointer } 会解引用空指针，不要执行
```

原始指针不是绕过类型、移动或可变性检查的通用工具。完整安全边界和 C 类型映射见[FFI 与底层工具链](./ffi-and-tooling.md)。

## 继续阅读

匿名函数与 `Fn` / `FnMut` / `FnOnce` 的完整规则见[闭包与迭代器](./functional.md)。可增长的 `String` 和其他容器见[集合](./collections.md)。当前完整类型能力与限制见[当前工具链状态](./compiler-status.md#类型系统)。
