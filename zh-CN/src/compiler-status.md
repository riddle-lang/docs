# 当前工具链状态

Riddle 仍处于开发阶段。本页记录当前仓库已经实现并被测试覆盖的能力，避免把未来设计误当成可用功能。

## 编译流程

`riddlec` 可执行完整前端和基础后端流程：

1. 词法分析和语法分析（`IncrementalParser` 提供局部重解析 API）；
2. AST 包装；
3. HIR 降级（含 E0040/E0050/E0051/E0052 诊断）；
4. 作用域图构建和名字解析（基于片段的增量作用域图，支持部分失效）；
5. 类型检查（含可复用的 `IncrementalTypeChecker`）；
6. 逃逸分析（过程间不动点，决定局部值用栈分配还是 GC 堆分配）；
7. move checker（移动后使用、借用冲突、借用期间赋值/移动检查）；
8. HIR 到 MIR 降级（SSA 形式，Phi 节点，基本块，`Alloca`/`HeapAlloc` 分配指令）；
9. C 后端代码生成。

命令行入口支持：

```bash
riddlec [--verbose] [--backend c] [--output <file>] <file>...
```

`--backend c` 会生成 C 代码；如需可执行文件，再使用本机 `cc`、`gcc` 或 `clang` 编译生成结果。GC 运行时已经随生成代码内置，不需要额外链接 Boehm GC。

不指定后端时，`riddlec` 在完成 move/borrow 检查后停止；只有生成后端代码时才继续降级 MIR。

`riddlec` 会自动把 `std/lib.rid` 拼到用户源码后面，因此 `std::marker::Copy`、`std::clone::Clone` 和比较、运算 trait 不需要手动定义。

### MIR 中间表示

MIR（Mid-level IR）是 SSA 形式的中间表示，位于类型检查和代码生成之间：

- **SSA 基本块**：每个函数体由基本块组成，块以 `Terminator`（`Branch`、`CondBranch`、`Return`、`Unreachable`）结束；
- **Phi 节点**：`InstKind::Phi` 合并来自多个前驱块的值；
- **分配指令**：`Alloca`（栈分配）和 `HeapAlloc`（GC 堆分配），由逃逸分析结果驱动；
- **内存操作**：`Load`、`Store`、`FieldPtr`（字段指针）、`IndexPtr`（索引指针）、`ExtractValue`（提取聚合字段）；
- **值构造**：`StructValue`、`SparseStructValue`、`ArrayValue`、`TupleValue`；枚举使用稀疏初始化保证不同变体的 payload 槽位稳定；
- **类型转换**：`IntToInt`、`IntToFloat`、`FloatToInt`、`FloatToFloat`、`BoolToInt`、`IntToBool`、`IntToPtr`、`PtrToPtr`；
- **比较操作**：`Cmp` 支持 `Eq`、`Neq`、`Lt`、`Gt`、`LtEq`、`GtEq`。
- **函数值**：可调用值统一为 `{ call, env }`，`FunctionRef` 取得隐藏函数或命名函数适配器地址，`CallIndirect` 传入环境后调用；捕获匿名函数的环境使用 GC 堆分配。

MIR 类型系统包含 `FnPtr`、`Ptr`、`Struct`、`Enum`、`Tuple`、`Array`、`Str`、`Never`、`Void`，并为定长类型提供 `size_bytes()` 布局估算；裸 `Str` 没有独立大小。

### riddle-lsp

仓库包含 `app/riddle-lsp`，一个基于 `tower-lsp` 的 Language Server Protocol 实现：

- 完整的诊断流水线：解析错误、HIR 诊断、类型检查错误、move/escape 分析诊断全部通过 LSP 推送；
- 全文本同步（`TextDocumentSyncKind::FULL`）；
- UTF-16 位置编码（正确处理多字节字符如 emoji）；
- 补全（`textDocument/completion`），支持当前文档中的关键字、内置类型、全局项、函数参数和局部变量，并根据推导类型提供字段与实例方法，根据 `::` 提供枚举变体、关联函数和公开标准库导入；
- 语义 Token（`textDocument/semanticTokens/full`），内置类型使用 `keyword`，区分自由函数、方法、struct、enum 和 trait，关联函数使用 `method` / `static`，标准库符号使用 `defaultLibrary`，并包含函数、参数和方法 `declaration` 及可变局部变量 `declaration` / `mutable` 标记；
- 诊断区分主标签和次要标签（related information），错误码可跳转到错误码手册，注释和修复建议分别以 `note:` / `help:` 附加；
- Clue 项目按原始文件 URI 发布诊断，包括未打开模块，并在重新分析后清理过期诊断；
- 诊断严重性层级：Error、Warning、Information、Hint；
- 文档变更会先合并短时间内的连续输入，再在后台运行诊断并丢弃过期结果；未变化的文件和无关 Clue 项目直接复用诊断，变化的分析单元复用增量语法树、函数体和全局类型检查缓存，在声明、overlay、磁盘源码或 manifest 变化时保守失效；诊断在 move/borrow 检查后停止，不生成 MIR；UTF-16 位置通过行索引换算，语义 Token 只解析当前文件并降级 HIR，并按文档文本缓存；
- 仓库内提供 Helix、VS Code、Zed 和 IntelliJ IDEA 2026.1+ 的 `.rid` 文件与 `riddle-lsp` 适配；

