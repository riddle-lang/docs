# Riddle 错误码参考

## 类型检查 (E0001–E0013, E0031–E0046, E0072)

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
使用泛型结构体或枚举时，传入的类型参数数量和定义不一致。
```riddle
struct Box<T> { value: T }
let b: Box<i32, bool>;  // E0032: expected 1 type argument, got 2
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
### E0036 — 比较缺少 trait
用户类型使用 `==` / `!=` 时需要 `PartialEq`，使用有序比较时需要 `PartialOrd`。
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
### E0044 — 匿名函数捕获暂不支持的模式绑定
普通局部变量、函数参数和外层匿名函数参数可以被捕获。当前 `match`、`for` 等模式产生的临时绑定还不能跨入匿名函数。
```riddle
match 1 {
    base => {
        let read = fun() { base };  // E0044
    }
}
```
先把模式绑定复制或移动到普通 `let` 绑定，再创建匿名函数。

<a id="e0045"></a>
### E0045 — 无法推断匿名函数参数类型
参数类型无法从函数体、期望函数类型或调用点确定。
```riddle
let id = fun(x) { x };  // E0045
```
添加显式类型，例如 `fun(x: i32) { x }`。

<a id="e0046"></a>
### E0046 — 不安全操作需要 unsafe 上下文
解引用或索引原始指针、调用 `unsafe fun` 或不安全外部函数，都需要在 `unsafe {}` 块中进行。这些操作可能触发未定义行为，必须由程序员显式保证安全性。
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

## Trait / Impl 检查 (E0020–E0030)

<a id="e0020"></a>
### E0020 — trait 重复方法
同一个 trait 内定义了同名方法。
```riddle
trait Foo {
    fun bar();
    fun bar();  // E0020: duplicate method `bar`
}
```

<a id="e0021"></a>
### E0021 — trait 方法有函数体（语义防线）
trait 声明中的方法不能有实现体。当前语法分析器会先要求方法签名以 `;` 结束，因此下面的源码会在解析阶段报错，不会进入产生 E0021 的语义检查分支。
```riddle
trait Foo {
    fun bar() { }
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

## 移动、逃逸和借用检查 (E0100, E0200, E0300–E0304)

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
