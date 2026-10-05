# 当前工具链状态

本页列出当前实现里确实存在的能力，以及明确的缺口，作为读其他章节时的对照基准。

## 编译流程

`riddlec` 是编译器入口。多个输入文件按换行拼成一个包，各自保留 source map，彼此可以直接引用顶层条目；目录输入不支持。默认把随编译器附带的 std 拼在用户源码之后，`--no-std` 关掉这个行为。

管线按固定顺序执行：

1. parse：词法与语法分析，`IncrementalParser` 支持按片段局部重解析；
2. lower HIR：语法树降到 HIR，条目树、属性与文档注释附着在这一步成形；
3. scope graph：增量作用域图与名字解析，找不到候选时给出 E0050；
4. type check：`IncrementalTypeChecker`，复用未改动函数体与全局检查的结果；
5. escape analysis：过程间不动点，标出需要稳定存储的局部值、参数、临时量和匿名函数环境；
6. move/borrow：移动后使用（E0100）、借用冲突（E0300–E0302）、借用期间的赋值与移动（E0303、E0304）；
7. MIR lowering：降成 SSA 基本块加 Phi 节点，只在需要后端产物时执行；
8. C 后端：只在 `--backend c` 时执行，每个包写出一个 `.c` 文件。

`riddlec file.rid` 不带 `--backend` 或 `--emit` 时在第 6 步之后停止。`-v` 把每一步的 ok / failed / skipped 打到 stdout，设置 `RIDDLEC_PHASE_TIMING` 后各阶段耗时打到 stderr。`--emit mir` 把整个程序的 MIR 打印到 stdout，不需要 C 工具链；`--emit c` 与 `--backend c` 走同一条生成路径，写到 `-o` 指定的位置，没给 `-o` 时用第一个输入文件的文件名加 `.c` 后缀。`--target` 接受 7 个 triple：`x86_64-unknown-linux-gnu`、`aarch64-unknown-linux-gnu`、`i686-unknown-linux-gnu`、`x86_64-pc-windows-msvc`、`i686-pc-windows-msvc`、`aarch64-pc-windows-msvc`、`aarch64-apple-darwin`。选中的 triple 同时给出 `usize`/`isize` 的宽度，整数范围检查用的就是它，运行编译器的那台机器的宽度不参与。

诊断只有一种形式：`{severity}[{code}]: {message}`，随后一行 `--> file:line:col` 和源码摘录，最后可有 `= help:` / `= note:`，末尾汇总 `aborting due to N previous error(s)`。没有 JSON 输出或 `--message-format` 选项。退出码：成功 0，编译失败或没有输入文件 1，clap 参数错误 2。

## MIR 与解释器

MIR 位于类型检查与代码生成之间，形式是 SSA 基本块：

- 终结符 `Branch`、`CondBranch`、`Return`、`Unreachable`，`Phi` 合并多个前驱块的值；
- 分配指令 `Alloca`（栈）与 `HeapAlloc`（GC 堆），由逃逸分析结果选择；
- 内存指令 `Load`、`Store`、`FieldPtr`、`IndexPtr`、`CheckedIndexPtr`、`ExtractValue`、`HeapFree`；
- 运算指令 `Const`、`BinOp`、`UnOp`、`Cmp`、`Cast`、`SizeOf`；
- 值构造 `StructValue`、`SparseStructValue`、`ArrayValue`、`TupleValue`，枚举用稀疏初始化让各变体的 payload 槽位稳定；
- 转换操作码有 `IntToInt`、`IntToChar`、`IntToFloat`、`FloatToInt`、`FloatToFloat`、`BoolToInt`、`IntToBool`、`IntToPtr`、`PtrToPtr`，`Cmp` 支持 `Eq`、`Neq`、`Lt`、`Gt`、`LtEq`、`GtEq`；
- 可调用值统一为 `{ call, env, drop }`，`FunctionRef` 取函数地址，`CallIndirect` 传入环境后调用；
- 类型有 `FnPtr`、`Ptr`、`Struct`、`Enum`、`Tuple`、`Array`、`Slice`、`Str`、`Never`、`Void`，裸 `Str` 与 `Slice` 没有独立大小。

