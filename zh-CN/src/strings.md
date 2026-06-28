# 字符串

Riddle 中的字符串处理围绕两个类型展开：`str` 和 `&str`。理解它们的区别对于编写正确的 Riddle 代码至关重要。

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

字符串字面量 `"..."` 的类型是 `str`（不定长）。由于 Riddle 支持 **unsized coercion**，`str` 字面量在赋值给 `&str` 时会自动强制转换：

```riddle
let s: &str = "hello";  // "hello" 的类型是 str，强制转换为 &str
```

## 函数中的 &str 使用

`&str` 可以自由地在函数之间传递——它只是一个胖指针值：

```riddle
fun greet(name: &str) {
    // name 是调用方传入的字符串切片的借用
}

fun hello() -> &str {
    return "world";  // 返回对静态字符串数据的引用
}

fun main() {
    greet("Riddle");  // 字面量自动强制为 &str
    let msg = hello();
}
```

## C FFI 中的 `&str`

通过 C 后端（`--backend c`）编译时，`&str` 映射为 C 的胖指针结构体：

```c
struct { const char* ptr; size_t len; }
```

这使得 Riddle 可以调用接受字符串的 C 函数，并携带长度信息：

```riddle
extern "C" fun puts(s: str) -> i32;

fun main() {
    puts("hello from riddle via FFI!\n");
}
```

### 与 Rust 的区别

| 特性 | Rust | Riddle |
|------|------|--------|
| `str` | DST，总是通过引用使用 | 不定长，总是通过引用使用 |
| `&str` | 胖指针 `{ ptr, len }` | 胖指针 `{ ptr, len }` |
| `String` | 堆分配的可增长字符串 | 暂无 |
| 字面量类型 | `&'static str` | `str`（自动强制转换为 `&str`） |
| 生命周期 | 需要标注生命周期 | 无生命周期标注，逃逸分析自动处理 |
| C ABI | 需显式转换 `CStr` | `str` 直接映射为胖指针结构体 |

## 内部表示

在 MIR 和代码生成层面，`str` 和 `&str` 都表示为 16 字节的胖指针——ptr + len。类型检查层面将 `str` 标记为 unsized 以强制执行"必须通过引用使用"的规则，但底层运行时表示是相同的。

```
&str 的运行时布局:
┌──────────────────┬──────────────────┐
│ ptr (8 bytes)    │ len (8 bytes)    │
│ *const u8        │ usize            │
└──────────────────┴──────────────────┘
```
