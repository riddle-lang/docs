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
riddlec [--verbose] [--no-std] [--backend c] [--target <triple>] [--output <file>] <file>...
```

`--backend c` 会生成调用 `rgc` ABI 的 C 代码；如需可执行文件，使用本机 `cc`、`gcc` 或 `clang` 同时编译生成结果与发行包附带的 `runtime.c`。`clue build` 会自动完成这一步，不依赖 Boehm GC。

不指定后端时，`riddlec` 在完成 move/borrow 检查后停止；只有生成后端代码时才继续降级 MIR。

`riddlec` 会自动把 `std/lib.rid` 拼到用户源码后面，因此 `std::marker::Copy`、`std::clone::Clone` 和比较、运算 trait 不需要手动定义。

### MIR 中间表示

MIR（Mid-level IR）是 SSA 形式的中间表示，位于类型检查和代码生成之间：

- **SSA 基本块**：每个函数体由基本块组成，块以 `Terminator`（`Branch`、`CondBranch`、`Return`、`Unreachable`）结束；
- **Phi 节点**：`InstKind::Phi` 合并来自多个前驱块的值；
- **分配指令**：`Alloca`（栈分配）和 `HeapAlloc`（GC 堆分配），由逃逸分析结果驱动；
- **内存操作**：`Load`、`Store`、`FieldPtr`（字段指针）、`IndexPtr` / `CheckedIndexPtr`（原始指针索引 / 安全数组与切片索引）、`ExtractValue`（提取聚合字段）；
- **值构造**：`StructValue`、`SparseStructValue`、`ArrayValue`、`TupleValue`；枚举使用稀疏初始化保证不同变体的 payload 槽位稳定；
- **类型转换**：`IntToInt`、`IntToChar`、`IntToFloat`、`FloatToInt`、`FloatToFloat`、`BoolToInt`、`IntToBool`、`IntToPtr`、`PtrToPtr`；
- **比较操作**：`Cmp` 支持 `Eq`、`Neq`、`Lt`、`Gt`、`LtEq`、`GtEq`。
- **函数值**：可调用值统一为 `{ call, env, drop }`，`FunctionRef` 取得隐藏函数或命名函数适配器地址，`CallIndirect` 传入环境后调用；未逃逸的捕获环境使用栈存储，只有越过当前栈帧的环境才提升到 GC 堆。

MIR 类型系统包含 `FnPtr`、`Ptr`、`Struct`、`Enum`、`Tuple`、`Array`、`Slice`、`Str`、`Never`、`Void`，并为定长类型提供 `size_bytes()` 布局估算；裸 `Str` 和 `Slice` 没有独立大小。

### riddle-lsp

仓库包含 `app/riddle-lsp`，一个基于 `tower-lsp` 的 Language Server Protocol 实现：

- 完整的诊断流水线：解析错误、HIR 诊断、类型检查错误、move/escape 分析诊断全部通过 LSP 推送；
- 增量文本同步（`TextDocumentSyncKind::INCREMENTAL`）；
- UTF-16 位置编码（正确处理多字节字符如 emoji）；
- 多工作区管理与索引：发现每个工作区文件夹中的 Clue 项目，在内存中索引未打开文件的符号、静态调用边和直接类型关系；文件或 manifest 变化只失效受影响的项目快照；
- 补全（`textDocument/completion`）：在 Clue 项目中加载模块和本地依赖，优先使用所有已打开文件的未保存内容；候选遵循词法作用域，包含参数、局部变量和模式绑定，并支持字段、实例方法、模块项、枚举变体、关联函数及导入别名；不可见的公开符号可生成独立 `use path;` 编辑完成自动导入，重名声明保留独立路径；
- 悬停（`textDocument/hover`）：显示函数签名、字段与参数类型，以及局部表达式的推断类型；
- 签名帮助（`textDocument/signatureHelp`）：显示函数或方法签名，并跟踪嵌套调用中的当前参数；
- 声明、定义、类型定义与实现跳转（`textDocument/declaration`、`textDocument/definition`、`textDocument/typeDefinition`、`textDocument/implementation`）：支持局部绑定、模块项、字段、方法及跨文件符号，并把 trait 调用分别映射到 trait 声明和具体 impl；
- 静态调用层级与类型层级：调用边覆盖编译器能够静态确定的自由函数、命名函数值、固有方法和 trait 方法声明；类型层级连接直接 supertrait、子 trait 及 `impl Trait for Type` 的实现类型；
- 项目级引用、重命名、文档高亮、文档符号与工作区符号搜索，支持未打开模块和非文件 URI；
- 文档格式化与基于语法块的代码折叠；
- Inlay Hint 同时提供推断的局部类型和可省略的调用参数名；
- Code Action 可为可变闭包绑定补 `mut`，也可把不安全操作包入 `unsafe` 块；
- 语义 Token（`textDocument/semanticTokens/full`），内置类型使用 `keyword`，区分自由函数、方法、struct、enum 和 trait，关联函数使用 `method` / `static`，标准库符号使用 `defaultLibrary`，并包含函数、参数和方法 `declaration` 及可变局部变量 `declaration` / `mutable` 标记；
- 诊断区分主标签和次要标签（related information），错误码可跳转到错误码手册，注释和修复建议分别以 `note:` / `help:` 附加；
- Clue 项目按原始文件 URI 发布诊断，包括未打开模块，并在重新分析后清理过期诊断；
- 诊断严重性层级：Error、Warning、Information、Hint；
- 文档变更会先合并短时间内的连续输入，再在后台运行诊断并协作式取消过期分析；未变化的文件和无关 Clue 项目直接复用诊断，变化的分析单元复用增量语法树、函数体和全局类型检查缓存，在声明、overlay、磁盘源码或 manifest 变化时保守失效；诊断在 move/borrow 检查后停止，不生成 MIR；UTF-16 位置通过行索引换算，语义 Token 使用包含未保存 overlay 的项目级 HIR，并按文档文本和分析修订缓存；
- 支持动态注册 `.rid` 与 `Clue.toml` 文件监听，编辑器外部的源码、模块和 manifest 变更会触发项目缓存失效与重新诊断；
- 仓库内提供 Helix、VS Code、Zed 和 IntelliJ IDEA 2026.1+ 的 `.rid` 文件与 `riddle-lsp` 适配；

工作区中的 Clue 项目会建立内存索引。补全可通过独立的 `use path;` 编辑自动导入可达的公开符号；调用层级只包含编译器能够静态解析的目标，不推测函数指针、闭包或 Trait 的运行时分派。

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
- `fun(x) { x + 1 }` 与 `move fun(x) { x + 1 }` 匿名函数、单态参数推断和闭包捕获；
- 参数和返回位置的 `impl Fn`、`impl FnMut`、`impl FnOnce`，以及显式泛型 callable bound；
- 按用法推断共享、可变和值捕获，精确追踪静态字段和元组元素，并据此检查 `Fn`、`FnMut`、`FnOnce` 调用能力；
- 每个匿名函数表达式、命名函数项和泛型函数实例具有独立的静态类型；
- 显式类型标注；
- 顶层和 `impl` 内的 `const` 声明（`const NAME: Type = value;`），初始化式会做类型、纯表达式和循环检查；
- 模块和 `impl` 内的有值 `type` 别名，以及 trait 中可省略默认值的关联类型；
- `let` 支持延迟初始化，首次赋值不要求 `mut`，并检查跨 `if`、`match`、循环的 definite-initialization；未初始化读取报 `E0059`，不可变绑定二次赋值报 `E0031`；
- 函数定义和函数声明；
- 泛型函数（类型参数和 const 参数从实参与期望返回类型推断，支持 Rust 风格函数、方法及 `Type::<T>::function::<U>()` 显式参数、`<T: Trait>` bound、`where` 子句，C backend 单态化）；
- 函数参数、返回类型、尾表达式和 `return`；
- 块表达式；
- 结构体字段、元组数字字段（`.0`、`.1` 等）、函数调用和方法调用；
- 数组字面量、数组重复表达式 `[value; N]`、数组与切片安全索引（越界终止并报告运行时错误）；原始指针索引仍需 `unsafe` 且不做边界检查；
- 结构体字面量和字段简写；
- 类型转换表达式 `expr as Type`；支持安全的 `u8 as char` 与 `&str` 到 `&[u8]`，`(*const T, usize)` / `(*mut T, usize)` 到 `&[T]`、`&[u8]` 到 `&str` 的 DST 等布局转换仅允许在 `unsafe` 中使用；
- `unsafe { ... }` 块表达式，以及原始指针解引用和索引的安全上下文检查；
- `unsafe fun` 函数和直接调用检查；不安全函数项不会满足安全的 `Fn*` bound；
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

C backend 对整数回绕、除零、最小值除以 `-1`、移位计数和浮点转整数使用确定性规则：整数算术按位宽回绕，错误除法终止，移位计数按位宽取模并对有符号右移使用算术语义，`NaN` 转整数为零且溢出值钳制到边界。

### 控制流和模式

- `if` / `else if` / `else` 表达式；
- `while` 循环；
- `for item in iterable` 循环，按 `IntoIterator` / `Iterator` 做类型检查，并在 MIR 中降成 `into_iter` / `next` 调用；当前元素、迭代器和提前退出路径具有独立的析构作用域；
- 泛型参数可以通过 `IntoIterator<Item = ..., IntoIter = ...>` bound 使用 `for`，具体 impl 在单态化时解析；
- 标准库 `Range`、固定长度数组 `[T; N]`、共享切片 `&[T]`、可变切片 `&mut [T]` 和 `&str` 可直接用于 `for`，数组按值遍历且不要求元素类型为 `Copy`，字符串迭代产出 Unicode `char`；
- `match` 表达式，以及枚举、布尔值、`()`、整数、元组和结构体的递归穷尽性检查；
- 非穷尽整数匹配会报告未覆盖的连续值区间；
- `match` guard，guard 失败后继续检查后续 arm，且带 guard 的 arm 不计入静态穷尽性；
- `_` 通配模式；
- 标识符绑定模式；
- 字面量模式；
- 路径模式；
- 显式 `&pattern` / `&mut pattern`，支持嵌套引用模式且要求可变性精确匹配；
- 元组模式；
- 结构体模式；
- 枚举 unit/tuple/struct 变体模式，payload 绑定会进入 guard 和 arm 表达式；
- 引用 match ergonomics：结构化模式自动解引用 `&T` / `&mut T`，内部绑定继承共享或可变引用模式；裸绑定保留整个引用，且不提供 `ref` / `ref mut` 语法。默认绑定模式变为引用后，内部不能再写 `mut binding` 或显式引用模式。

### 类型系统

- 整数：`i8`、`i16`、`i32`、`i64`、`isize`、`u8`、`u16`、`u32`、`u64`、`usize`；
- 浮点：`f32`、`f64`；
- `bool`、`char`、`()`、`!`；
- `str`：不定长字符串类型，仅能作为引用、原始指针或 `impl` 的目标；
- `&str`：引用 `str` 的定长胖指针值；
- `[T]`：不定长切片类型，仅能位于引用或原始指针后；
- `&[T]` / `&mut [T]`：携带元素地址和长度的胖指针，可由对应可变性的数组引用自动转换；
- 引用：`&T`、`&mut T`；
- 原始指针类型：`*const T`、`*mut T`；
- 元组类型和元组表达式，例如 `(2, 3)` 与 `(2,)`；
- 固定长度数组 `[T; N]`；
- const generics，例如 `struct Buffer<T, const N: usize> { data: [T; N] }`；
- 结构体；
- 枚举；
- 标准库 `Option<T>` 和 `Result<T, E>`；
- 独立的匿名函数与命名函数项类型，以及静态 `Fn` / `FnMut` / `FnOnce` bound；
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
- 标准库 `Iterator` / `IntoIterator` 协议，含 `std::ops::{Range, range}`、数组 `IntoIterator` 和 `for` 遍历。

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

属性当前会进入 AST/HIR。编译器识别 `#[lang = "..."]`，用于把 trait 标记为编译器内置项。默认加载标准库时，该属性仅允许随编译器附加的标准库使用，用户包中出现会触发 E0049；使用 `--no-std` 时，参与编译的包可以为自定义 core 定义 lang item，编译器仍会检查名称、目标、固定签名和重复注册。