`crates/interpreter` 是树遍历解释器，输入是完全降级后的 `mir::Module`（已单态化，匿名函数与 trait object 已经变成函数指针结构），服务 `riddle run` 和 `riddle repl`，不需要 C 工具链。两种执行方式的结果一致：

| 行为 | 结果 |
| --- | --- |
| 整数算术 | 按位宽回绕 |
| 除零、`MIN / -1` | 终止，输出 `riddle: division by zero` 一类消息，Windows 退出码 3、其它平台 134 |
| 移位 | 计数按位宽取模，有符号右移是算术右移 |
| 浮点转整数 | NaN 转 0，越界钳到 min / max，其余截断 |
| 数组与切片下标 | 先比较下标与长度，越界输出 `riddle: index out of bounds` |
| `&str` 相等 | 按内容比较，不是按地址 |
| panic | `thread 'main' panicked at file:line:col:` 加消息，位置经 source map 映射回 `.rid` 源码 |

解释器覆盖 std 声明的大部分 `extern`：`std::fs` 的文件与目录操作、`time`、`sleep`、随机数、`std::process::exit`、标准输入、`rgc_realloc` / `rgc_free` 等。缺口有两处：过程宏用到的 `riddle_proc_*` 没有 shim，用户自己声明的 `extern "C"` 也没有实现，命中时输出 `riddle: interpreter does not support extern`。

解释器的指针是「分配 id + 偏移」，所有分配零初始化（C 侧只清零描述符列出的指针槽）。内存会回收：`alloca` 取用的块随栈帧返回一起释放，`HeapFree`、`rgc_free` 和 `rgc_realloc` 释放程序持有的堆块，释放出去的 id 会被后续分配重新使用，所以分配表不再随运行时长单调增长。字符串字面量和提升后的存储不是栈帧槽位，它们和 C 后端里的 static 数组一样长期有效。读到已释放的指针直接 trapping，报 `dangling pointer to released allocation N`，而不是把过期字节当作有效数据返回。递归深度上限 200000，栈 256 MiB，超限输出 `riddle: stack overflow ...`。`riddle run` 的退出码：读不到源文件 2，编译失败 1，程序正常返回用 `main` 的返回值，栈溢出与内部错误 101。

## 语言特性

### 词法与语法

- 关键字 34 个：`let`、`fun`、`struct`、`if`、`else`、`while`、`loop`、`break`、`continue`、`return`、`as`、`self`、`mod`、`use`、`mut`、`move`、`pub`、`super`、`crate`、`enum`、`trait`、`impl`、`dyn`、`match`、`const`、`type`、`extern`、`unsafe`、`safe`、`for`、`in`、`where`、`true`、`false`。`Self` 不是关键字，而是 `impl` 作用域里的类型别名：trait 定义、trait 实现和固有 impl 都能用它写返回类型、参数和类型实参（`fun zero() -> Self`、`Vector<Self>`），只有 `Self { … }` 这种构造写法不认，报 `E0050`；`safe` 只在 `unsafe extern` 块内合法；`static`、`ref`、`async`、`await`、`macro`、`box`、`union` 等不是关键字，会被当作普通标识符。
- 注释四种：`//`、`///` 与 `//!`、`/* */`、`/** */` 与 `/*! */`。块注释可嵌套。`/**/` 会先被当成块文档注释开头，随后找不到闭合的 `*/`，因此报未闭合块注释；`//<` 只在同一行紧跟节点之后才作为尾随文档注释附着。
- 整数支持十进制和 `0x`、`0o`、`0b` 前缀、`_` 分隔符与 12 种宽度后缀。浮点是 `1.5`、`1e5`、`1.5f32` 三种形态，`1.` 不是浮点字面量。字符串转义只有 `\n`、`\r`、`\t`、`\0`、`\\`、`\"`、`\'`，没有 `\xHH` 和 `\u{...}`；字符串可以跨行；裸串写成 `r"..."` 或 `r#"..."#`。
- 属性 `#[...]` 内部是平衡 token 序列，可以放在语句、参数、字段、枚举变体、trait 与 impl 条目、match 臂、表达式、类型和模式之前。只有 `#[lang = "..."]`、`#[fundamental]` 和 `#[derive(...)]` 有语义，`#[inline]`、`#[cfg]` 一类既不报错也不生效；内部属性 `#![...]` 不支持。

