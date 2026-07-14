# Trait

Trait 是 Riddle 中定义共享行为的机制。它类似于其他语言中的接口（interface），用于声明一组方法和关联类型，供具体类型来实现。

## 定义 Trait

使用 `trait` 关键字定义一个 trait：

```riddle
trait Summary {
    fun summarize() -> &str;
}
```

`Summary` trait 声明了一个方法 `summarize`，它不接受参数并返回一个 `&str`。trait 方法只有签名，没有函数体——实现由具体类型在 `impl` 块中提供。

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

`Iterator` 和 `IntoIterator` 是 `for item in value` 使用的协议。标准库把 `Option<T>` 放在 `std::option`、把 `Result<T, E>` 放在 `std::result`、把 `Range` 和 `range(start, end)` 放在 `std::ops`，这些常用项也会在根部重导出。与 Rust 一样，prelude 还会重导出 `Some`、`None`、`Ok`、`Err`、`Copy`、`Clone` 和比较 trait。固定长度数组 `[T; N]` 也已经有 `IntoIterator` 实现：

```riddle
fun main() {
    for n in range(0, 3) {
        // n: i32
    }

    for value in [1, 2, 3] {
        // value: i32
    }
}
```

数组迭代器定义在 `std::array` 中，根部兼容重导出为 `ArrayIter<T, const N: usize>`。因此 `[1, 2, 3]` 会匹配 `impl<T, const N: usize> IntoIterator for [T; N]`。数组按值产出元素，当前实现不要求元素类型是 `Copy`。

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

## 内置 Trait

Riddle 的 `std/lib.rid` 会自动拼到用户源码后面。标准库中用 Rust 风格属性 `#[lang = "..."]` 标记编译器需要识别的特殊 trait。

### Copy

`Copy` 是一个标记 trait——它不包含任何方法。当一个类型实现 `Copy` 时，编译器在赋值和传参时会自动进行按位复制，而非移动所有权：

```riddle
#[lang = "copy"]
trait Copy {
}
```

基础类型（`i32`、`bool`、`f64` 等）在 std 中实现了 `std::marker::Copy`。你也可以为自己的类型实现它：

实现了 `Copy` 的类型在赋值后原变量仍然可用：

```riddle
struct Point {
    x: i32,
    y: i32,
}

// Point 的字段都是 i32（Copy），可以安全实现 Copy
impl std::marker::Copy for Point { }

fun main() {
    let p = Point { x: 1, y: 2 };
    let q = p;    // 复制而非移动
    print(p.x);   // OK：p 仍然可用
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

`PartialEq::eq`、`PartialOrd::partial_cmp` 和 `Ord::cmp` 可以作为普通方法调用；整数、字符和布尔值返回 `Ordering`，浮点比较遇到 NaN 时返回 `None`。当前编译器会使用 `#[lang = "add"]` 的 `Add` 为非数值类型分派 `+`，并用 `Output` 关联类型决定结果类型。`PartialEq` 会参与 `==` / `!=` 检查，`PartialOrd` 会参与 `<`、`>`、`<=`、`>=` 检查。其他用户类型运算符重载尚未接入对应 trait，但 trait 方法本身可以直接调用。

Riddle 尚不支持 trait 默认方法，所以 `Iterator` 目前只有 `next` 核心协议，没有 Rust 的 `map`、`filter` 等默认适配器。`Default` 的关联 trait 函数调用、格式化器和哈希器协议也尚未实现；std 不再为这些能力暴露空壳 trait。浮点余数同样暂未支持，`Rem` 和 `RemAssign` 只为整数实现。
