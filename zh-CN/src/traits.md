# Trait

Trait 是 Riddle 中定义共享行为的机制。它类似于其他语言中的接口（interface），用于声明一组方法和关联类型，供具体类型来实现。

## 定义 Trait

使用 `trait` 关键字定义一个 trait：

```riddle
trait Summary {
    fun summarize() -> &str;
}
```

`Summary` trait 声明了一个必需方法 `summarize`，它不接受参数并返回一个 `&str`。没有函数体的方法必须由具体类型在 `impl` 块中提供。

Trait 方法也可以提供默认实现。impl 未覆写时使用默认体，显式覆写优先；默认体可以调用同一 trait 的其他方法：

```riddle
trait Summary {
    fun title(&self) -> &str;

    fun summarize(&self) -> &str {
        self.title()
    }
}
```

Trait 可以声明一个或多个父 trait：

```riddle
trait Named {
    fun name(&self) -> i32;
}

trait Tagged: Named {
    fun tag(&self) -> i32;
}
```

`T: Tagged` 会同时满足 `T: Named`，因此泛型代码可以调用 `name`。为类型实现 `Tagged` 前，必须显式实现 `Named`；多级父 trait 会传递生效。未知父 trait 和继承环会在类型检查时报错，多个父 trait 使用 `+` 分隔。

## 为类型实现 Trait

在 `impl` 块中为某个具体类型实现 trait：

```riddle
struct Article {
    title: &str,
    body: &str,
}

impl Summary for Article {
    fun summarize() -> &str {
        "article"
    }
}
```

## 借用 Trait Object

对象安全的 trait 可以通过借用 trait object 传递运行时类型：

```riddle
trait Speak {
    fun speak(&self) -> i32;
}

struct Speaker { value: i32 }

impl Speak for Speaker {
    fun speak(&self) -> i32 { self.value }
}

fun call(value: &dyn Speak) -> i32 {
    value.speak()
}
```

`&dyn Trait` 和 `&mut dyn Trait` 在 MIR 中包含数据指针和方法表，调用通过方法表间接分派。当前动态对象要求方法非泛型并使用引用接收者；不支持拥有所有权的 `dyn Trait` 值，也不支持动态调用带泛型方法的 trait。

## 关联类型

Trait 可以包含关联类型，让实现者指定 trait 方法中用到的具体类型：

```riddle
trait Iterator {
    type Item;
    fun next(&mut self) -> Option<Self::Item>;
}

trait IntoIterator {
    type Item;
    type IntoIter;
    fun into_iter(self) -> Self::IntoIter;
}
```

在实现时，需要为关联类型指定具体类型：

```riddle
impl Iterator for Counter {
    type Item = i32;

    fun next(&mut self) -> Option<Self::Item> {
        // ...
    }
}
```