### 类型系统

- 标量：`i8`、`i16`、`i32`、`i64`、`isize`、`u8`、`u16`、`u32`、`u64`、`usize`、`f32`、`f64`、`bool`、`char`、`()`、`!`。`i128`、`u128`、`f16`、`f128` 只在词法层存在，类型检查报 E0011。
- 不定长类型只有 `str`、`[T]` 和 `dyn Trait`，只能出现在引用或裸指针之后；把它们放进绑定、参数、返回值或字段报 E0043。
- 引用 `&T`、`&mut T`，裸指针 `*const T`、`*mut T`，元组、`[T; N]`、const 泛型参数，`dyn Trait`、`impl Trait`、`impl Fn(..) -> T`。函数类型语法 `fun(T) -> U` 已移除，诊断会指向 `impl Fn`。
- `Copy` 由 `std::marker::Copy` 标记：标量、`&T`、裸指针与函数项天然满足；`&mut T` 不是 `Copy`；元组和数组按元素结构派生；struct 与 enum 必须显式 `impl Copy` 或 `#[derive(Copy)]`，编译器校验全部字段与变体 payload。
- 标为 `mut` 的结构体字段提供内部可变性，`&self` 方法可以直接写它。枚举变体字段不能标 `mut`（报 E0014），普通字段经共享引用写入报 E0309。`mut` 字段上的 `&mut` 只限当次调用内使用：可以当接收者或实参（`add_to(&mut counter.hits)`），不能绑定到名字、不能返回、不能存进别的聚合体。

```riddle
struct Counter {
    pub mut hits: i32,
}

impl Counter {
    fun bump(&self) {
        self.hits += 1;
    }
}

fun main() {
    let counter = Counter { hits: 0 };
    counter.bump();
    println!("{}", counter.hits);
}
```

- 布局检查查找内联包含自己的字段并报 E0072。打断递归环的方式是 `&T`、裸指针、`dyn Trait`、`[T; 0]` 或内部用裸指针的 `Vector<T>`；`[T; N]`（N 非 0）和 `[T]` 不打断。查找按裸名在整个 item tree 里进行，限定路径写法的递归字段可能漏检。
- 关联类型已实现：trait 内声明（可以带默认值）、impl 提供、`dyn Trait<Assoc = T>` 绑定，缺必需关联类型报 E0027；trait 里没有关联 const。

### 条目、模块与可见性

