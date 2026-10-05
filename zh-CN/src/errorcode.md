# 错误码参考

编译器的每条错误都带一个四位码，格式是 `error[E0001]: ...`。这个码是稳定接口：LSP 诊断的 `code` 字段就是它，`code_description` 的链接指向本文对应的锚点。语法错误不带码，只打印 `error: expected ...`。

本文收录当前实现定义的 80 个 E 码：78 个由 `crates/` 下的检查器发出，`E0400` 由 `riddlec` 的过程宏驱动发出，`E0200` 目前没有任何发射点。每个条目给出含义、触发条件和一段可单独编译的最小程序，程序里的 `// EXXXX` 注释标出它会触发的码。除 `E0053`（要 `riddlec --no-std` 或写在标准库里）和 `E0310`（要在 Clue.toml 里关掉 GC）以外，示例都能直接用 `riddlec <文件>` 复现。

| 主题 | 码 |
| --- | --- |
| 类型、调用与字面量 | E0001–E0012、E0043 |
| 名字、字段、方法与可见性 | E0013–E0015、E0050–E0052、E0054、E0064 |
| trait、impl 与泛型 | E0020–E0030、E0032–E0037、E0044–E0045、E0047 |
| 内部属性、lang item 与保留名 | E0048–E0049、E0053 |
| 模式、控制流与 unsafe | E0010、E0038–E0039、E0042、E0046、E0057–E0058、E0061–E0063、E0065–E0066 |
| 常量、类型布局与降级 | E0040、E0060、E0067、E0072、E0391 |
| 移动、初始化与析构 | E0031、E0041、E0055–E0056、E0059、E0100、E0305–E0308 |
| 借用、逃逸与 GC | E0200、E0300–E0304、E0309–E0310 |
| 过程宏与内部码 | E0400、E0999 |

## 类型、调用与字面量

<a id="e0001"></a>
### E0001 类型不匹配

`let` 初始化式、赋值、实参、返回值、字段初始化的类型与期望类型不一致时发出。二元运算两侧类型不同（例如 `1 + "a"`）也走这个码，数组长度与期望长度不符同样是它。

```riddle
fun main() {
    let n: i32 = "one";  // E0001
}
```