Clue 支持 `#[proc_macro_derive(Name, attributes(...))]`、`#[proc_macro_attribute]` 和 `#[proc_macro]` 导出的 Riddle 过程宏。过程宏包由 `[lib] proc-macro = true` 标记并为宿主平台构建，也可以依赖并使用另一个过程宏包。宏可通过分组、别名、通配符或 `pub use` 导入独立的宏命名空间，混合 `use` 会保留普通名称；derive 只允许放在结构体或枚举上，Riddle 当前没有 union 条目。函数式宏使用 `name!()` 语法，可出现在表达式、条目、类型和模式位置。宏函数接收由 `Group`、`Ident`、`Punct` 和 `Literal` 组成的递归 `TokenStream`；输入、输出、诊断和 span 通过带版本的长度前缀结构化协议传递，输出 token 直接进入解析器。复制到输出的 token 会保留源位置，生成代码中的宏会继续展开，最大深度为 32。LSP 同步支持宏高亮、悬停、定义、引用、别名重命名和补全。

当前标准库会自动拼到用户源码后面，根部通过 prelude 重导出常用项，同时按 Rust 风格分模块定义：

prelude 只直接提供 `Option`、`Result`、`String`、`Vector`、`Some`、`None`、`Ok`、`Err`、`Copy`、`Clone`、`Drop`、`drop`、`Default`、`Into`、`panic`、比较 trait 和迭代协议。集合、格式化 trait、具体迭代器、区间、解析、时间及底层输出函数需要从各自模块显式导入；标准宏命名空间隐式提供 `#[derive(Debug)]`、`print!` 和 `println!`。