- 条目有 `fun`、`unsafe fun`、`struct`、`enum`、`trait`、`impl`、`mod`、`use`、`const`、`type`、`extern`，路径式宏调用也可以写在条目位置。它们可以出现在顶层，也可以出现在函数体里；条目后不能带分号。`pub` 允许出现在 `fun`、`unsafe fun`、`unsafe extern`、`struct`、`mod`、`use`、`enum`、`trait`、`const`、`type` 之前，不能写在 `impl` 前；struct 字段、trait 条目和 impl 条目可以写 `pub`。
- `mod name { ... }` 内联模块与 `mod name;` 外部模块都在。`use` 支持 `as` 别名、`::*`、`::{a, b as c}`（可嵌套，允许尾逗号）、前导 `::` 和 `self`、`super`、`crate` 段；`pub use` 重导出。
- 可见性检查：私有字段与私有方法在定义模块之外访问报 E0054。固有方法和字段要求同 package 且定义模块包含使用模块，trait impl 的方法不按 `pub` 过滤。同一作用域的顶层重名报 E0064，空 `use` 报 E0051，glob 目标找不到报 E0052。
- `const NAME: Ty = value;` 可以写在模块和 impl 里。初始化式必须是常量表达式：字面量、对其它 `const` 的路径引用、没有语句的块、聚合字面量、一元与二元运算、字段访问、`as`、`?` 和下标可以；函数调用、匿名函数和控制流报 E0060，初始化成环同样报 E0060。常量可以当数组长度和 const 泛型实参。求值器按有符号 `i128` 建模，`const N: i32 = -1;`、`'x'`、`true` 都能折叠，结果按申明类型截断后再查范围，超出范围报 E0011。数组长度和 const 泛型实参仍然要求非负整数。
- `type` 别名在模块和 impl 里必须写成 `type Name = Ty;`，trait 里可以只声明；别名不支持泛型参数，别名环报 E0391。

### 表达式与控制流

- 字面量、运算、调用、`if`、`match`、块、`loop`、`unsafe { }` 都是表达式并且有值，块的尾表达式就是块的值。块状表达式在语句位置可以不带分号，其它表达式必须写。
- 运算符全集：算术 `+ - * / %`，比较 `== != < > <= >=`，逻辑 `&& || !`，位运算 `& | ^ << >>`，前缀 `&`（借用）、`&mut`、`*`（解引用）与 `as`、`?`，赋值 `=` 与 `+= -= *= /= %= &= |= ^= <<= >>=`。除赋值右结合外，所有二元运算符左结合，区间也是左结合：`a..b..c` 解析成 `(a..b)..c`。
- 控制流有 `if` / `else`、`if let`、`while`、`while let`、`loop`、`for ... in ...`、`break`（带值只允许在 `loop` 内，否则 E0065）、`continue`、`return`。`while`、`for` 与无 `else` 的 `if` 的值是 `()`。
- `let` 支持延迟初始化和 `let ... else`；`let` 与 `for` 头部的模式必须不可反驳，否则 E0057。`if let` 之后的绑定在成功分支内可见，`let ... else` 成功后的绑定进入外层作用域。
- `match` 支持 guard、or-pattern 和递归穷尽性检查，非穷尽报 E0039，整数 scrutinee 还会给出未覆盖的区间。
- `?` 接受 `Result<T, E>` 和 `Option<T>`：错误分支经 `Into` 转换后返回（没有 impl 时回退 `From`），`Option` 操作数把 `None` 提前返回。
- 匿名函数用方括号：`[x -> x * 2]`、`[ -> 1]`、`move [x -> x]`，参数可以带类型和模式。后缀位置 `values.map [v -> v * 2]` 把方括号形式当实参调用 `values.map`。方括号语法里没有写泛型参数和返回类型的位置，自递归要用具名函数。`fun(x) { ... }` 与 `|x| x` 两种写法都不存在。
- 宏只有路径式调用 `path!(...)`、`path![...]`、`path!{...}`，参数内容是平衡 token 序列。内置函数式宏 15 个：`assert`、`assert_eq`、`assert_ne`、`debug_assert`、`debug_assert_eq`、`debug_assert_ne`、`format`、`panic`、`print`、`println`、`quote`、`todo`、`unimplemented`、`unreachable`、`vec`。内置 derive 9 个：`Debug`、`Clone`、`Copy`、`Default`、`Hash`、`PartialEq`、`Eq`、`PartialOrd`、`Ord`。格式串只接受字符串字面量，占位符是 `{}`、`{0}`、`{name}`，各自可选 `:?`，没有宽度、精度和对齐。
- 模式种类：`_`、绑定（含 `mut`）、字面量、元组、`&` 与 `&mut`、结构体、枚举的 unit / tuple / struct 变体、路径、or-pattern（只在 match 臂顶层）。没有 `-1` 这类负数字面量、`ref` / `ref mut`、`@` 绑定、切片模式 `[a, b]`、区间模式 `1..=5`、嵌套 or-pattern `Some(1 | 2)`。引用 match ergonomics 会自动解引用 `&T` / `&mut T`，默认绑定模式变成引用后再写 `mut` 或 `&mut` 报 E0010。

