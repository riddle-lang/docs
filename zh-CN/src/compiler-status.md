# 当前工具链状态

Riddle 仍处于开发阶段。本页记录当前仓库已经实现并被测试覆盖的能力，避免把未来设计误当成可用功能。

## 编译流程

`riddlec` 当前执行完整前端和基础后端流程：

1. 增量词法分析和语法分析（`IncrementalParser`，缓存 token 以支持 LSP 重新解析）；
2. AST 包装；
3. HIR 降级（含 E0040/E0050/E0051/E0052 诊断）；
4. 作用域图构建和名字解析（基于片段的增量作用域图，支持部分失效）；
5. 类型检查（含增量缓存 `TypeCheckCache`）；
6. 逃逸分析（过程间不动点，决定局部值用栈分配还是 GC 堆分配）；
7. move checker（移动后使用、借用冲突、借用期间赋值/移动检查）；
8. HIR 到 MIR 降级（SSA 形式，Phi 节点，基本块，`Alloca`/`HeapAlloc` 分配指令）；
9. 后端代码生成（C / Cranelift / JS / Lua）。

命令行入口支持：

```bash
riddlec [--verbose] [--backend c] [--output <file>] <file>...
```

`--backend c` 会生成 C 代码，并调用本机 `cc`、`gcc` 或 `clang` 编译成可执行文件。运行 C backend 需要系统上可用的 C 编译器和 Boehm GC（链接参数为 `-lgc`）。

`riddlec` 会自动把 `std/prelude.rid` 拼到用户源码后面，因此基础 lang trait（`Copy`、`Clone`、`Debug` 等）不需要手动引入。

### MIR 中间表示

MIR（Mid-level IR）是 SSA 形式的中间表示，位于类型检查和代码生成之间：

- **SSA 基本块**：每个函数体由基本块组成，块以 `Terminator`（`Branch`、`CondBranch`、`Return`）结束；
- **Phi 节点**：`InstKind::Phi` 合并来自多个前驱块的值；
- **分配指令**：`Alloca`（栈分配）和 `HeapAlloc`（GC 堆分配），由逃逸分析结果驱动；
- **内存操作**：`Load`、`Store`、`FieldPtr`（字段指针）、`IndexPtr`（索引指针）、`ExtractValue`（提取聚合字段）；
- **值构造**：`StructValue`、`ArrayValue`、`TupleValue`；
- **类型转换**：`IntToInt`、`IntToFloat`、`FloatToInt`、`FloatToFloat`、`BoolToInt`、`IntToBool`；
- **比较操作**：`Cmp` 支持 `Eq`、`Neq`、`Lt`、`Gt`、`LtEq`、`GtEq`。

MIR 类型系统包含 `FnPtr`、`Ptr`、`Struct`、`Enum`、`Tuple`、`Array`、`Str`、`Never`、`Void`，并支持 `size_bytes()` 计算类型大小（区分瘦指针和胖指针）。

### riddle-lsp

仓库包含 `app/riddle-lsp`，一个基于 `tower-lsp` 的 Language Server Protocol 实现：

- 完整的诊断流水线：解析错误、HIR 诊断、类型检查错误、move/escape 分析诊断全部通过 LSP 推送；
- 全文本同步（`TextDocumentSyncKind::FULL`）；
- UTF-16 位置编码（正确处理多字节字符如 emoji）；
- 诊断附带次要标签（related information）、注释（notes）和帮助消息（help）；
- 诊断严重性层级：Error、Warning、Information、Hint；
- 每次按键都运行完整编译流程；

编辑器配置示例见 [FFI 与工具链](./ffi-and-tooling.md)。

## 当前语言特性

### 模块和名字解析

- `mod name { ... }` 内联模块；
- `mod name;` 外部模块声明的语法；
- `use path;`、`use path as alias;`；
- `use path::*;`；
- `use path::{a, b as c};`；
- `self`、`super`、`crate` 和 `::root` 风格路径；
- 局部变量、参数、模块项、结构体、枚举变体、函数和 impl 方法的解析。

### 变量、函数和表达式

- `let` 绑定，默认不可变；
- `let mut` 可变绑定；
- 显式类型标注；
- 顶层和 `impl` 内的 `const` 声明（`const NAME: Type = value;`）；
- 顶层、`impl` 和 `trait` 内的 `type` 别名（含默认关联类型）；
- 先声明后赋值；
- 函数定义和函数声明；
- 泛型函数（类型参数从实参推断，C backend 单态化）；
- 函数参数、返回类型、尾表达式和 `return`；
- 块表达式；
- 字段访问、函数调用、方法调用；
- 数组字面量、数组索引；
- 结构体字面量和字段简写；
- 类型转换表达式 `expr as Type`；
- `unsafe { ... }` 块语法；
- 解引用 `*expr`。

### 运算符

- 算术：`+`、`-`、`*`、`/`、`%`；
- 比较：`==`、`!=`、`<`、`>`、`<=`、`>=`；
- 逻辑：`&&`、`||`、`!`；
- 位运算：`&`、`|`、`^`、`<<`、`>>`；
- 赋值：`=`；
- 复合赋值：`+=`、`-=`、`*=`、`/=`、`%=`、`&=`、`|=`、`^=`、`<<=`、`>>=`；
- 一元：`+`、`-`、`&`、`&mut`、`*`、`!`。

### 控制流和模式

- `if` / `else if` / `else` 表达式；
- `while` 循环；
- `match` 表达式；
- `match` guard；
- `_` 通配模式；
- 标识符绑定模式；
- 字面量模式；
- 路径模式；
- 元组模式；
- 结构体模式；
- 枚举 tuple/struct 变体模式。