安装和验证步骤见[编辑器与 LSP](./editor-support.md)。

## 当前语言特性

### 模块和名字解析

- `mod name { ... }` 内联模块；
- `mod name;` 外部模块声明的语法；
- `use path;`、`use path as alias;`；
- `use path::*;`；
- `use path::{a, b as c};`；
- `pub` 可见性，模块路径只导出 public 项；
- `pub use` 重新导出；
- `self`、`super`、`crate` 和 `::root` 风格路径；
- 局部变量、参数、模块项、结构体、枚举变体、函数和 impl 方法的解析。

### 变量、函数和表达式

- `let` 绑定，默认不可变；
- `let mut` 可变绑定；
- `fun(x) { x + 1 }` 匿名函数、结构化函数类型、单态参数推断和闭包捕获；
- 按用法推断共享、可变和值捕获，并据此检查 `Fn`、`FnMut`、`FnOnce` 调用能力；
- 显式类型标注；
- 顶层和 `impl` 内的 `const` 声明（`const NAME: Type = value;`）；
- 顶层、`impl` 和 `trait` 内的 `type` 别名（含默认关联类型）；
- 先声明后赋值；
- 函数定义和函数声明；
- 泛型函数（类型参数和 const 参数从实参推断，支持 `<T: Trait>` bound、`where` 子句，C backend 单态化）；
- 函数参数、返回类型、尾表达式和 `return`；
- 块表达式；
- 字段访问、函数调用、方法调用；
- 数组字面量、数组重复表达式 `[value; N]`、数组索引；
- 结构体字面量和字段简写；
- 类型转换表达式 `expr as Type`；
- `unsafe { ... }` 块表达式，以及原始指针解引用和索引的安全上下文检查；
- `unsafe fun`、`unsafe fun(...) -> T` 函数类型和单向安全函数转换；
- `unsafe extern "C"` 导入块，块内默认不安全并支持 `safe fun` 显式安全声明；
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
- `for item in iterable` 循环，按 `IntoIterator` / `Iterator` 做类型检查，并在 MIR 中降成 `into_iter` / `next` 调用；
- 泛型参数可以通过 `IntoIterator<Item = ..., IntoIter = ...>` bound 使用 `for`，具体 impl 在单态化时解析；
- 标准库 `Range` 和固定长度数组 `[T; N]` 可直接用于 `for`，数组按值遍历且不要求元素类型为 `Copy`；
- `match` 表达式，以及枚举、布尔值、`()`、整数、元组和结构体的递归穷尽性检查；
- 非穷尽整数匹配会报告未覆盖的连续值区间；
- `match` guard，guard 失败后继续检查后续 arm，且带 guard 的 arm 不计入静态穷尽性；
- `_` 通配模式；
- 标识符绑定模式；
- 字面量模式；
- 路径模式；
- 元组模式；
- 结构体模式；
- 枚举 unit/tuple/struct 变体模式，payload 绑定会进入 guard 和 arm 表达式。

### 类型系统

- 整数：`i8`、`i16`、`i32`、`i64`、`i128`、`isize`、`u8`、`u16`、`u32`、`u64`、`u128`、`usize`；
- 浮点：`f16`、`f32`、`f64`、`f128`；
- `bool`、`char`、`()`、`!`；
- `str`：不定长字符串类型，仅能作为引用、原始指针或 `impl` 的目标；
- `&str`：引用 `str` 的定长胖指针值；
- 引用：`&T`、`&mut T`；
- 原始指针类型：`*const T`、`*mut T`；
- 元组类型和元组表达式，例如 `(2, 3)` 与 `(2,)`；
- 固定长度数组 `[T; N]`；
- const generics，例如 `struct Buffer<T, const N: usize> { data: [T; N] }`；
- 结构体；
- 枚举；
- 标准库 `Option<T>` 和 `Result<T, E>`；
- 函数类型；
- 泛型函数、泛型结构体、泛型枚举、泛型 impl；
- 泛型 bound：`<T: Trait>`、`<T: A + B>`、`where T: Trait`；
- 类型参数实例化；
- const 参数实例化，例如 `Buffer<i32, 3>`；
- 无空格嵌套泛型类型参数，例如 `Box<Box<i32>>` 和 `Box<Box<Box<i32>>>`。

