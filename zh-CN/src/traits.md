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
    fun next() -> Option<Self::Item>;
}
```

在实现时，需要为关联类型指定具体类型：

```riddle
impl Iterator for Counter {
    type Item = i32;

    fun next() -> Option<i32> {
        // ...
    }
}
```

## 内置 Trait

Riddle 的 `std/lib.rid` 会自动拼到用户源码后面。标准库中用 Rust 风格属性 `#[lang = "..."]` 标记编译器需要识别的特殊 trait。

### Copy

`Copy` 是一个标记 trait——它不包含任何方法。当一个类型实现 `Copy` 时，编译器在赋值和传参时会自动进行按位复制，而非移动所有权：

```riddle
#[lang = "copy"]
trait Copy {
}
```

基础类型（`i32`、`bool`、`f64` 等）在 std 中实现了 `Copy`。你也可以为自己的类型实现它：

实现了 `Copy` 的类型在赋值后原变量仍然可用：

```riddle
struct Point {
    x: i32,
    y: i32,
}

// Point 的字段都是 i32（Copy），可以安全实现 Copy
impl Copy for Point { }

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

impl<T> Copy for Box<T> {}

fun main() {
    let a: Box<i32> = Box { value: 1 };
    let b = a;
    let c = a; // OK：Box<i32> 匹配 impl<T> Copy for Box<T>
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

这些 trait 目前主要作为标准库占位和类型信息；操作符分派仍由编译器内置逻辑处理。

## 小结

- `trait` 定义共享行为接口；
- `impl Trait for Type` 为类型实现 trait；
- 关联类型让 trait 的使用更灵活；
- `#[lang = "copy"]` 标记的 `Copy` 会影响 move checker；
- std 中已经放入一批 Rust 风格 lang trait，占位多于运行时能力。
