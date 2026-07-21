# 字符串

`str` 表示不定长的字符串内容，`&str` 表示可传递的字符串引用值。裸 `str` 只能作为引用、原始指针或 `impl` 的目标，不能作为独立值使用。

## `str` — 不定长字符串切片

`str` 是不定长类型，表示一段未知长度的合法 UTF-8 字节序列。由于大小在编译期未知，`str` 不能直接放在栈上——必须通过引用或指针间接使用。

```riddle
// 错误: str 是不定长的，不能作为栈变量
// let s: str = "hello";

// 正确: 使用 &str 代替
let s: &str = "hello";
```

## `&str` — 字符串切片的胖指针引用

`&str` 是对 `str` 的引用。它是一个 16 字节的**胖指针**，包含两个组件：

- `ptr` — 指向字符串数据的指针（`*const u8`）
- `len` — 字符串的字节长度（`usize`）

```riddle
fun main() {
    let greeting: &str = "hello";
    // greeting 是一个 16 字节的值: { ptr, len }
    // ptr 指向静态数据中的 "hello"
    // len = 5
}
```

## 字符串字面量

字符串字面量 `"..."` 的类型是 `&str`：

```riddle
let s: &str = "hello";
```

如果字符串内容里包含很多引号或反斜杠，可以使用 raw string。raw string 不解释转义，结束符由 `#` 的数量决定：

```riddle
let a: &str = r"hello";
let b: &str = r#"say "hello""#;
let c: &str = r###"content with "# inside"###;
```

`#[lang = r#"copy"#]` 这类属性字符串也支持 raw string。

## 函数中的 `&str`

`&str` 可以自由地在函数之间传递——它只是一个胖指针值：

```riddle
fun greet(name: &str) {
    // name 是调用方传入的字符串切片的借用
}

fun hello() -> &str {
    return "world";  // 返回对静态字符串数据的引用
}

fun main() {
    greet("Riddle");
    let msg = hello();
}
```

## 常用方法

`&str` 通过标准库提供字节长度、空值判断和带边界检查的字节访问：

```riddle
let text: &str = "hello";
let length = text.len();             // 5usize
let empty = text.is_empty();         // false
let first = text.byte_at(0usize);    // Some(104u8)
let missing = text.byte_at(5usize);  // None
```

`len` 返回 UTF-8 字节数，不是字符数。`byte_at` 返回 `Option<u8>`，索引越界时返回 `None`。

## 可增长的 `String`

`String` 是由运行时管理的 UTF-8 字节缓冲区，可以从 `&str` 创建并继续追加字符串切片：

```riddle
let mut text = String::from_str("hello");
text.push_str(" world");

let length = text.len();       // 11usize
let view = text.as_str();      // "hello world"
let capacity = text.capacity();

text.clear();
let empty = text.is_empty();   // true
```

`String::new()` 创建空字符串。`as_str()` 返回指向当前缓冲区的 `&str`；后续修改 `String` 前不应继续使用旧视图。

## C backend 中的 `&str`

通过 C 后端（`--backend c`）编译时，Riddle 内部的 `&str` 使用胖指针结构体：

```c
struct { const char* ptr; size_t len; }
```

当 `&str` 传给只有声明的外部 C 导入时，C backend 会取其中的 `ptr`，按 `const char*` 传给 C：

```riddle
extern "C" fun puts(s: &str) -> i32;

fun main() {
    puts("hello from riddle via FFI!\n");
}
```

C 导入返回 `&str` 时，返回的 `const char*` 必须以 NUL 结尾，C backend 使用 `strlen` 恢复长度。带函数体的 `extern "C"` 导出定义则保留 `{ ptr, len }` 结构体 ABI。

### 与 Rust 的区别

| 特性 | Rust | Riddle |
|------|------|--------|
| `str` | DST，总是通过引用使用 | 不定长，总是通过引用使用 |
| `&str` | 胖指针 `{ ptr, len }` | 胖指针 `{ ptr, len }` |
| `String` | 堆分配的可增长字符串 | 运行时管理的可增长 UTF-8 字节缓冲区 |
| 字面量类型 | `&'static str` | `&str` |
| raw string | `r#"..."#` | `r#"..."#` |
| 生命周期 | 需要标注生命周期 | 无生命周期标注，逃逸分析自动处理 |
| C ABI | 需显式转换 `CStr` | C 导入中的 `&str` 使用 `const char*`；导出定义保留胖指针结构体 |

## 内部表示

在 MIR 和代码生成层面，`&str` 表示为 16 字节的胖指针——ptr + len。裸 `str` 没有独立的运行时值或布局。

```
&str 的运行时布局:
┌──────────────────┬──────────────────┐
│ ptr (8 bytes)    │ len (8 bytes)    │
│ *const u8        │ usize            │
└──────────────────┴──────────────────┘
```