### Trait 和 impl

- `trait` 定义；
- 父 trait 声明、传递 bound、父方法查找、impl 前置依赖和继承环检查；
- trait 方法签名；
- trait 默认方法；impl 未覆写时使用默认体，显式覆写优先；
- 关联类型声明和默认关联类型；
- `impl Trait for Type`；
- `impl Type` 固有方法；
- `self`、`&self`、`&mut self` 接收者；
- 方法调用 `value.method()`；
- 关联函数路径调用 `Type::function(...)`；
- `Type::Assoc` 关联类型路径；
- trait impl 合约检查：缺少方法、参数类型、返回类型和缺少关联类型会报错；
- 泛型 trait impl 模式匹配，例如 `impl<T> std::marker::Copy for Box<T>`；
- `impl` 上的 `where` 子句，并检查 Paterson condition：约束必须严格小于被实现的类型；
- 算术、取余、位运算、移位、一元负号、逻辑非和复合赋值可通过对应的 `#[lang = "..."]` trait 为用户类型分派；
- `==` / `!=` 检查 `PartialEq`，有序比较检查 `PartialOrd`；
- 标准库 `Iterator` / `IntoIterator` 协议，含 `Range`、`range(start, end)`、数组 `IntoIterator` 和 `for` 遍历。

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

当前标准库会自动拼到用户源码后面，根部通过 prelude 重导出常用项，同时按 Rust 风格分模块定义：

prelude 直接提供 `Option`、`Result`、`String`、`Vector`、`Some`、`None`、`Ok`、`Err`、`Copy`、`Clone`、`print`、比较 trait 和迭代协议。

- `std::option::Option<T>`，提供 `is_some`、`is_none`、`unwrap_or` 和 `or`；
- `std::result::Result<T, E>`，提供 `is_ok`、`is_err`、`unwrap_or`、`ok` 和 `err`；
- `std::io::{print, Display}`，`print` 当前支持 `&str` 和 `i32`，输出时不自动换行；
- `std::string::String` 提供 `new`、`from_str`、`as_str`、`len`、`capacity`、`is_empty`、`push_str` 和 `clear`；同一模块为 `str` 提供 `len`、`is_empty` 和返回 `Option<u8>` 的 `byte_at`；
- `std::vector::Vector<T>` 提供 `new`、`len`、`capacity`、`is_empty`、`push`、`pop`、`get`、`get_mut`、`clear` 和按值迭代；
- `std::iter::{Iterator, IntoIterator}`；
- `std::array` 中的数组迭代器，并兼容重导出为 `ArrayIter<T, const N>`；
- `std::ops::{Range, range(start, end)}`；
- `std::marker::Copy`；
- `std::clone::Clone`；
- `std::cmp::{Ordering, PartialEq, Eq, PartialOrd, Ord}`；
- `std::ops` 下的算术、位运算、移位和复合赋值 trait，均有可调用的必需方法；这些 trait 由对应 `#[lang = "..."]` 标记，其标量 impl 作为编译器内置运算。

`Default` 需要按具体 `Self` 调用关联 trait 函数，格式化和哈希还需要对应运行时协议；这些能力尚未实现，因此 std 不再暴露只有名字、没有行为的占位 trait。

当前影响编译器语义的 lang trait 包括：

- `#[lang = "copy"]`：被它标记的 `Copy` trait 会被 move checker 用来决定用户类型是否按复制语义处理；
- `#[lang = "add"]` 到 `#[lang = "shr"]`：用户类型的算术、位运算和移位会分派到对应 trait 方法；标量 impl 的方法调用直接降为 MIR 运算；
- `#[lang = "neg"]` 和 `#[lang = "not"]`：用户类型的一元负号和逻辑非会分派到对应 trait 方法；标量 impl 的方法调用直接降为 MIR 运算；
- `#[lang = "add_assign"]` 到 `#[lang = "shr_assign"]`：用户类型的复合赋值会分派到对应 trait 方法；标量 impl 的方法调用直接降为 MIR 的读取、运算和写回；
- `#[lang = "partial_eq"]`：用户类型使用 `==` / `!=` 时需要满足 `PartialEq`；
- `#[lang = "partial_ord"]`：用户类型使用 `<`、`>`、`<=`、`>=` 时需要满足 `PartialOrd`。