- `std::option::Option<T>`，提供 `is_some`、`is_none`、`unwrap_or` 和 `or`；
- `std::result::Result<T, E>`，提供 `is_ok`、`is_err`、`unwrap_or`、`ok` 和 `err`；
- `print!` / `println!` 通过 `std::io::{print, println, print_debug}` 和 `std::fmt::{Debug, Display, Formatter, Result}` 支持字符串、布尔、字符、整数和浮点标量；格式化 trait 和底层输出函数不在 prelude 中。`Debug` 与 `Display` 都使用 `fmt(&self, formatter: &mut Formatter) -> Result`，字符串和字符的 `Debug` 输出会添加引号并转义；标准 `#[derive(Debug)]` 支持结构体、泛型结构体以及 unit、tuple、named 三类枚举变体，`Option`、`Result`、`String`、`Vector`、`HashMap`、`HashSet`、`TreeMap` 和 `TreeSet` 均通过该派生实现 `Debug`，泛型元素必须实现 `Debug`；格式宏支持空调用、字符串字面量、多个 `{}` / `{:?}` 参数、尾随逗号以及 `{{` / `}}`，并按从左到右的顺序分别通过 `Display` / `Debug` 输出；索引参数、命名参数和其他格式说明符尚未实现；
- `std::string::String` 提供 `new`、`from_str`、`as_str`、`len`、`capacity`、`is_empty`、`push_str` 和 `clear`；同一模块按 Rust 风格为 `str` 提供 `len`、`is_empty`、`as_bytes` 和按 Unicode `char` 遍历的 `StrIter`；
- `std::vector::Vector<T>` 提供 `new`、`len`、`capacity`、`is_empty`、`push`、`pop`、`get`、`get_mut`、`swap`、`clear`、`as_slice`、读写下标和按值迭代；下标越界调用 `panic`，缓冲区通过运行时 `rgc_realloc`、`rgc_free` 管理；
- `Vector<T>` 会拒绝零大小元素并检查容量乘法溢出；原始指针目前不能比较空值，因此尚不能在标准库内处理 C 分配失败；
- `std::iter::{Iterator, IntoIterator}`；
- `std::slice::{SliceIter, SliceIterMut}`，并为 `[T]` 提供长度、边界检查访问、原始指针访问和借用迭代；
- `std::array` 中的按值、共享借用和可变借用数组迭代器；
- `std::ops::{Range, range(start, end)}`；
- `std::marker::Copy`；
- `std::clone::Clone`；
- `std::cmp::{Ordering, PartialEq, Eq, PartialOrd, Ord}`；
- `std::ops` 下的算术、位运算、移位、复合赋值以及 `Index` / `IndexMut` trait，均有可调用的必需方法；这些 trait 由对应 `#[lang = "..."]` 标记，用户类型的下标操作静态分派到 `index` / `index_mut`。
- `std::default::Default` 为标量、`Option<T>`、`String` 和 `Vector<T>` 提供默认值；`Default::default()` 支持按期望类型静态选择 impl；
- `std::convert::Into<T>` 是 `?` 错误传播使用的错误转换协议；
- `std::hash::Hash` 通过共享借用为标量提供确定性的 `usize` 哈希值；
- `std::collections::{TreeMap, TreeSet}` 使用红黑树，键要求实现 `Ord`；`std::collections::{HashMap, HashSet}` 使用开放寻址哈希表、线性探测和负载扩容，键要求实现 `Hash + Eq`；对应实现模块位于 `std::collections::{tree_map, tree_set, hash_map, hash_set}`；
- `std::parse::parse_i32` 提供十进制 `i32` 解析；`std::time::time_now` 转发到 C `time`。

