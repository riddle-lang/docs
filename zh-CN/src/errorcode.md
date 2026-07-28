# Riddle 错误码参考

## 类型检查 (E0001–E0013, E0031–E0046, E0054–E0060, E0072)

<a id="e0001"></a>
### E0001 — 类型不匹配
赋值、函数参数、返回值的类型与预期不符。
```riddle
let x: i32 = "hello";  // E0001: expected i32, got &str
```

<a id="e0002"></a>
### E0002 — 分支类型不兼容
`if` 各分支或 `match` 各 arm 的返回类型不一致。
```riddle
let x = if cond { 1 } else { "hello" };  // E0002: incompatible types: i32 and &str
```

<a id="e0003"></a>
### E0003 — 需要数值类型
算术/比较运算符的操作数必须是数值类型。
```riddle
let x = true + 1;  // E0003: left operand must be numeric, got bool
```

<a id="e0004"></a>
### E0004 — 不能调用非函数值
对非函数类型进行了函数调用。
```riddle
let x = 42;
x();  // E0004: cannot call value of type i32
```

<a id="e0005"></a>
### E0005 — 函数参数数量不匹配
调用函数时传入的参数数量与声明不符。
```riddle
add(1);  // E0005: function expects 2 arguments, got 1
```

<a id="e0006"></a>
### E0006 — 未知字段
访问或初始化结构体中不存在的字段。
```riddle
let p = Point { x: 1, z: 2 };  // E0006: unknown field `z` on struct `Point`
```

<a id="e0007"></a>
### E0007 — 缺少字段
结构体字面量缺少必填字段。
```riddle
let p = Point { x: 1 };  // E0007: missing field `y` in struct literal `Point`
```

<a id="e0008"></a>
### E0008 — 不能解引用
对非指针/非引用类型使用了 `*` 解引用运算符。
```riddle
let x = *42;  // E0008: cannot dereference value of type i32
```

<a id="e0009"></a>
### E0009 — 结构体字面量未解析
结构体字面量的路径无法解析到结构体定义。
```riddle
let x = UnknownType { a: 1 };  // E0009: struct literal does not resolve to a struct
```

<a id="e0010"></a>
### E0010 — 模式不匹配
`match` 或 `let` 的模式与值的类型不兼容。
```riddle
let (x, y) = 42;  // E0010: tuple pattern cannot match value of type i32
```

<a id="e0011"></a>
### E0011 — 未知字面量后缀
整数或浮点数字面量的类型后缀无效。
```riddle
let x = 42_i99;  // E0011: unknown integer literal suffix `i99`
```

<a id="e0012"></a>
### E0012 — 不支持的类型转换
`as` 只支持整数之间、整数与浮点数之间、浮点数之间、布尔值到整数、整数到布尔值、整数到原始指针，以及原始指针之间的转换。其他源类型与目标类型组合会报告此错误。

<a id="e0013"></a>
### E0013 — 未知方法
对某个接收者调用了不存在的固有方法。
```riddle
let p = Point { x: 1, y: 2 };
p.missing();  // E0013: unknown method `missing` on type Point
```

<a id="e0031"></a>
### E0031 — 给不可变绑定赋值
左侧绑定没有用 `mut` 声明，却被重新赋值。
```riddle
let x = 1;
x = 2;  // E0031: cannot assign to immutable binding
```

<a id="e0032"></a>
### E0032 — 类型参数数量不匹配
使用泛型结构体、枚举或 trait 时，传入的类型参数数量和定义不一致；有默认值的 trait 类型参数可以省略。
```riddle
struct Box<T> { value: T }
let b: Box<i32, bool>;  // E0032: expected 1 type argument, got 2

trait Convert<T> {}
struct Value {}
impl Convert for Value {}  // E0032: expected 1 type argument, got 0
```

<a id="e0033"></a>
### E0033 — 递归泛型调用
泛型函数递归调用时，类型参数必须一致；嵌套包装会导致无限实例化。
```riddle
fun wrap<T>(value: T) -> T {
    wrap(Box { value })  // E0033: recursive generic call with different type args
}
```

<a id="e0034"></a>
### E0034 — 无效类型标注
变量或参数的类型标注无法解析或格式不正确。
```riddle
let x: InvalidType = 1;  // E0034: invalid type annotation
```
数组类型使用 Rust 风格 `[T; N]`，元素类型在前、长度在后。写反时主错误只描述语法无效，修复方案会放在 `note:` 中：
```riddle
struct Foo {
    x: [3; i32]
}
```
```text
error[E0034]: invalid array type syntax
note: array types use `[T; N]`; write `[i32; 3]` instead
```