### Trait 与泛型

- trait 条目只能是 `fun`、`unsafe fun` 和 `type`；方法可以有默认体，impl 未覆写时使用默认体。
- 支持 supertrait、传递 bound、父方法与环检查（E0044），以及「impl 某 trait 必须 impl 其 supertrait」（E0036）。
- impl 契约检查：缺必需方法 E0026，缺必需关联类型 E0027，`unsafe` 一致性、参数个数、泛型个数不符报 E0028，参数类型不符 E0029，返回类型不符 E0030。
- 一致性检查：重叠 impl 报 E0047，孤儿规则报 E0048，违反 Paterson 条件报 E0037。
- `#[lang = "..."]` 把 trait 标为编译器内置项，驱动运算符与下标分派：`copy`、`drop`、`clone`、`partial_eq`、`eq`、`partial_ord`、`ord`、`debug`，算术与位运算的 `add`、`sub`、`mul`、`div`、`rem`、`neg`、`not`、`bitand`、`bitor`、`bitxor`、`shl`、`shr`，对应的复合赋值 `add_assign` 到 `shr_assign`，以及 `index`、`index_mut`。`option` 和 `result` 是枚举 lang 标记。加载 std 时用户包写内部属性报 E0049；`--no-std` 下可以为自定义 core 定义 lang item。加载 std 时用户包写内部属性报 E0049；`--no-std` 下可以为自定义 core 定义 lang item。
- 泛型支持类型参数与 const 参数（`<T, const N: usize>`）、`<T: A + B>`、`where` 子句。默认类型实参只允许出现在 struct、enum、trait 声明里，函数与 impl 不允许。泛型经单态化实现，泛型递归调用让类型实参不断增长时报 E0033。
- `dyn Trait` 支持关联类型绑定与父 trait 向上转型；`dyn A + B` 和 `impl A + B` 都不支持，多 bound 只能出现在 bound 位置。

### 所有权、借用与逃逸

- 值默认移动，`Copy` 类型按复制传入，移动后使用报 E0100。
- 借用冲突有三档：要可变借用而存在共享借用 E0300，要共享借用而存在可变借用 E0301，同一位置同时两个可变借用 E0302。借用存活期间的赋值与移动分别报 E0303、E0304。
- 借用到绑定的最后一次使用为止（NLL 式近似，不是按 CFG 的活跃变量分析）。
- 通过共享引用写入报 E0309，例外是 `mut` 字段。检查按被调函数的内部写摘要工作；遇到 `dyn` 分派、函数指针调用、泛型 bound 分派和没有函数体的 `extern` 声明时，退化为「该实参的全部 `mut` 字段」这一保守结果。
- `Drop` 类型：不能移出字段（E0305），借用不能比拥有者活得久（E0306），`match` guard 里不能移动被守护的位置（E0307），不能从非 `Copy` 值的解引用移出（E0308），`Drop + Copy` 报 E0055，直接调用 `Drop::drop` 报 E0056。
- 逃逸分析决定局部值放栈还是 GC 堆。默认开启 GC，会逃出栈帧的引用被提升到堆，移动与借用检查不受影响。`Clue.toml` 里写 `[runtime] gc = false` 后语义不同：同样的引用逃逸变成编译错误 E0310，程序必须自己保证不返回、也不保存指向栈值的引用。

```riddle
fun make_value() -> &i32 {
    let value = 7;
    &value
}

fun main() {
    println!("{}", *make_value());
}
```