`Clone::clone`、`PartialEq::eq`、`PartialOrd::partial_cmp`、`Ord::cmp` 和各运算 trait 方法可以直接调用。带受支持 lang 标记的标量运算方法不会生成 `add__i64` 一类 C 包装函数，而是生成原生 C 运算表达式。未标记的同名 trait 仍按普通方法编译；用户类型的非比较运算符会调用对应 trait impl 方法。

### 所有权、移动和逃逸

- 值默认移动；
- 标量、共享引用、原始指针和函数等内置 Copy 候选默认可复制；`&mut T` 不可复制；
- `Option<T>` 和 `Result<T, E>` 仅在所有 payload 类型实现 `Copy` 时实现 `Copy`；
- 用户类型可以通过实现 `std::marker::Copy` 进入复制语义；编译器会验证结构体字段和所有枚举 payload，并在泛型场景中使用 impl bound；
- move checker 检查移动后使用；
- 借用期间移动会报错；
- 方法和函数返回值会传播引用来源，包含 `Option<&T>` 等泛型包装；
- 引用参数支持自动重借用，局部借用可在最后一次使用后结束；
- 字段访问本身不会移动整个结构体；
- 数组元素和结构体字段按值移动；
- 引用逃逸分析决定局部值使用栈分配还是 GC 堆分配。
- 共享/可变闭包捕获会让对应局部逃逸，但堆分配不会放宽移动和借用检查；
- 非 `Copy` 值捕获会在创建闭包时移动该值，`FnOnce` 闭包调用后不可再次使用。

### 字符串和 FFI

- `str` 是不定长类型，不能作为局部变量、参数、返回值或普通字段；
- `&str` 是 `{ ptr, len }` 胖指针，字符串字面量的类型也是 `&str`；
- 字符串字面量支持 `"..."`、`r"..."`、`r#"..."#` 和 `r###"..."###`；
- `extern "C"` 支持单函数声明、声明块和带函数体的导出定义；
- C 导入中的 `&str` 映射为 `const char*`，带函数体的导出定义保留 `{ ptr, len }`；
- C backend 内置 `str_len` 和 `str_byte` 两个字符串 helper。

## 后端状态

| 后端 | 状态 |
|------|------|
| C backend | CLI 可用：`--backend c`。输出使用 `rgc` 运行时 ABI；默认 provider 由 `clue` 选择，也支持自定义 provider |

C backend 实现统一的 `Backend` trait：`compile(&mut self, module: &Module) -> Result<String, Error>`。

C backend 会把标量 std 运算 trait 的显式方法调用直接输出为 `+`、`-`、`*`、`&`、`<<` 等 C 运算，不声明或定义对应的 primitive wrapper；用户类型的 trait 方法仍输出普通 C 函数。

## 工具状态

| 工具 | 状态 |
|------|------|
| `riddlec` | 编译器 CLI，支持前端检查、MIR 降级和 C backend |
| `riddle-lsp` | LSP 服务器，基于 `tower-lsp`，提供当前文档补全，并发处理请求，按分析单元增量刷新诊断，并缓存当前文档的轻量语义 Token 结果 |
| `clue` | 项目构建器，支持 `init`、`new`、`check`、`build` 和 `run`；二进制项目会保留 C 并生成本机可执行文件，库项目只输出 C |

## 当前限制

- `Default`、格式化和哈希协议尚未提供；
- 浮点余数尚未支持，`Rem` / `RemAssign` 目前只为整数实现；
- 显式泛型函数调用和显式泛型结构体构造表达式还不支持，例如 `f::<T>()`、`Type::<T> { ... }`；
- 泛型目前偏向单态化，尚未覆盖完整 Rust 泛型能力；
- 字段级可见性尚未做类型检查约束；
- `riddlec` 的 C backend 只输出 C；`clue build` 会严格使用 `CC`，或自动选择能完成 C11 编译和链接的系统 C 编译器来生成本机可执行文件；
- 逃逸分析当前粒度是整个局部变量，不做字段级拆分；
- 闭包当前按整个绑定捕获，不做字段级精确捕获；
- 函数类型语法目前只能写表示 `Fn` 的 `fun(...) -> T`，尚不能显式声明接收或返回 `FnMut`、`FnOnce`；
- 这是开发中工具链，不保证语法和 ABI 稳定。