### 类型系统

- 整数：`i8`、`i16`、`i32`、`i64`、`i128`、`isize`、`u8`、`u16`、`u32`、`u64`、`u128`、`usize`；
- 浮点：`f16`、`f32`、`f64`、`f128`；
- `bool`、`char`、`()`、`!`；
- `str` 和 `&str`；
- 引用：`&T`、`&mut T`；
- 原始指针类型：`*const T`、`*mut T`；
- 元组类型；
- 固定长度数组 `[T; N]`；
- 结构体；
- 枚举；
- 函数类型；
- 泛型函数、泛型结构体、泛型枚举、泛型 impl；
- 类型参数实例化；
- 无空格嵌套泛型类型参数，例如 `Box<Box<i32>>` 和 `Box<Box<Box<i32>>>`。

### Trait 和 impl

- `trait` 定义；
- trait 方法签名；
- 关联类型声明和默认关联类型；
- `impl Trait for Type`；
- `impl Type` 固有方法；
- `self`、`&self`、`&mut self` 接收者；
- 方法调用 `value.method()`；
- 关联函数路径调用 `Type::function(...)`；
- `Type::Assoc` 关联类型路径；
- trait impl 合约检查：缺少方法、参数类型、返回类型和缺少关联类型会报错；
- 泛型 trait impl 模式匹配，例如 `impl<T> Copy for Box<T>`。

### 属性和标准库内置项

Riddle 支持 Rust 风格外部属性，可放置在多项位置：

```riddle
#[item]
struct Item {
    #[field]
    value: i32,
}

fun id(#[param] value: #[ty] i32) -> i32 {
    #[expr] value
}

match value {
    #[arm] Pattern => result,
}
```

属性当前会进入 AST/HIR。编译器识别 `#[lang = "..."]`，用于把 std 中的 trait 标记为编译器内置项。

当前 `std/prelude.rid` 会自动拼到用户源码后面，里面定义了：

- `std::marker::Copy`；
- `std::clone::Clone`；
- `std::default::Default`；
- `std::cmp::{PartialEq, Eq, PartialOrd, Ord}`；
- `std::fmt::{Debug, Display, Binary, Octal, LowerHex, UpperHex, LowerExp, UpperExp}`；
- `std::hash::Hash`；
- `std::ops` 下的算术、位运算、移位和复合赋值 trait。

目前真正影响编译器语义的是 `#[lang = "copy"]`：被它标记的 `Copy` trait 会被 move checker 用来决定用户类型是否按复制语义处理。其他 lang trait 已在 std 中占位，操作符分派仍由编译器内置逻辑处理。

### 所有权、移动和逃逸

- 值默认移动；
- 标量、引用、函数、枚举等内置 Copy 候选默认可复制；
- 用户类型可以通过实现 lang `Copy` 进入复制语义；
- move checker 检查移动后使用；
- 借用期间移动会报错；
- 字段访问本身不会移动整个结构体；
- 数组元素和结构体字段按值移动；
- 引用逃逸分析决定局部值使用栈分配还是 GC 堆分配。

### 字符串和 FFI

- 字符串字面量；
- `str` 不定长类型；
- `&str` 胖指针；
- 字符串字面量可赋给 `&str`；
- C backend 中 `str` / `&str` 使用 `{ ptr, len }` 表示；
- `extern "C" fun ...;`；
- `extern "C" { fun ...; }`；
- `extern "C" fun name(...) { ... }` 导出 C ABI 函数；
- C backend 内置 `str_len` 和 `str_byte` 两个字符串 helper。

## 后端状态

| 后端 | 状态 |
|------|------|
| C backend | CLI 可用：`--backend c`。生成 C 代码后用本机 CC 编译，需要 Boehm GC |
| Cranelift backend | 仓库中有完整代码和测试（`tests/mir/backend_cranelift.rs`），SSA 形式原生代码生成，当前 CLI 未暴露 |
| JS backend | 仓库中有完整代码和测试（`tests/mir/backend_js.rs`），生成 JavaScript 代码，当前 CLI 未暴露 |
| Lua backend | 仓库中有完整代码和测试（`tests/mir/backend_lua.rs`），生成 Lua 代码，当前 CLI 未暴露 |

所有后端通过统一的 `Backend` trait 实现：`compile(&mut self, module: &Module) -> Result<String, Error>`。

## 工具状态

| 工具 | 状态 |
|------|------|
| `riddlec` | 编译器 CLI，支持前端检查、MIR 降级和 C backend |
| `riddle-lsp` | LSP 服务器，基于 `tower-lsp`，每次按键运行完整编译流程，推送解析/类型/move 诊断 |

## 当前限制

- 标准库 trait 多数只是 lang 标记和基础 impl，占位多于运行时能力；
- 操作符还没有真正通过 trait 分派；
- 泛型目前偏向类型级单态化，尚未覆盖完整 Rust 泛型能力（如 where 约束、trait bound）；
- `where` 已是关键字，但约束语法和语义尚未实现；
- `pub` 已是关键字，但可见性规则尚未作为完整语义实现；
- `for` 已用于 `impl Trait for Type`，还没有独立循环语句（`for ... in ...`）；
- C backend 需要外部 C 编译器和 Boehm GC；
- Cranelift / JS / Lua 后端代码和测试齐全，但 CLI 尚未暴露切换入口；
- 逃逸分析当前粒度是整个局部变量，不做字段级拆分；
- 这是开发中工具链，不保证语法和 ABI 稳定。