<a id="e0035"></a>
### E0035 — 泛型 bound 不满足
实例化泛型函数、结构体、枚举或 impl 时，实际类型没有实现要求的 trait。
```riddle
trait Marker {}
struct Box<T> where T: Marker { value: T }
struct Plain {}
let b = Box { value: Plain {} };  // E0035
```

<a id="e0036"></a>
### E0036 — 缺少必需 trait 实现
用户类型参与比较时需要实现对应的比较 trait；实现子 trait 时，也必须先实现它声明的所有父 trait。
```riddle
struct Point { x: i32 }
let same = Point { x: 1 } == Point { x: 2 };  // E0036
```

<a id="e0037"></a>
### E0037 — impl where 子句违反 Paterson condition
trait impl 的 `where` 约束不能和被实现类型一样大或更大，否则 trait 求解可能无限递归。
```riddle
trait Foo {}
struct Vec<T> { value: T }
impl<T> Foo for T where Vec<T>: Foo {}  // E0037
```

<a id="e0041"></a>
### E0041 — `Copy` 实现包含不可复制字段
为结构体或枚举实现 `Copy` 时，它的所有字段和 payload 都必须可复制。
```riddle
struct Token { value: i32 }
struct Wrapper { value: Token }
impl Copy for Wrapper {}  // E0041: `Token` is not Copy
```

<a id="e0042"></a>
### E0042 — 循环控制语句位于循环外
`break;` 和 `continue;` 只能出现在 `while` 或 `for` 循环体中。
```riddle
fun invalid() {
    break;  // E0042: `break` outside of a loop
}
```

<a id="e0043"></a>
### E0043 — 不定长 `str` 用在值位置
裸 `str` 没有独立布局，不能作为局部变量、参数、返回值、字段或其他值类型的组成部分。字符串值应使用 `&str`。
```riddle
let invalid: str = "hello";  // E0043
let valid: &str = "hello";   // OK
```

<a id="e0044"></a>
### E0044 — 无效的父 trait 声明
父 trait 必须能解析到已声明的 trait，并且 trait 继承关系不能形成环。
```riddle
trait Child: Missing {}  // E0044: unknown supertrait
trait First: Second {}   // E0044: cycle
trait Second: First {}
```

<a id="e0045"></a>
### E0045 — 无法推断匿名函数参数类型
参数类型无法从函数体、期望函数类型或调用点确定。
```riddle
let id = fun(x) { x };  // E0045
```
添加显式类型，例如 `fun(x: i32) { x }`。

<a id="e0046"></a>
### E0046 — 不安全操作需要 unsafe 上下文
解引用或索引原始指针、调用 `unsafe fun` 或不安全外部函数，都需要在 `unsafe {}` 块中进行。原始指针的有效性和生命周期仍由程序员保证，错误的指针操作可能触发未定义行为；固定数组和切片的安全索引则会执行边界检查。
```riddle
fun read(ptr: *const i32) -> i32 {
    let x = *ptr;  // E0046
    let y = ptr[0]; // E0046
    x + y
}

fun read_safe(ptr: *const i32) -> i32 {
    unsafe {
        let x = *ptr;   // OK: 在 unsafe 块中
        let y = ptr[0]; // OK
        x + y
    }
}

unsafe fun external_contract() {}

fun call_contract() {
    unsafe { external_contract(); }
}
```

<a id="e0054"></a>
### E0054 — 访问私有结构体字段
结构体字段默认私有，只能在声明结构体的模块及其子模块中构造、读取或通过模式解构。模块外访问字段时，需要在字段声明前添加 `pub`，或通过结构体提供的公开函数和方法操作。
```riddle
mod model {
    pub struct Point {
        value: i32,
    }
}

fun read(point: model::Point) -> i32 {
    point.value  // E0054: field `value` of struct `Point` is private
}
```

<a id="e0055"></a>
### E0055 — 同一类型同时实现 `Copy` 和 `Drop`
拥有析构逻辑的类型不能按位复制，否则多个副本会重复释放同一资源。移除其中一个 impl。

<a id="e0056"></a>
### E0056 — 直接调用 `Drop::drop`
析构方法只能由编译器调用。需要提前结束一个值时使用 prelude 中的 `drop(value)`，它会消费所有权并在被调用函数结束前完成析构。