### 标准库

- 随编译器附带的 std 自动拼在用户源码之后，prelude 直接提供 `Option`、`Result`、`String`、`Vector`、`Some`、`None`、`Ok`、`Err`、`Copy`、`Clone`、`Drop`、`drop`、`Default`、`Into` 和迭代协议，其余从各自模块导入。
- 模块覆盖 `option`、`result`、`string`、`vector`、`iter`、`slice`、`array`、`ops`、`cmp`、`marker`、`clone`、`default`、`convert`、`hash`、`collections`（`Vector`、`HashMap`、`HashSet`、`TreeMap`、`TreeSet`）、`fs`、`io`、`env`、`process`、`mem`、`time`、`random`、`parse`、`char`、`fmt`、`ffi`。
- 没有 `Box`、`Rc`、`Arc`、`Weak`、`Cell`、`RefCell`，也没有 `sync`、`rc`、`thread` 模块。
- 各模块的公开 API 见[常用标准库](./standard-library.md)。

## C 后端与运行时

- 后端接口只返回一个字符串，产物是一个包的单个 `.c` 文件，没有 `.h`；文件头注释给出完整的编译命令。
- 内部符号一律转义成 `riddle_<kind>_<十六进制>`，只有 `extern "C"` 定义和 `#[c_export]` 的函数使用源码原名，且名称必须是合法 C 标识符。
- 类型映射的要点：`&T` 和 `&mut T` 都是 `T*` 且不加 `const`（`mut` 字段要能经共享引用写入）；`str` 与 `&[T]` 是 `{ ptr, len }` 胖表示；枚举降成 tagged struct；匿名函数值是 `riddle_closure_<hash>`，字段为 `call`、`env`、`drop`；`dyn Trait` 是数据指针加方法槽，拥有所有权的形式多一个 `drop` 槽。
- 整数加减乘与位运算先提升到无符号载体再还原，避免有符号溢出 UB；除法与取模内联除零和 `MIN / -1` 检查；越界检查是内联的 `if` 加 `abort()`；panic 输出 `thread 'main' panicked at ...` 后终止。
- GC 描述符表按写入函数的 `heap_alloc` 生成，每个类型一张偏移数组，`NULL` 表示退回逐字保守扫描，槽数上限 `RGC_MAX_DESCRIPTOR_SLOTS` 是 512（第 513 个槽才退化，不是「达到 512 就退化」）。
- 运行时有三份 C 源码：默认的 mark-sweep `runtime.c`、`no_gc_runtime.c` 和总是单独链接的 `args_runtime.c`。只有需要 runtime 的程序才会生成 `int main(int argc, char **argv)` 包装并调用 `riddle_args_init` 与 `rgc_init`；不需要 runtime 的 `fun main() { }` 直接是 `int main(void) { return 0; }`。
- `Clue.toml` 的 `[runtime] source` 可以用自定义 provider 替换内存运行时，provider 至少要提供 `rgc_init`、`rgc_alloc(size, descriptor)`、`rgc_realloc`、`rgc_free`、`rgc_collect`；`gc = false` 与 `source` 互斥。`gc = false` 时编译器把 `heap_alloc` 降为 `riddle_alloc` 并停止生成描述符表。
- FFI 支持的形态：标量、`*const T` / `*mut T`（声明处统一成 `void*`）、`&T`、按值的 struct 与元组、`&[T]`（拆成指针加长度）、导入参数与返回位置上的 `&str`（调用点复制并补 NUL，指针只在这次调用内有效）。不支持的形态：裸 `[T]`、裸 `str` 参数与返回、带泛型参数的 `extern` 声明，导出名非法时报 `is not a valid C identifier`。
- 生成代码的 ABI 属于技术预览，跨版本不保证兼容。

## 编辑器与 LSP