类型之间的隐式转换白名单很窄，只有数值字面量的待定类型、切片降级、trait object 提升等少数几种，见[数据类型](./type-system.md)。
相关：[E0002](#e0002)、[E0012](#e0012)

<a id="e0002"></a>
### E0002 分支类型无法合并

`if` 与 `else`、`match` 各臂、值位置上的无 `else` `if`，类型对不上时发出。数组重复表达式 `[value; n]` 的长度不是能折进 `usize` 的整数字面量时也是这个码。

```riddle
fun main() {
    let c = true;
    let x = if c { 1 } else { "a" };  // E0002
}
```

`[0; n]` 里的 `n` 是变量时报 array repeat length must be an integer literal that fits usize。分支规则见[控制流](./control-flow.md)。
相关：[E0001](#e0001)、[E0003](#e0003)

<a id="e0003"></a>
### E0003 运算符的操作数类型不对

算术要求数值，`%`、`<<`、`>>` 要求整数，位运算要求整数或 `bool`，排序比较要求两侧兼容的数值、`char` 或实现了 `PartialOrd` 的类型，一元 `!` 要求 `bool` 或整数。

```riddle
fun main() {
    let x = true + 1;  // E0003
}
```

相等比较走 `PartialEq`，缺实现时报 [E0036](#e0036)。运算符清单见[表达式与块](./expressions-and-blocks.md)。

<a id="e0004"></a>
### E0004 调用了不是函数的值

```riddle
fun main() {
    let x = 1;
    x();  // E0004
}
```

可调用值的形态见[函数](./functions.md)与[匿名函数与迭代器](./functional.md)。
相关：[E0005](#e0005)

<a id="e0005"></a>
### E0005 实参个数或形状不符

函数、方法、匿名函数、可调用字段的调用点实参数量不对时发出。泛型调用的类型实参无法从实参和期望返回类型推断出来时，也用这个码，原文是 `cannot infer type argument(s) for ...`。

```riddle
fun f(a: i32) {}

fun main() {
    f();  // E0005
}
```

相关：[E0004](#e0004)、[E0032](#e0032)

<a id="e0006"></a>
### E0006 未知字段

结构体字面量或字段访问用了定义里没有的字段名，枚举结构变体上的字段访问同样处理。

```riddle
struct P { x: i32 }

fun main() {
    let p = P { x: 1 };
    let y = p.y;  // E0006
}
```

相关：[E0007](#e0007)、[E0054](#e0054)、[结构体](./structs.md)

<a id="e0007"></a>
### E0007 结构体字面量缺字段

```riddle
struct P { x: i32, y: i32 }

fun main() {
    let p = P { x: 1 };  // E0007
}
```

字段名写错是 [E0006](#e0006)，不是缺字段。

<a id="e0008"></a>
### E0008 解引用不是引用或裸指针的值

```riddle
fun main() {
    let x = 1;
    let y = *x;  // E0008
}
```

帮助文本里还留着一句「只有数组能下标」，下标失败实际报 [E0036](#e0036)。

<a id="e0009"></a>
### E0009 结构体字面量或变体的形状不对

路径解析到的不是结构体、给元组变体写结构体字段、结构体字面量的类型实参个数不对，都报这个码。

```riddle
enum E { A(i32) }

fun main() {
    let x = E::A { v: 1 };  // E0009
}
```

路径本身找不到是 [E0050](#e0050)，变体不属于被匹配的枚举是 [E0038](#e0038)。

<a id="e0011"></a>
### E0011 字面量后缀或数值范围非法

词法层接受 `i128`、`u128`、`f16`、`f128` 后缀，类型系统里没有这些类型，写出来会得到「不支持」的提示；无法识别的后缀报未知后缀。字面量和常量值超出目标类型范围时也是这个码。`usize`/`isize` 的边界由选中的目标给出（`--target`、`RIDDLE_TARGET` 或 `[build].target`），`i686-*` 下 `4294967296usize` 越界，64 位目标下合法；运行编译器机器的宽度不参与。

```riddle
fun main() {
    let x = 1i128;  // E0011
}
```

`let x: u8 = 300;` 报整数越界。`42_i99` 不属于这个码：`_` 会另起一个 token，得到的是解析错误，而解析错误不带码。

<a id="e0012"></a>
### E0012 `as` 的类型对不支持

支持的组合：整数之间、整数与浮点之间、整数转 `bool`、`bool` 与 `char` 转整数、`u8` 转 `char`、裸指针之间，以及 `&T` 转 `*const T`/`*mut T`（要求 `T` sized，目标可变时源也必须可变）。其余组合报这个码。

```riddle
fun main() {
    let x = true as f64;  // E0012
}
```

`(*const T, usize)` 与 `&[T]`、`&[u8]` 与 `&str` 之间的布局转换需要 `unsafe`；`*const T` 转 `*mut T` 单独需要 `unsafe`，缺了报 [E0046](#e0046)。指针与 FFI 见 [FFI 与 C 后端](./ffi-and-tooling.md)。

<a id="e0043"></a>
### E0043 不定长类型出现在需要定长的位置

`str`、`[T]`、`dyn Trait` 没有独立于借用或指针的布局，不能作为局部绑定、参数、返回值、字段，也不能作为元组、数组、结构体、枚举的类型实参。`&T` 和 `*const T` 的内层允许不定长。

```riddle
struct S { s: str }  // E0043
```

字符串值用 `&str`，切片与 trait object 用 `&[T]`、`&dyn Trait` 或拥有形式。见[数据类型](./type-system.md)。
相关：[E0072](#e0072)

## 名字、字段、方法与可见性

<a id="e0013"></a>
### E0013 方法不存在或不能动态派发

接收者上没有这个固有方法或 trait 方法时报 unknown method。`dyn Trait` 上同名多来源的歧义方法、以及不满足对象安全的方法（按值 `self`、泛型方法、参数或返回值里出现裸 `Self`）在被调用时也报这个码。

```riddle
struct P {}

fun main() {
    let p = P {};
    p.missing();  // E0013
}
```

对象安全不是 trait 声明处的硬性检查：声明本身能通过，调用点才报错。

```riddle
trait T { fun consume(self) -> i32; }

struct S {}

impl T for S { fun consume(self) -> i32 { 1 } }

fun f(x: &dyn T) -> i32 {
    x.consume()  // E0013
}
```

见 [Trait](./traits.md)与 [impl 块](./impls.md)。
相关：[E0054](#e0054)

<a id="e0014"></a>
### E0014 枚举变体字段不能写 `mut`

结构体字段上的 `mut` 表示经共享引用也能写；变体字段只能通过模式到达，写入无法穿过对枚举的共享引用，因此直接拒绝。

```riddle
enum E { A { mut x: i32 } }  // E0014

fun main() {}
```

把字段放进结构体，或改用 `&mut` 接收者。见[结构体](./structs.md)。

<a id="e0015"></a>
### E0015 函数声明缺少函数体

`fun` 声明以分号结束时没有函数体：MIR 降级不会为它生成任何函数，对它的调用只会在运行期以 "call to unknown function" 失败，因此在编译期拒绝。`extern` 块里的声明不受此限制。

```riddle
fun helper() -> i32;  // E0015

fun main() -> i32 { helper() }
```

补上函数体，或把声明移入 `unsafe extern "C"` 块。

<a id="e0050"></a>
### E0050 名字解析不到

作用域图在所有可见作用域里都找不到这个路径时发出。

```riddle
fun main() {
    let x = missing;  // E0050
}
```

见[模块、use 与包](./modules.md)。
相关：[E0051](#e0051)、[E0052](#e0052)、[E0064](#e0064)

<a id="e0051"></a>
### E0051 空的 use 声明

`use` 树里没有任何可以暴露的名字，例如只写了 `crate`、`super` 这样的锚点。

```riddle
use crate;  // E0051
```

<a id="e0052"></a>
### E0052 glob 导入的目标找不到

```riddle
use missing::*;  // E0052
```

普通路径导入失败报 [E0050](#e0050)。

<a id="e0054"></a>
### E0054 字段或方法不可见

结构体字段与固有方法默认私有，可见性要求同一个包，并且定义模块包含使用模块。trait impl 里的方法不做可见性过滤。

```riddle
mod m {
    pub struct P { value: i32 }
}

fun read(p: m::P) -> i32 {
    p.value  // E0054
}
```

加 `pub`，或通过类型自己提供的公开方法访问。见[模块、use 与包](./modules.md)。

<a id="e0064"></a>
### E0064 同一作用域里重名

函数、结构体、枚举、trait、常量、类型别名、模块共享当前作用域的声明名，重复定义时两个位置都会被标注。

```riddle
fun f() {}

fun f() {}  // E0064
```

不同模块里的同名声明不冲突。相关：[E0050](#e0050)

## trait、impl 与泛型

<a id="e0020"></a>
### E0020 trait 内重复方法，或 callable 签名不符

同一个 trait 里定义了两个同名方法时发出。`impl Fn* for T` 的 `call` 方法签名与 impl 头写的调用签名不一致时也用这个码。

```riddle
trait T {
    fun f();
    fun f();  // E0020
}
```

两个 impl 方法签名不符是 [E0028](#e0028)、[E0029](#e0029)、[E0030](#e0030)。

<a id="e0021"></a>
### E0021 callable impl 缺 `call`

`impl Fn(..) -> T for X` 要求实现体提供 `call`。`Fn` 用 `&self`，`FnMut` 用 `&mut self`，`FnOnce` 用 `self`。

```riddle
struct S {}

impl Fn(i32) -> i32 for S {}  // E0021
```

<a id="e0022"></a>
### E0022 trait 内重复关联类型

```riddle
trait T {
    type A;
    type A;  // E0022
}
```

`dyn Trait<X = ..>` 里对同一个关联类型写两次绑定也是这个码。相关：[E0025](#e0025)、[E0034](#e0034)

<a id="e0023"></a>
### E0023 引用了未知 trait

`impl` 的 trait、`impl Trait`、泛型 bound 里写了找不到的 trait 名时发出。

```riddle
struct S {}

impl Missing for S {}  // E0023
```

相关：[E0044](#e0044)

<a id="e0024"></a>
### E0024 impl 内重复方法

```riddle
struct S {}

impl S {
    fun f() {}
    fun f() {}  // E0024
}
```

<a id="e0025"></a>
### E0025 impl 内重复关联类型

```riddle
struct S {}

impl S {
    type A = i32;
    type A = i64;  // E0025
}
```

<a id="e0026"></a>
### E0026 impl 缺少必需方法

trait 里没有默认体的方法必须在 impl 里出现。

```riddle
trait T { fun f(); }

struct S {}

impl T for S {}  // E0026
```

trait 方法有默认体时不报，关联类型看 [E0027](#e0027)。

<a id="e0027"></a>
### E0027 impl 缺少必需关联类型

trait 里没有默认值的类型别名必须在 impl 里给出。

```riddle
trait T { type A; }

struct S {}

impl T for S {}  // E0027
```

<a id="e0028"></a>
### E0028 impl 方法签名与 trait 声明不符

参数个数、泛型个数、`unsafe` 不一致都报这个码。

```riddle
trait T { fun f(x: i32); }

struct S {}

impl T for S {
    fun f() {}  // E0028
}
```

参数类型不符是 [E0029](#e0029)，返回类型不符是 [E0030](#e0030)。

<a id="e0029"></a>
### E0029 impl 方法参数类型不符

```riddle
trait T { fun f(x: i32); }

struct S {}

impl T for S {
    fun f(x: bool) {}  // E0029
}
```

<a id="e0030"></a>
### E0030 impl 方法返回类型不符

```riddle
trait T { fun f() -> i32; }

struct S {}

impl T for S {
    fun f() -> bool { true }  // E0030
}
```

<a id="e0032"></a>
### E0032 泛型实参个数不符

结构体、枚举、trait 的类型实参个数与声明不匹配时发出。trait 参数带默认值时，尾部的实参可以省略。

```riddle
struct B<T> { v: T }

fun f(b: B<i32, i32>) {}  // E0032
```

相关：[E0005](#e0005)、[泛型](./generics.md)

<a id="e0033"></a>
### E0033 泛型递归让类型实参变大

泛型函数递归调用自己时，实际类型实参如果被包进了更大的类型，单态化会没有终点，编译器在调用图上找到这种环就拒绝。

```riddle
struct Box<T> { v: T }

fun wrap<T>(v: T) {
    wrap(Box { v });  // E0033
}
```

类型实参相同的递归是允许的，见[泛型](./generics.md)。

<a id="e0034"></a>
### E0034 类型标注非法

类型名找不到、`dyn Trait` 缺关联类型绑定、数组类型写反（`[3; i32]`）等都在这里报。未知类型名走这个码，不是 [E0050](#e0050)。

```riddle
fun main() {
    let x: Missing = 1;  // E0034
}
```

数组类型写反时另给一条 note：`array types use [T; N]; write [i32; 3] instead`。

<a id="e0035"></a>
### E0035 trait bound 不满足

调用点、方法查找、`for` 迭代协议等位置要求某个类型实现 trait，而实际类型没有实现时发出。

```riddle
trait M {}

struct B<T> where T: M { v: T }

struct P {}

fun main() {
    let b = B { v: P {} };  // E0035
}
```

见[泛型](./generics.md)、[Trait](./traits.md)。
相关：[E0036](#e0036)

<a id="e0036"></a>
### E0036 缺少运算符或索引所需的实现

相等比较缺 `PartialEq`、索引缺 `Index`/`IndexMut`、类型不能被下标类型索引，以及 impl 了某个 trait 却没有 impl 它的 supertrait，都报这个码。

```riddle
struct P {}

fun main() {
    let x = P {} == P {};  // E0036
}
```

排序比较（`<`、`>`）两侧不兼容走 [E0003](#e0003)。同点原始指针的 `==` 是内建按地址比较，不需要实现。

<a id="e0037"></a>
### E0037 impl 的 where 子句违反 Paterson 条件

impl 的 `where` bound 必须严格小于被 impl 的类型，否则 trait 求解可能不终止。

```riddle
trait F {}

struct V<T> { v: T }

impl<T> F for T where V<T>: F {}  // E0037
```

<a id="e0044"></a>
### E0044 supertrait 未知或成环

```riddle
trait C: Missing {}  // E0044
```

`trait First: Second` 与 `trait Second: First` 这样的环同样报这个码。impl 了子 trait 却没有 impl 父 trait 报 [E0036](#e0036)。

<a id="e0045"></a>
### E0045 类型推断不出来

匿名函数参数没有标注类型，且没有任何地方能约束它时发出。延迟绑定的 `let` 在首次赋值前也推不出类型，同样报这个码。

```riddle
fun main() {
    let f = [x -> x];  // E0045
}
```

写成 `[x: i32 -> x]`，或让调用点约束参数类型。见[匿名函数与迭代器](./functional.md)。
相关：[E0067](#e0067)

<a id="e0047"></a>
### E0047 impl 冲突或重叠

同一个 trait 的两个 impl header 覆盖到同一组类型时发出，第二条诊断会指向先出现的 impl。callable impl 缺调用签名、`dyn Fn` 缺签名也用这个码。

```riddle
trait F {}

struct P {}

impl F for P {}

impl F for P {}  // E0047
```

`impl Fn for S {}` 报 impl Fn requires a callable signature。见 [impl 块](./impls.md)。
相关：[E0048](#e0048)

## 内部属性、lang item 与保留名

<a id="e0048"></a>
### E0048 违反孤儿规则

当前包只能实现自己定义的 trait，或为自己定义的类型实现外部 trait。判定顺序是先查 impl 重叠（[E0047](#e0047)），再查本地性：`&T` 与 `#[fundamental]` 类型会传递本地性，本地类型之前不能出现未被覆盖的类型参数。`Fn`、`FnMut`、`FnOnce` 名字由编译器保留，重名声明也报这个码。

```riddle
impl Clone for () {  // E0048
    fun clone(&self) -> () { () }
}
```

`Clone` 与 `()` 都来自标准库，所以这是外部 trait 加外部类型。见 [Trait](./traits.md)。

<a id="e0049"></a>
### E0049 用户包使用了保留的内部属性

默认加载标准库时，`#[lang = "..."]` 与 `#[fundamental]` 只允许出现在随编译器附加的标准库中。来源检查优先于属性形状检查，所以用户包里的任何写法统一报这个码。

```riddle
#[lang = "copy"]  // E0049
trait MyCopy {}
```

用 `riddlec --no-std` 时不附加标准库，参与编译的包可以自行定义 lang item，那时形状错误才由 [E0053](#e0053) 接管。

<a id="e0053"></a>
### E0053 lang item 或 `#[fundamental]` 的形状非法

lang 名未知、同一个 lang item 定义两次、一个 trait 标多个 `[lang]`、目标不是 trait 或枚举、缺字符串值、签名不符、`Option` 与 `Result` 的泛型个数不对，以及 `#[fundamental]` 用在非类型上或带了值，都报这个码。

```text
// 需要 riddlec --no-std，或写在标准库自身里
#[lang = "unknown"]
trait F {}          // E0053: unknown lang item 'unknown'

#[lang = "copy"]
trait A {}

#[lang = "copy"]
trait B {}          // E0053: lang item 'copy' is defined more than once
```

在默认标准库模式下，同样的写法先被 [E0049](#e0049) 拦下。

## 模式、控制流与 unsafe

<a id="e0010"></a>
### E0010 模式元数或绑定修饰符位置不对

元组模式的元素个数与值不符、`&pat` 没有初值、在自动引用解构后的模式里再写 `mut` 或 `&mut`，都报这个码。

```riddle
fun main() {
    let (x, y) = (1, 2, 3);  // E0010
}
```

模式形状与类型不符是 [E0038](#e0038)，同一模式里重复绑定是 [E0058](#e0058)。见[枚举、模式与 match](./enums-and-patterns.md)。

<a id="e0038"></a>
### E0038 模式的形状或类型不符

解构元数不对、变体不属于被匹配的枚举、把非枚举值写成路径模式等，都报这个码。

```riddle
enum L { S }

enum R { S }

fun f(x: L) -> i32 {
    match x {
        R::S => 1,  // E0038
        L::S => 0,
    }
}
```

<a id="e0039"></a>
### E0039 match 不穷尽

至少有一个取值没有被任何无 guard 的臂覆盖。诊断会给出一个缺失模式，整数模式还会在 note 里列出未覆盖的区间；带 guard 的臂不计入穷尽性。

```riddle
enum S { A, B }

fun f(s: S) -> i32 {
    match s {
        S::A => 1,  // E0039
    }
}
```

补上缺失的臂，或用 `_` 覆盖剩余取值。

<a id="e0042"></a>
### E0042 break 或 continue 不在循环里

```riddle
fun f() {
    break;  // E0042
}
```

`while`、`loop`、`for` 的函数体、闭包体都不构成循环边界。见[控制流](./control-flow.md)。
相关：[E0065](#e0065)

<a id="e0046"></a>
### E0046 该操作需要 unsafe

解引用或索引裸指针、调用 `unsafe fun` 与不安全的外部函数、裸部件与切片的布局转换、`*const T` 转 `*mut T`，都必须在 `unsafe` 块里。

```riddle
fun f(p: *const i32) -> i32 {
    *p  // E0046
}
```

`unsafe` 只支持块形式，`fun f() { unsafe foo(); }` 会得到语法错误。裸指针的有效性由程序员保证。见 [FFI 与 C 后端](./ffi-and-tooling.md)。
相关：[E0012](#e0012)

<a id="e0057"></a>
### E0057 let 或 for 头里的模式可反驳

普通 `let` 与 `for` 头没有备选分支，模式必须覆盖该类型的每个取值。`let-else` 的 `else` 能发散时不受此限制。

```riddle
fun main() {
    let o: Option<i32> = Option::Some(1);
    let Option::Some(v) = o;  // E0057
}
```

换成 `let Option::Some(v) = o else { return; };`，或改用 `match`。见[枚举、模式与 match](./enums-and-patterns.md)。
相关：[E0038](#e0038)、[E0066](#e0066)

<a id="e0058"></a>
### E0058 同一模式里重复绑定

一个模式内的绑定名必须唯一。不同 `let` 语句或不同臂之间可以正常遮蔽同名变量。

```riddle
fun main() {
    let (a, a) = (1, 2);  // E0058
}
```

<a id="e0061"></a>
### E0061 `?` 的操作数不是 Option 或 Result

`?` 只能展开标准库的 `Option` 与 `Result`，用在普通值或自定义枚举上报这个码。

```riddle
fun f() -> i32 {
    let x = 1?;  // E0061
    x
}
```

见[错误处理](./error-handling.md)。
相关：[E0062](#e0062)、[E0063](#e0063)

<a id="e0062"></a>
### E0062 `?` 与函数返回类型不匹配

含 `?` 的函数必须返回同一种枚举：操作数是 `Result` 就返回 `Result`，是 `Option` 就返回 `Option`。

```riddle
fun f() -> i32 {
    let x = Option::Some(1)?;  // E0062
    x
}
```

<a id="e0063"></a>
### E0063 `?` 的错误类型转不过去

源错误类型到返回类型的错误类型，编译器先找 `Into::into`，再找 `From::from`；两条路都拿不到目标类型时报这个码。

```riddle
fun g() -> Result<i32, i32> { Result::Err(1) }

fun f() -> Result<i32, bool> {
    let x = g()?;  // E0063
    Result::Ok(x)
}
```

<a id="e0065"></a>
### E0065 带值的 break 出现在 loop 之外

只有 `loop` 能用带值的 `break` 交出结果，`while` 与 `for` 里只能写 `break;`。

```riddle
fun f() {
    while true {
        break 1;  // E0065
    }
}
```

相关：[E0042](#e0042)

<a id="e0066"></a>
### E0066 let-else 的 else 块不发散

`let-else` 的 `else` 块必须离开当前控制流，正常落到绑定之后会报这个码。`return`、`break`、`continue`、`panic!` 或不会结束的 `loop` 都可以。

```riddle
fun main() {
    let o: Option<i32> = Option::Some(1);
    let Option::Some(v) = o else { 0 };  // E0066
}
```

写成 `else { return; }` 就能通过。相关：[E0057](#e0057)

## 常量、类型布局与降级

<a id="e0040"></a>
### E0040 源码无法降级到 HIR

HIR 降级阶段遇到它解析不了的东西时发出，最常见的是超出 `u64` 的整数字面量。

```riddle
fun main() {
    let x = 99999999999999999999;  // E0040
}
```

类型已经确定、只是超出目标类型范围的字面量报 [E0011](#e0011)。

<a id="e0060"></a>
### E0060 常量初始化式不是常量表达式，或常量成环

常量初始化式允许字面量、对其它常量的引用、非赋值的二元运算、无语句的块、元组/数组/结构体字面量、一元 `-`/`+`/`!`、字段访问、`as`、`?` 和下标。函数调用、闭包、`if`/`while`/`loop`/`for`/`match`/`unsafe`、带语句的块、赋值都不允许。

```riddle
fun g() -> i32 { 0 }

const X: i32 = g();  // E0060
```

`const A: i32 = B;` 与 `const B: i32 = A;` 这样相互引用同样报这个码。常量值超出申明类型范围报 [E0011](#e0011)。

<a id="e0067"></a>
### E0067 推断出无限类型

统一两个类型时检出自我引用的替换环，继续下去会构造出无限大的类型。典型写法是把一个参数类型尚未确定的匿名函数传给它自己。

```riddle
fun main() {
    let id = [value -> value];
    id(id);  // E0067
}
```

这段代码同时也会报 [E0045](#e0045)，因为 `value` 的类型同样推不出来。给绑定加显式标注或改掉自应用即可。

<a id="e0072"></a>
### E0072 递归类型大小无限

结构体或枚举的字段内联包含自己时发出，诊断会给该字段挂 `recursive field` 次标签。`&T`、`*const T`、`*mut T`、`impl Trait`、`dyn Trait` 和长度为 0 的 `[T; 0]` 都能打断环；`[T; N]`（`N` 不为 0）和 `[T]` 不能。

```riddle
struct N { next: N }  // E0072
```

标准库里没有 `Arc`/`Rc`，共享递归结构要靠 `&T`、裸指针、`dyn Trait` 或 `Vector<T>`（内部是 `*mut T`）。类型别名成环是 [E0391](#e0391)。
相关：[E0043](#e0043)

<a id="e0391"></a>
### E0391 类型别名展开成环

```riddle
type A = A;  // E0391
```

这是别名环，与 [E0072](#e0072) 的布局环是两回事。

## 移动、初始化与析构

<a id="e0031"></a>
### E0031 给不可变绑定赋值

左侧绑定没有 `mut` 却被重新赋值时发出。复合赋值的左值不可变、调用需要 `&mut self` 的方法但接收者绑定不可变、把需要修改捕获环境的匿名函数存进不可变绑定，也报这个码。

```riddle
fun main() {
    let x = 1;
    x = 2;  // E0031
}
```

经共享引用写入是 [E0309](#e0309)，两者不是一回事。见[变量与可变性](./variables-and-mutability.md)。

<a id="e0041"></a>
### E0041 Copy impl 不合法

为类型实现 `Copy` 时，它的所有字段也必须 `Copy`，否则副本会与原件共享资源。无法枚举字段的类型（例如 `&mut T`）同样报这个码。

```riddle
struct T { v: i32 }

struct W { v: T }

impl Copy for W {}  // E0041
```

字段全 `Copy` 的结构体也不会自动 `Copy`，必须显式 impl 或 `[derive(Copy)]`。同时实现 `Drop` 是 [E0055](#e0055)。

<a id="e0055"></a>
### E0055 为实现了 Drop 的类型实现 Copy

拥有析构逻辑的类型不能按位复制，否则多个副本会重复释放同一份资源。去掉其中一个 impl。

```riddle
struct S {}

impl Drop for S {
    fun drop(&mut self) {}
}

impl Copy for S {}  // E0055
```

<a id="e0056"></a>
### E0056 直接调用 Drop::drop

析构方法只能由编译器调用。要提前结束一个值，用标准库的 `drop(value)`。

```riddle
struct S {}

impl Drop for S {
    fun drop(&mut self) {}
}

fun f(mut s: S) {
    s.drop();  // E0056
}
```

析构顺序与 drop glue 见[移动语义](./move-semantics.md)。

<a id="e0059"></a>
### E0059 读取未初始化的绑定

`let x;` 可以延迟初始化，但每条到达使用点的路径都必须先赋值；编译器合并 `if`、`match` 与循环的控制流，可能仍未初始化的读取就报这个码。

```riddle
fun f() -> i32 {
    let x: i32;
    x  // E0059
}
```

<a id="e0100"></a>
### E0100 使用已移动的值

值被移动后再次使用时报这个码。`&T`、`*const T` 是 `Copy`，`&mut T` 不是；结构体与枚举不会因为字段全 `Copy` 就自动 `Copy`。

```riddle
struct P { x: i32 }

fun main() {
    let a = P { x: 1 };
    let b = a;
    let c = a;  // E0100
}
```

移动语义与部分移动见[移动语义](./move-semantics.md)。
相关：[E0304](#e0304)、[E0305](#e0305)、[E0308](#e0308)

<a id="e0305"></a>
### E0305 从实现了 Drop 的类型里移出字段

实现了 `Drop` 的值必须整体保持有效，单独移出非 `Copy` 字段会跳过析构，因此被拒。

```riddle
struct Guard {}

struct Owner { guard: Guard }

impl Drop for Owner {
    fun drop(&mut self) {}
}

fun main() {
    let owner = Owner { guard: Guard {} };
    let Owner { guard } = owner;  // E0305
}
```

字段是 `Copy` 时那是复制，不算移出。没有显式 `Drop` 的聚合类型可以部分移动，编译器用字段级 drop flag 避免重复析构。
相关：[E0100](#e0100)、[E0307](#e0307)

<a id="e0306"></a>
### E0306 借用的存活期超过 Drop 拥有者

实现 `Drop` 的局部值在作用域结束时被确定性析构，指向它的引用不能作为返回值或捕获进逃逸的匿名函数活得更久。

```riddle
struct Guard { value: i32 }

impl Drop for Guard {
    fun drop(&mut self) {}
}

fun leak() -> &i32 {
    let guard = Guard { value: 1 };
    &guard.value  // E0306
}
```

把所有权移出函数，或让引用只在拥有者作用域内使用。见[引用、借用与逃逸](./references-and-escape.md)。

<a id="e0307"></a>
### E0307 在 match guard 里移动

guard 失败时还要继续尝试后面的臂，所以 guard 只能查看或借用非 `Copy` 的模式绑定，不能取得所有权；把 place 移进匿名函数同样被拒。

```riddle
struct Token {}

enum MaybeToken { Some(Token), None }

fun consume(value: Token) -> bool { true }

fun main(value: MaybeToken) {
    match value {
        MaybeToken::Some(token) if consume(token) => {},  // E0307
        MaybeToken::Some(token) => {},
        MaybeToken::None => {},
    }
}
```

把移动放到选中臂的 body 里，或先借用再判断。
相关：[E0304](#e0304)、[E0305](#e0305)

<a id="e0308"></a>
### E0308 从解引用里移出非 Copy 值

`*reference` 或显式 `&pattern`/`&mut pattern` 里的按值绑定会读取引用指向的 `T`；引用不拥有这个值，`T` 不是 `Copy` 时不能搬出来。

```riddle
struct Token {}

fun main() {
    let token = Token {};
    let r = &token;
    let m = *r;  // E0308
}
```

保留引用并通过它访问，或只在确实允许按位复制时为类型实现 `Copy`。`*reference = value` 是写回原位置，不属于这个码。
相关：[E0100](#e0100)

## 借用、逃逸与 GC

<a id="e0200"></a>
### E0200 保留码

`E0200` 当前没有任何发射点。逃逸提升是静默的：逃逸分析的结果只用来决定 MIR 里用 `alloca` 还是堆分配，不会转成用户可见的诊断。

```text
// 没有可复现的写法：源码中不存在这个码的发射点
```

<a id="e0300"></a>
### E0300 要可变借用，已有共享借用

同一个 place 上已有共享借用且仍然活跃时，不能再创建可变借用。

```riddle
fun main() {
    let mut x = 1;
    let r = &x;
    let m = &mut x;  // E0300
    println!("{} {}", *r, *m);
}
```

借用到持有它的绑定的最后一次使用为止，按源码位置计算，所以先用完再借是允许的：

```riddle
fun main() {
    let mut x = 1;
    let r = &x;
    println!("{}", *r);
    let m = &mut x;
    *m = 2;
}
```

这个近似不是 CFG 活跃性分析，循环体会做不动点迭代，冲突只报一次。见[引用、借用与逃逸](./references-and-escape.md)。
相关：[E0301](#e0301)、[E0302](#e0302)、[E0309](#e0309)

<a id="e0301"></a>
### E0301 要共享借用，已有可变借用

```riddle
fun main() {
    let mut x = 1;
    let m = &mut x;
    let r = &x;  // E0301
    println!("{} {}", *m, *r);
}
```

<a id="e0302"></a>
### E0302 同一 place 同时两个可变借用

```riddle
fun main() {
    let mut x = 1;
    let a = &mut x;
    let b = &mut x;  // E0302
    println!("{} {}", *a, *b);
}
```

不相交的结构体字段可以分别可变借用；已知常量下标可以分别可变借用，动态下标按重叠处理。方法返回的引用会保持接收者被借用。
相关：[E0300](#e0300)

<a id="e0303"></a>
### E0303 借用期间赋值

place 仍有活跃借用时不能给它赋值。

```riddle
fun main() {
    let mut x = 1;
    let r = &x;
    x = 2;  // E0303
    println!("{}", *r);
}
```

相关：[E0304](#e0304)、[E0309](#e0309)

<a id="e0304"></a>
### E0304 借用期间移动

place 仍有活跃借用时不能移动它，模式里的字段移动和移进匿名函数同样受限。

```riddle
struct P { x: i32 }

fun main() {
    let p = P { x: 1 };
    let r = &p;
    let q = p;  // E0304
    println!("{} {}", r.x, q.x);
}
```

相关：[E0303](#e0303)、[E0100](#e0100)、[E0307](#e0307)

<a id="e0309"></a>
### E0309 通过共享引用写入

`&T` 只能读。字段访问和下标会隐式解引用，所以经共享引用写入与显式 `*r = value` 一样被拒；`&self` 接收者同理。

```riddle
struct Counter { mut hits: i32, name: i32 }

impl Counter {
    fun bump(&self) {
        self.name = 1;  // E0309
    }
}
```

字段声明成 `mut` 就不受这条限制：经 `&self` 写 `hits`、或对 `hits` 调用需要 `&mut self` 的方法都可以。但 `mut` 字段上取 `&mut` 只允许出现在调用里（实参或接收者），绑定到名字、返回或存进其它聚合体会报同一个码。

```riddle
struct Counter { mut hits: i32, name: i32 }

fun add_to(target: &mut i32) {
    *target += 1;
}

impl Counter {
    fun bump(&self) {
        self.hits += 1;
        add_to(&mut self.hits);
    }
}

fun main() {
    let counter = Counter { hits: 0, name: 0 };
    counter.bump();
}
```

```riddle
struct Counter { mut hits: i32 }

impl Counter {
    fun bad(&self) {
        let target = &mut self.hits;  // E0309
        *target = 1;
    }
}
```

经裸指针写入不受此检查约束。见[引用、借用与逃逸](./references-and-escape.md)。
相关：[E0300](#e0300)、[E0303](#e0303)、[E0031](#e0031)

<a id="e0310"></a>
### E0310 无 GC 模式下引用逃出栈存储

`Clue.toml` 里设置 `[runtime] gc = false` 后，不会再靠 GC 堆延长局部值的存活时间；返回局部值或临时值的引用、按引用捕获并逃出当前栈帧都会被拒。默认配置下（GC 开启）同样的代码只做堆提升，不报错。

```text
// Clue.toml
[runtime]
gc = false
```

```text
// src/main.rid，用 clue check 复现
struct Data { value: i32 }

fun escaped() -> &Data {
    let value = Data { value: 42 };
    &value              // E0310
}

fun main() { escaped(); }
```

诊断文本是 reference to stack-owned value cannot escape when GC is disabled，help 提示返回或捕获拥有所有权的数据，note 说明从调用者传入的引用可以直接转发，因为那不会延长它指向值的存活期。`gc = false` 不能和 `runtime.source` 同时使用。见 [Clue 构建器](./clue.md)与[引用、借用与逃逸](./references-and-escape.md)。

## 过程宏与内部码

<a id="e0400"></a>
### E0400 过程宏展开错误

`riddlec` 的过程宏驱动发出的错误，不在用户源码的 span 上。最常见的触发是调用了找不到的宏。

```riddle
fun main() {
    unknown_macro!();  // E0400
}
```

内置函数式宏与派生宏清单见[编写过程宏](./proc-macros.md)与[形式化语法](./grammar.md)。

<a id="e0999"></a>
### E0999 MIR 降级的兜底码

类型检查通过、但 MIR 的 `as` 降级找不到对应 `CastOp` 时发出，原文是 `unsupported cast from X to Y`。正常用户代码见不到它：出现这个码说明类型检查器的转换矩阵与 MIR 不一致，是编译器的 bug。

```text
// 没有可复现的用户写法：这是内部兜底码
```

相关：[E0012](#e0012)

## 编辑器里的码

LSP 诊断直接沿用上面的 E 码，`source` 固定为 `riddle`，`code` 是字符串形式的码。语言服务器无法从编辑器的增量变更重建缓冲区时，会为该文档发一条码为 `LSP0001` 的错误，消息是 this file is out of sync with the editor, so it was not analysed; reopen it or undo recent edits to restore diagnostics。见[编辑器与 LSP](./editor-support.md)。