<a id="e0057"></a>
### E0057 — `let` 中的可反驳模式
`let` 没有备选分支，模式必须匹配该类型的每一个值。枚举变体、字面量等只覆盖部分取值的模式需要改用 `match`。
```riddle
enum Opt { None, Some(i32) }

let Opt::Some(v) = o;  // E0057: `Opt::None` is not covered
```
元组和结构体模式是不可反驳的，可以直接解构：
```riddle
let (a, b) = pair;             // OK
let Point { x, y } = point;    // OK
```

<a id="e0058"></a>
### E0058 — 同一模式重复绑定名称
一个模式内的每个绑定名称必须唯一。不同 `let` 语句或不同 `match` arm 仍可正常遮蔽同名变量。
```riddle
let (value, value) = (1, 2);  // E0058
```

<a id="e0059"></a>
### E0059 — 使用未初始化的 `let` 绑定
`let` 可以省略初始化式并稍后赋值，但在每条到达使用点的路径上都必须先完成赋值。编译器会合并 `if`、`match` 和循环的控制流；可能仍未初始化的读取会报告此错误。
```riddle
fun main() -> i32 {
    let value: i32;
    value // E0059
}
```

<a id="e0060"></a>
### E0060 — 常量初始化式无效
常量必须使用可在编译期检查的纯表达式，并且不能形成常量初始化循环。字面量、已检查常量引用、纯运算、转换和聚合值可以使用；函数调用、闭包、控制流或不安全操作会报告此错误。
```riddle
const ANSWER: i32 = make_answer();  // E0060
```

<a id="e0072"></a>
### E0072 — 递归类型无限大小
结构体或枚举的字段中包含自身，导致类型大小无法在编译期确定。
```riddle
struct Node {
    next: Node,  // E0072: recursive type has infinite size
}
```
对应 `note:` 会提示使用 `&`、`*const` 或 `*mut` 间接引用打破循环。
```riddle
struct Node {
    next: &Node,  // OK：引用是定长的
}
```

---

## Trait / Impl 检查 (E0020–E0030, E0047–E0048)

<a id="e0020"></a>
### E0020 — trait 重复方法
同一个 trait 内定义了同名方法。
```riddle
trait Foo {
    fun bar();
    fun bar();  // E0020: duplicate method `bar`
}
```

<a id="e0022"></a>
### E0022 — trait 重复关联类型
同一个 trait 内定义了同名关联类型。
```riddle
trait Foo {
    type T;
    type T;  // E0022: duplicate associated type `T`
}
```

<a id="e0023"></a>
### E0023 — impl 引用未知 trait
`impl Trait for Type` 中引用的 trait 不存在。
```riddle
impl UnknownTrait for Point { }  // E0023: references unknown trait
```

<a id="e0024"></a>
### E0024 — impl 重复方法
同一个 impl 块内定义了同名方法。
```riddle
impl Point {
    fun bar() { }
    fun bar() { }  // E0024: duplicate method `bar`
}
```

<a id="e0025"></a>
### E0025 — impl 重复关联类型
同一个 impl 块内定义了同名关联类型。
```riddle
impl Point {
    type T = i32;
    type T = i64;  // E0025: duplicate associated type `T`
}
```

<a id="e0026"></a>
### E0026 — impl 缺少方法
impl 块未实现 trait 要求的所有方法。
```riddle
trait Foo { fun bar(); }
impl Foo for Point { }  // E0026: missing method `bar`
```

<a id="e0027"></a>
### E0027 — impl 缺少关联类型
impl 块未提供 trait 要求的所有关联类型。
```riddle
trait Foo { type T; }
impl Foo for Point { }  // E0027: missing associated type `T`
```

<a id="e0028"></a>
### E0028 — impl 方法参数数量不匹配
impl 中方法参数数量与 trait 声明不一致。
```riddle
trait Foo { fun bar(x: i32); }
impl Foo for Point {
    fun bar() { }  // E0028: parameter count mismatch
}
```

<a id="e0029"></a>
### E0029 — impl 方法参数类型不匹配
impl 中方法参数类型与 trait 声明不一致。
```riddle
trait Foo { fun bar(x: i32); }
impl Foo for Point {
    fun bar(x: &str) { }  // E0029: parameter type mismatch
}
```