`riddle-lsp` 只有 stdio 传输，参数只有 `--no-std`、`--completion-delay-ms`（默认 40）和 `--trace-latency`。它用与 `riddlec` 相同的检查管线，停在 move/borrow 之后，不降级 MIR。

已实现的能力：增量文本同步、pull 与 workspace 诊断、补全（含自动导入）、悬停、签名帮助、声明 / 定义 / 类型定义 / 实现跳转、查找引用、重命名（带 prepareRename）、调用层级、类型层级、文档与工作区符号、文档高亮、语义 Token（full、range、delta）、Inlay Hint、折叠、选区范围、文档链接、整文档与范围格式化、代码动作。代码动作里有 7 种 quickfix（补 `mut`、包 `unsafe` 块、补缺失字段、补 match 分支、删空 `use`、替换成 `drop(...)` 等）、解析类修复（就近名字建议、导入、生成 trait 方法 stub）和 `source.organizeImports`、`source.addMissingImports`、`source.fixAll` 三个聚合动作。

诊断的 `source` 是 `riddle` 或 `clue`，有码的诊断附带指向错误码手册的链接；服务器自身的码只有 `LSP0001`（缓冲区与编辑器失同步）。`Clue.toml` 的诊断码是 `CLUE0001`–`CLUE0004`。

已知限制：

- 位置编码要协商出 `utf-16`、`utf-8`、`utf-32` 之一，否则 `initialize` 返回 `invalid_params`；
- 类型层级只在客户端支持动态注册时可用，静态 capabilities 里没有它；
- 索引在保存与文件事件上重建；
- Clue.toml 的 schema 是手写白名单，`[build] cache` 会被报成未知键 `build.cache`；
- `--no-std` 会让语义高亮、悬停和补全失去 std 信息；
- 单文档路径用独立检查会话，语义高亮、Inlay Hint 和代码动作不保证跨包。

仓库里提供 VS Code、IntelliJ IDEA 2026.1+、Zed 和 Helix 四个适配。把 `Clue.toml` 路由到服务器的是 VS Code（独立 `clue` 语言 id）和 Helix（按文件名 glob），Zed 与 IntelliJ 只处理 `.rid`。

## 工具与项目

| 工具 | 当前能力 |
| --- | --- |
| `riddlec` | 前端检查、`--emit mir`、`--backend c`、`--no-std`、`--target` |
| `riddle fmt` | 就地改写、`--emit stdout`、`--check`、`--tab-size`、`--hard-tabs`，无文件时读 stdin |
| `riddle run` | 单文件解释执行，`--seed` 与 `--` 之后的程序参数 |
| `riddle repl` | 同一解释器，指令 `:help`、`:reset`、`:mir`、`:quit` |
| `riddle-lsp` | stdio 语言服务器，见上一节 |
| `clue` | 包管理与构建 |

`clue` 的子命令是 `init`、`new`、`check`、`build`、`run`、`add`、`remove`、`fetch`、`update`、`tree`、`metadata`、`package`、`publish`、`install`、`uninstall`、`clean`、`doc`、`test`、`bench`，没有 `fmt`、`lsp`、`repl`、`target`。`Clue.toml` 支持的 section 是 `[package]`、`[dependencies]`、`[dev-dependencies]`、`[features]`、`[[bin]]`、`[lib]`、`[[test]]`、`[[example]]`、`[[bench]]`、`[workspace]`、`[runtime]`、`[build]`；没有 `[profile]`、`[patch]`、`[replace]`、`[lints]`、`[target.*]`、`[workspace.dependencies]`、`[workspace.package]`。依赖有三种来源：版本字符串（registry）、`path`、`git`（`branch`、`tag`、`rev` 只能选一个）。锁文件是 Clue.lock v3。registry 配置不在 Clue.toml，而在 `$CLUE_HOME/config.toml` 或项目下的 `.clue/config.toml`。