`Default`、`Hash`、标量格式化和基础集合/解析/时间 API 已经具备可执行行为；`parse_i32` 当前不做溢出诊断。

当前影响编译器语义的 lang trait 包括：

- `#[lang = "copy"]`：被它标记的 `Copy` trait 会被 move checker 用来决定用户类型是否按复制语义处理；
- `#[lang = "drop"]`：被它标记的 `Drop` trait 提供确定性析构；`Drop + Copy`、直接调用析构方法和从显式 `Drop` 类型移出字段会被拒绝；
- `#[lang = "add"]` 到 `#[lang = "shr"]`：用户类型的算术、位运算和移位会分派到对应 trait 方法；标量 impl 的方法调用直接降为 MIR 运算；
- `#[lang = "neg"]` 和 `#[lang = "not"]`：用户类型的一元负号和逻辑非会分派到对应 trait 方法；标量 impl 的方法调用直接降为 MIR 运算；
- `#[lang = "add_assign"]` 到 `#[lang = "shr_assign"]`：用户类型的复合赋值会分派到对应 trait 方法；标量 impl 的方法调用直接降为 MIR 的读取、运算和写回；
- `#[lang = "index"]` 和 `#[lang = "index_mut"]`：非内建下标读取和可变位置分别静态分派到 `Index::index` 与 `IndexMut::index_mut`；数组、切片和裸指针保留原有直接索引路径；
- `#[lang = "partial_eq"]`：用户类型的 `==` / `!=` 分派到 `PartialEq::eq` / `ne`；
- `#[lang = "partial_ord"]`：用户类型的 `<`、`>`、`<=`、`>=` 分派到 `PartialOrd::lt`、`gt`、`le`、`ge`。