<a id="e0030"></a>
### E0030 — impl 方法返回类型不匹配
impl 中方法返回类型与 trait 声明不一致。
```riddle
trait Foo { fun bar() -> i32; }
impl Foo for Point {
    fun bar() -> bool { true }  // E0030: return type mismatch
}
```

<a id="e0047"></a>
### E0047 — trait 实现重叠
同一个 trait 不能有两个对同一组类型参数都适用的实现。泛型实现与其覆盖的具体实现也会冲突。
```riddle
trait Foo {}
struct Point {}

impl Foo for Point {}
impl Foo for Point {}  // E0047: conflicting implementations
```

<a id="e0048"></a>
### E0048 — impl 违反孤儿规则
当前包只能实现自己定义的 trait，或为自己定义的名义类型实现外部 trait。实现外部 trait 时，`Self` 和 trait 类型参数中必须出现本地类型；在第一个本地类型之前不能出现未被类型构造器覆盖的泛型参数。引用会传递本地性，但不会覆盖其中的泛型参数。标注了 `#[fundamental]` 的类型是透明的：当其某个类型参数为本地类型时，整体也视为本地（与 `&T` 行为一致），因此可以为 `#[fundamental]` 外部类型包裹本地类型的形式实现外部 trait。
```riddle
use external::{Show, Point};
impl Show for Point {}  // E0048
```

<a id="e0049"></a>
### E0049 — 默认 std 模式下使用内部属性
默认加载标准库时，`#[lang = "..."]` 和 `#[fundamental]` 只允许出现在随编译器附加的标准库中，用户包使用这些属性会被拒绝。来源检查优先于属性格式和目标检查，因此用户包中的任何用法都统一报告 `E0049`。使用 `--no-std` 时不附加内置标准库，参与编译的包可以自行定义 lang item 和 `#[fundamental]` 类型。
```riddle
#[lang = "copy"]  // E0049: `#[lang = "copy"]` is reserved for the standard library
trait MyCopy {}
```
```riddle
#[fundamental]  // E0049: `#[fundamental]` is reserved for the standard library
struct MyBox<T> { value: T }
```

<a id="e0053"></a>
### E0053 — lang item 错误
自定义 core 中的 lang item 必须使用已知名称、标注在 trait 上并满足对应的固定签名。缺少字符串值、错误目标、错误签名、同一 lang item 被定义两次，或同一个 trait 标注多个 lang item，都会报告 `E0053`。`#[fundamental]` 只能以不带值的形式标注结构体或枚举，形式或目标错误时也报告 `E0053`。
```riddle
#[lang = "unknown"]  // E0053: unknown lang item
trait Foo {}
```
```riddle
#[lang = "copy"] trait A {}
#[lang = "copy"] trait B {}  // E0053: lang item `copy` defined more than once
```

---

## HIR 降级与名字解析 (E0040, E0050–E0052)

<a id="e0040"></a>
### E0040 — 语法降级错误
AST 到 HIR 降级过程中的语法/语义错误，如无效字面量、缺少表达式等。
```riddle
let x = 99999999999999999999;  // E0040: invalid integer literal
let y = ;                       // E0040: missing expression statement
```

<a id="e0050"></a>
### E0050 — 未解析名字
路径或名字无法解析到当前作用域中可见的定义。
```riddle
let x = missing_name;  // E0050: unresolved name
```

<a id="e0051"></a>
### E0051 — 空 use 声明
`use` 树没有暴露出任何可导入的名字。

<a id="e0052"></a>
### E0052 — glob 导入目标不存在
`use path::*;` 的目标模块无法解析。
```riddle
use missing::*;  // E0052: glob import target not found
```

---

## 移动、逃逸和借用检查 (E0100, E0200, E0300–E0308)

<a id="e0100"></a>
### E0100 — 使用了已移动的值
在所有权转移后再次使用该值。
```riddle
let x = Point { x: 1, y: 2 };
let y = x;    // x 的所有权转移到 y
let z = x;    // E0100: use of moved value: `x`
```

<a id="e0200"></a>
### E0200 — 逃逸分析提示（保留）
诊断打印器已经把 `E0200` 归类为 escape 阶段提示，但当前逃逸分析只把结果交给 MIR 降级决定 `Alloca` 或 `HeapAlloc`，不会主动向用户发出这个诊断码。

<a id="e0300"></a>
### E0300 — 可变借用与已有共享借用冲突
已有共享借用尚未结束时，不能再创建可变借用。
```riddle
let r = &p;
let m = &mut p;  // E0300
```