`Iterator` 和 `IntoIterator` 是 `for item in value` 使用的协议。标准库把 `Option<T>` 放在 `std::option`、把 `Result<T, E>` 放在 `std::result`、把 `Range` 和 `range(start, end)` 放在 `std::ops`。与 Rust 一样，prelude 会重导出 `Some`、`None`、`Ok`、`Err`、`Copy`、`Clone` 和比较 trait，但不会自动导入 `Range` 或 `range`。固定长度数组 `[T; N]` 也已经有 `IntoIterator` 实现，数组迭代器定义为 `std::array::IntoIter<T>`，因此 `[1, 2, 3]` 会匹配 `impl<T, const N: usize> IntoIterator for [T; N]`，按值产出元素且不要求元素类型是 `Copy`。在 `for` 中使用这些类型的完整示例见[闭包与迭代器](./functional.md#内置可迭代值)。

## 泛型约束

泛型函数和 impl 可以通过 bound 要求类型实现某个 trait：

```riddle
fun read<T: Named>(value: T) -> i32 {
    value.name()
}

fun combine<T: Named + Tagged>(value: T) -> i32 {
    value.name() + value.tag()
}
```

bound 可以约束关联类型：

```riddle
fun add_box<T: std::ops::Add<Output = T>>(left: T, right: T) -> T {
    left + right
}
```

也可以使用 `where` 子句：

```riddle
impl<T> Wrap for Box<T>
where T: Marker
{}
```

`impl` 上的 `where` 约束会检查 Paterson condition：约束必须严格小于被实现的类型，避免递归 trait 求解无限增长。

Trait impl 还遵循孤儿规则：当前包可以自由实现自己定义的 trait；实现依赖包或标准库的 trait 时，`Self` 或 trait 类型参数中必须有当前包定义的结构体或枚举，并且第一个本地类型之前不能出现未被类型构造器覆盖的泛型参数。引用会传递本地性但不会覆盖其中的泛型参数，类型别名则按其底层类型判断。违反规则会报告 `E0048`。

`#[fundamental]` 是编译器内部属性。默认加载标准库时，只有随编译器附加的标准库可以使用它，用户包中使用会报告 `E0049`。使用 `--no-std` 时不附加内置标准库，所有参与本次编译的包都可以定义 `#[fundamental]` 类型，以支持自定义 core 和基础类型体系。

该属性会让被标注的结构体或枚举在孤儿规则判定中变得透明——只要它的某个类型参数是本地类型，整体就视为本地，等价于内置的 `&T`。标准库或自定义 core 的智能指针类型可借此让 `impl ForeignTrait for FundBox<LocalType>` 这样的写法合法：

```riddle
// 默认 std 模式下该定义属于标准库；--no-std 模式下也可由自定义 core 定义
#[fundamental]
struct FundBox<T> { value: T }

// FundBox 透明，FundBox<Local> 视为本地类型
impl ForeignTrait for FundBox<Local> {}
```

标准库比较 trait 也使用同一套父 trait 关系：`Eq: PartialEq`、`PartialOrd: PartialEq`、`Ord: Eq + PartialOrd`。

## 内置 Trait

Riddle 的 `std/lib.rid` 会自动拼到用户源码后面。标准库中用 Rust 风格属性 `#[lang = "..."]` 标记编译器需要识别的特殊 trait。

### Copy

`Copy` 是一个标记 trait——它不包含任何方法。当一个类型实现 `Copy` 时，编译器在赋值和传参时会自动进行按位复制，而非移动所有权：

```riddle
#[lang = "copy"]
trait Copy {
}
```

基础类型（`i32`、`bool`、`f64` 等）在 std 中实现了 `std::marker::Copy`。用户类型通常直接使用标准派生：

实现了 `Copy` 的类型在赋值后原变量仍然可用：

```riddle
#[derive(Clone, Copy)]
struct Point {
    x: i32,
    y: i32,
}

fun main() {
    let p = Point { x: 1, y: 2 };
    let q = p;    // 复制而非移动
    print!("{}", p.x);   // OK：p 仍然可用
}
```

泛型 impl 也可以作为 Copy 匹配模式：

```riddle
struct Box<T> {
    value: T,
}

impl<T: Copy> Copy for Box<T> {}

fun main() {
    let a: Box<i32> = Box { value: 1 };
    let b = a;
    let c = a; // OK：i32: Copy，因此 Box<i32>: Copy
}
```

只有被 `#[lang = "copy"]` 标记的 trait 会触发 move checker 的复制语义；普通同名或未标记 trait 不会自动生效。

与 Rust 一样，标准库的 `Option<T>` 和 `Result<T, E>` 使用带 bound 的条件 `Copy` 实现。编译器会检查用户 `Copy` impl 的每个结构体字段和枚举 payload；泛型字段必须能由 impl bound 证明为 `Copy`，否则报告 `E0041`。`&mut T` 也不会被视为内建 `Copy` 类型。

### 其他 std lang trait

当前 std 定义并实现了这些 lang trait：

- `Clone`，提供可调用的 `clone`；
- `PartialEq`、`Eq`、`PartialOrd`、`Ord`；
- `Add`、`Sub`、`Mul`、`Div`、`Rem`、`Neg`、`Not`、位运算、移位和复合赋值 trait，均提供对应必需方法。

运算 trait 的 lang 标记同时是 std 和编译器之间的内建契约。例如，`std/std/ops.rid` 中包含：

```riddle
#[lang = "add"]
trait Add<Rhs = Self> {
    type Output;
    fun add(self, rhs: Rhs) -> Self::Output;
}
```

普通代码直接调用 std 提供的标量 impl：

```riddle
fun main() -> i32 {
    let left: i32 = 1;
    left.add(2)
}
```

对于 `i32` 等标量，`left.add(2)` 会直接降为 MIR `Add`，C backend 输出等价的 `left + 2`，不会生成或调用 `add__i32` 包装函数。一元运算、位运算、移位和 `add_assign` 等复合赋值方法遵循相同规则。只有带受支持 `#[lang = "..."]` 标记的 trait 的标量 impl 会开洞；未标记的同名 trait 和结构体等用户类型 impl 仍保留普通方法调用。

二元、复合赋值、`PartialEq` 和 `PartialOrd` trait 都接受默认值为 `Self` 的 `Rhs` 参数，因此可以为不同的右操作数类型分别实现 trait。泛型函数中的 `T: Add<Rhs, Output = O>` 运算会保留为 trait 调用，并在单态化后选择具体 impl。普通赋值和内建复合赋值先计算右侧，再计算左侧位置；重载复合赋值按方法调用顺序先计算左侧接收者，再计算右侧。

`PartialEq::eq`、`PartialOrd::partial_cmp` 和 `Ord::cmp` 可以作为普通方法调用；整数、字符和布尔值返回 `Ordering`，浮点比较遇到 NaN 时返回 `None`。当前编译器会为用户类型把算术、取余、位运算、移位、一元负号、逻辑非、复合赋值和比较运算分派到对应的 `#[lang = "..."]` trait 方法，并用 `Output` 关联类型决定非赋值算术运算的结果类型。`==` 调用 `PartialEq::eq`，`!=` 调用默认的 `PartialEq::ne`；`<`、`<=`、`>`、`>=` 分别调用 `PartialOrd::lt`、`le`、`gt`、`ge`，这些默认方法通过 `partial_cmp` 判断，遇到 `None` 时均返回 `false`。

标准库还提供普通 trait `Default`、`Hash`、`Display` 和 `Debug`。`Default::default()` 会根据期望类型静态选择 impl；`Hash` 用于哈希集合；`Display` / `Debug` 通过 `Formatter` 支持 `print!`、`println!` 与 `#[derive(Debug)]`。编译器内置 `Debug`、`Clone`、`Copy`、`Default`、`Hash`、`PartialEq`、`Eq`、`PartialOrd` 和 `Ord` 派生；完整规则见[常用标准库](./standard-library.md#标准派生)。

`Rem` 和 `RemAssign` 已为整数及 `f32` / `f64` 实现。C backend 对浮点余数生成 `fmod` 调用。