`Clone::clone`、`PartialEq::eq`、`PartialOrd::partial_cmp`、`Ord::cmp` 和各运算 trait 方法可以直接调用。带受支持 lang 标记的标量运算方法不会生成 `add__i64` 一类 C 包装函数，而是生成原生 C 运算表达式。未标记的同名 trait 仍按普通方法编译；用户类型的运算符会调用对应 trait impl 或默认方法。

二元、复合赋值和比较 trait 支持 `Rhs = Self` 默认类型参数以及异构右操作数 impl；泛型约束中的运算符调用在单态化后静态选择具体 impl。赋值求值顺序与 Rust 一致：普通赋值和内建复合赋值先右后左，重载复合赋值先左后右。

### 所有权、移动和逃逸

- 值默认移动；
- `?` 只接受 `Result<T, E>`；成功分支继续当前函数，错误分支通过 `Into` 转换后返回外层 `Result`；
- 标量、共享引用、原始指针和命名函数项等内置 Copy 候选默认可复制；`&mut T` 与闭包值不可复制；
- `Option<T>` 和 `Result<T, E>` 仅在所有 payload 类型实现 `Copy` 时实现 `Copy`；
- 用户类型可以通过实现 `std::marker::Copy` 进入复制语义；编译器会验证结构体字段和所有枚举 payload，并在泛型场景中使用 impl bound；
- move checker 检查移动后使用；
- 借用期间移动会报错；
- 方法和函数返回值会传播引用来源，包含 `Option<&T>` 等泛型包装；元组和数组的来源按元素保留，模式解构不会让无关元素互相延长借用；
- 引用参数支持自动重借用，局部借用可在最后一次使用后结束；
- 模式生成的字段重借用按投影分别追踪；子借用存活时冻结父可变引用，显式引用模式复制 `Copy` 内容而不移动引用；
- 字段访问本身不会移动整个结构体；
- 数组元素和结构体字段按值移动；
- `match` 解构按字段记录部分移动，未移动的兄弟字段仍可继续使用；
- 引用逃逸分析通过过程间的“外泄参数 / 返回来源参数”摘要，决定局部值使用栈分配还是 GC 堆分配。
- 共享/可变闭包捕获会让对应局部获得稳定地址；静态字段和元组元素按投影独立捕获，动态索引与解引用在无法继续静态细分的位置停止；闭包未逃逸时使用栈存储，闭包越过当前栈帧时才提升到 GC 堆，且分配位置不会放宽移动和借用检查；
- `move fun` 按值捕获所有使用到的外部位置；`Copy` 值仍复制，按值捕获本身不会强制闭包成为 `FnOnce`；
- 非 `Copy` 值捕获会在创建闭包时移动该值，`FnOnce` 闭包调用后不可再次使用。
- 需要析构的局部、参数、模式绑定、迭代元素、聚合字段和闭包值使用 drop flag 防止移动后的重复析构；逃逸到 GC 堆只改变地址，仍在所有者结束时确定性运行 `Drop`。

