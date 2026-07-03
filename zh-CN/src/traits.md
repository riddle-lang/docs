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

`Iterator` 和 `IntoIterator` 是 `for item in value` 使用的协议。标准库已经提供 `Option<T>`、`Range`、`range(start, end)`，以及固定长度数组 `[T; N]` 的 `IntoIterator` 实现：

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

数组迭代器在 std 中写作 `ArrayIter<T, const N: usize>`，因此 `[1, 2, 3]` 会匹配 `impl<T, const N: usize> IntoIterator for [T; N]`。数组按值产出元素，当前实现不要求元素类型是 `Copy`。

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

impl<T> std::marker::Copy for Box<T> {}

fun main() {
    let a: Box<i32> = Box { value: 1 };
    let b = a;
    let c = a; // OK：Box<i32> 匹配 impl<T> std::marker::Copy for Box<T>
}
```

只有被 `#[lang = "copy"]` 标记的 trait 会触发 move checker 的复制语义；普通同名或未标记 trait 不会自动生效。

### 其他 std lang trait

当前 std 还定义了这些 lang trait：

- `Clone`、`Default`；
- `PartialEq`、`Eq`、`PartialOrd`、`Ord`；
- `Debug`、`Display` 以及数字格式化 trait；
- `Hash`；
- `Add`、`Sub`、`Mul`、`Div`、`Rem`、`Neg`、`Not`、位运算、移位和复合赋值 trait。

当前编译器会使用 `#[lang = "add"]` 的 `Add` 为非数值类型分派 `+`，并用 `Output` 关联类型决定结果类型。`PartialEq` 会参与 `==` / `!=` 检查，`PartialOrd` 会参与 `<`、`>`、`<=`、`>=` 检查。其余操作符 trait 已在 std 中定义，主要还是标准库占位和类型信息。

## 小结

- `trait` 定义共享行为接口；
- `impl Trait for Type` 为类型实现 trait；
- 关联类型让 trait 的使用更灵活；
- `Iterator` / `IntoIterator` 是 `for item in value` 的类型检查协议；
- bound 和 `where` 子句可以约束泛型函数、结构体、枚举和 impl；
- `#[lang = "copy"]` 标记的 `Copy` 会影响 move checker；
- `Add`、`PartialEq`、`PartialOrd` 已经参与部分操作符检查；其他 std lang trait 占位多于运行时能力。