宿主 debug 构建写 `.clue/build`，release 或跨目标写 `.clue/build/<triple>/<profile>`。库产物是 `.o`、`.rlib` 和 `.rmeta`（另有可选的静态库与动态库），二进制产物是本机可执行文件；同名库可以命中 `$CLUE_HOME/cache/build` 下的全局缓存，`[build] cache = false` 或 `CLUE_BUILD_CACHE=0` 关闭它。

需要 C 工具链的命令是 `clue build`、`clue run`、`clue test`、`clue bench`、`clue install`：它们生成 C 之后调用 C11 编译器并链接，找不到时报 `no usable C11 compiler and linker found...`，可以用 `CC` 指定；构建库还需要 `ar` 或 `llvm-lib` / `lib`。不需要 C 工具链的是 `clue check`、`clue doc`、`riddle run`、`riddle repl`、`riddle fmt`、`riddle-lsp` 和 `riddlec --emit mir`。`clue doc` 生成 `.clue/doc/*.html`，它的 `-p/--package` 被接受但不生效；`clue new` 没有 `--proc-macro`，过程宏包要手写清单。

过程宏包用 `[lib] proc-macro = true` 标记，导出属性是 `#[proc_macro]`、`#[proc_macro_attribute]` 和 `#[proc_macro_derive(Name)]`。构建产物是动态库加一个 runner 可执行文件，协议版本 1，单次展开超时 10 秒，消息上限 16 MiB。宏里的 `print` 走 stderr（stdout 是协议通道），宏里的 panic 被隔离在子进程里。过程宏宿主里 clue 会注入 `std/std/proc_macro.rid` 与 `std/std/syn.rid`，所以不需要声明 `syn` 依赖；`quote!` 是编译器内置函数宏，std 里没有 `quote.rid`。用法见[内置 `syn` 与 `quote!`](./syn.md)和[编写过程宏](./proc-macros.md)。

## 当前限制

- 单线程语言：没有线程、互斥锁、原子变量、`async` / `await` 和网络，标准库里也没有对应模块。
- 没有生命周期语法，`'a` 是词法错误。返回值的借用来源靠过程间摘要推断，泛型 bound 分派的部分依赖 trait 方法上的 `#[flow = "behind_reference"]` 契约。
- 没有 `Box`、`Rc`、`Arc`、`Weak`、`Cell`、`RefCell`。共享可变状态目前只能用 `mut` 字段表达。
- 范围表达式只有 `a..b` 和 `a..=b`，两端都必须有操作数；`a..`、`..b`、`..` 是语法错误。`match` 里也不能写范围模式 `1..=5`。
- 没有循环标签，`'outer: loop { ... }` 无法解析；跳出多层循环要用函数或标志位。
- 没有 `macro_rules!`。宏只有路径式调用，加上内置宏和 `[lib] proc-macro = true` 包导出的过程宏。
- trait 里不能声明关联 const，`const` 只能出现在模块和 impl 中。
- `i128`、`u128`、`f16`、`f128` 只在词法层可写，语义上不存在这些宽度。
- 没有 `union`、元组结构体、unit 结构体、显式枚举判别值、结构体的函数式更新语法 `..base` 和内部属性 `#![...]`。
- 过程宏运行时接口（`riddle_proc_*`）和用户自定义 `extern "C"` 在解释器下不可用。
- `riddle run` 只接受一个源文件；多文件程序要用 `riddlec` 或 `clue`。
- 数字解析没有十六进制浮点。
- `for` 头部的模式必须不可反驳，否则报 E0057。
- `mut` 字段的内部写检查在 `dyn` 分派、函数指针调用、泛型 bound 分派和无函数体的 `extern` 声明处退化为保守结果。
- 属性没有条件编译：`#[cfg]`、`#[inline]` 之类不生效也不报错。
- 递归类型检查按裸名查找，跨包同名类型会互相干扰，限定路径写法可能漏检。
- 生成代码的 ABI 不保证稳定，跨版本可能不兼容地变化。