### 字符串和 FFI

- `str` 是不定长类型，不能作为局部变量、参数、返回值或普通字段；
- `&str` 是 `{ ptr, len }` 胖指针，字符串字面量的类型也是 `&str`；
- 字符串字面量支持 `"..."`、`r"..."`、`r#"..."#` 和 `r###"..."###`；
- `extern "C"` 支持声明块和带函数体的导出定义；
- C 导入中的 `&str` 映射为 `const char*`，显式 `#[c_export]` 包装函数也使用该参数 ABI；边界另一侧必须提供 NUL 终止的数据，需要保留长度时应显式传递指针和 `usize`；带函数体的既有 `extern "C"` 定义和普通 Riddle 函数仍使用 `{ ptr, len }`；
- C backend 不按函数名提供任何内置 C helper，所有 `extern "C"` 声明都按普通外部符号生成；
- 标准库通过 `as_bytes().len()` 实现 `str::len`，并用受限的同布局转换实现 `&str` / `&[u8]` 转换；`String::as_str` 先借用 `Vector<u8>` 为 `&[u8]`，再通过普通标准库 unsafe 函数转换为 `&str`，不使用函数 builtin，也不生成或链接 C helper；
- `String` 以 `Vector<u8>` 持有 UTF-8 字节，支持追加、清空和借用为 `&str`；存活的 `as_str()` 视图会阻止可能使其失效的可变操作。

## 后端状态

| 后端 | 状态 |
|------|------|
| C backend | CLI 可用：`--backend c`。输出使用 `rgc` 运行时 ABI；默认 provider 由 `clue` 选择，也支持自定义 provider |

C backend 实现统一的 `Backend` trait：`compile(&mut self, module: &Module) -> Result<String, Error>`。

C backend 会把标量 std 运算 trait 的显式方法调用直接输出为带确定性溢出、除法和移位保护的 `+`、`-`、`*`、`&`、`<<` 等 C 表达式，不声明或定义对应的 primitive wrapper；用户类型的 trait 方法仍输出普通 C 函数。

## 工具状态

| 工具 | 状态 |
|------|------|
| `riddlec` | 编译器 CLI，支持前端检查、MIR 降级和 C backend |
| `riddle-lsp` | LSP 服务器，基于 `tower-lsp`，提供诊断、补全、悬停、签名帮助、符号导航、引用、重命名、格式化、Inlay Hint 和语义 Token，并识别过程宏命名空间 |
| `clue` | 项目构建器，支持 `init`、`new`、`check`、`build` 和 `run`；二进制项目会保留 C 并生成本机可执行文件，库项目只输出 C，过程宏依赖构建为宿主进程 |

## 当前限制

- `parse_i32` 当前接受十进制输入但不报告整数溢出；
- 泛型目前偏向单态化，尚未覆盖完整 Rust 泛型能力；
- `riddlec` 的 C backend 只输出 C；`clue build` 会严格使用 `CC`，或自动选择能完成 C11 编译和链接的系统 C 编译器来生成本机可执行文件；
- 逃逸分析当前粒度是整个局部变量，不做字段级拆分；
- TODO：数组 `IntoIterator` 当前按索引顺序产出元素；若未来允许自定义数组迭代器乱序移出元素，需要先加入 `MaybeUninit` / `ManuallyDrop` 等价存储和逐槽存活状态，确保剩余元素只析构一次；
- 可调用分派仅支持静态单态化；尚不支持 `dyn Fn*`、异构可调用值容器、递归匿名函数、匿名函数泛型参数或匿名函数参数模式；
- `Fn`、`FnMut`、`FnOnce` 是编译器密封能力，用户代码不能手动实现；
- 这是开发中工具链，不保证语法和 ABI 稳定。