从容器取得的共享元素引用也会保持对容器的共享借用；引用仍活跃时调用需要 `&mut self` 的方法同样触发 E0300。

<a id="e0301"></a>
### E0301 — 共享借用与已有可变借用冲突
已有可变借用尚未结束时，不能再创建共享借用。
```riddle
let m = &mut p;
let r = &p;  // E0301
```

<a id="e0302"></a>
### E0302 — 重复可变借用
同一位置不能同时存在两个可变借用。
```riddle
let a = &mut p;
let b = &mut p;  // E0302
```

方法返回的可变引用会关联回 receiver。即使引用经过 `Option<&mut T>` 等容器传递，只要它后面仍会使用，再次调用 receiver 的可变方法仍会触发 E0302。

<a id="e0303"></a>
### E0303 — 借用期间赋值
某个位置仍被借用时，不能给它赋值。
```riddle
let r = &p;
p = other;  // E0303
```

<a id="e0304"></a>
### E0304 — 借用期间移动
某个位置仍被借用时，不能移动它。
```riddle
let r = &p;
let q = p;  // E0304
```

<a id="e0305"></a>
### E0305 — 从实现 `Drop` 的类型中移出字段
显式实现 `Drop` 的类型必须作为整体保持有效，不能单独移出字段。普通聚合类型仍可部分移动，编译器会用字段级 drop flag 避免重复析构。

<a id="e0306"></a>
### E0306 — `Drop` 所有者的引用逃出作用域
实现 `Drop` 的值会在所有者作用域结束时确定性析构，因此指向它的引用不能作为返回值活得更久。把所有权移出函数，或让引用只在所有者作用域内使用。

<a id="e0307"></a>
### E0307 — 在 match guard 中移动模式绑定
guard 失败时还要继续尝试后续 arm，因此 guard 只能查看或借用非 `Copy` 模式绑定，不能取得其所有权。把移动操作放到选中的 arm body 中。

<a id="e0308"></a>
### E0308 — 从显式安全引用解引用位置移出非 `Copy` 值
`*reference` 在按值上下文中会读取安全引用指向的 `T`。如果 `T` 没有实现 `Copy`，引用并不拥有这个值，不能直接把它搬出：
```riddle
struct Token {}

fun main() {
    let mut token = Token {};
    let reference = &mut token;
    let moved = *reference;  // E0308
}
```
保留引用并通过它访问，或只在确实允许按位复制时为类型实现 `Copy`。`*reference = value` 是写回原位置，不属于此错误。

---

## 泛型、类型与模式 (E0033, E0035, E0037–E0039, E0072)

### E0033 — 递归泛型调用
泛型函数递归调用自身时，如果实际类型参数与定义不同（例如被包装进另一个泛型），会导致编译器无限单态化。

### E0035 — 泛型 bound 不满足
泛型函数、结构体、枚举或 impl 的 bound 会在实例化时检查；不满足时会报错。

### E0037 — impl where 子句违反 Paterson condition
`impl` 的 `where` 约束必须严格小于被实现类型，例如 `impl<T> Trait for T where Vec<T>: Trait {}` 会被拒绝。

<a id="e0038"></a>
### E0038 — 无效的枚举变体模式
枚举变体的所属枚举、形状或字段与被匹配的类型不一致。

```riddle
enum Left { Same }
enum Right { Same }

fun value(input: Left) -> i32 {
    match input {
        Right::Same => 1,  // E0038
        Left::Same => 0,
    }
}
```

<a id="e0039"></a>
### E0039 — match 不穷尽
至少有一个可能的值没有被任何无 guard 的 arm 覆盖。诊断会给出一个缺失模式；整数模式还会在注记中列出未覆盖的连续区间。

```riddle
enum State { Ready, Done(i32) }

fun value(state: State) -> i32 {
    match state {
        State::Ready => 0,
        State::Done(1) => 1,
        // E0039: missing pattern `State::Done(_)`
    }
}
```

添加缺失分支，或使用 `_` / 标识符绑定覆盖剩余值。带 guard 的 arm 可能在运行时失败，因此不计入穷尽性。

### E0072 — 递归类型具有无限大小
结构体或枚举直接或间接包含自身，没有任何间接层（引用、指针等），导致编译期无法计算类型大小。插入 `&`、`*const` 或 `*mut` 打破循环即可修复。
