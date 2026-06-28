# Trait

Trait 是 Riddle 中定义共享行为的机制。它类似于其他语言中的接口（interface），用于声明一组方法和关联类型，供具体类型来实现。

## 定义 Trait

使用 `trait` 关键字定义一个 trait：

```riddle
trait Summary {
    fun summarize() -> str;
}
```

`Summary` trait 声明了一个方法 `summarize`，它不接受参数并返回一个 `str`。trait 方法只有签名，没有函数体——实现由具体类型在 `impl` 块中提供。

## 为类型实现 Trait

在 `impl` 块中为某个具体类型实现 trait：

```riddle
struct Article {
    title: str,
    body: str,
}

impl Summary for Article {
    fun summarize() -> str {
        return self.title;
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

Riddle 提供一些编译器可识别的特殊 trait。

### Copy

`Copy` 是一个标记 trait——它不包含任何方法。当一个类型实现 `Copy` 时，编译器在赋值和传参时会自动进行按位复制，而非移动所有权：

```riddle
pub trait Copy {
}
```

基础类型（`i32`、`bool`、`f64` 等）默认实现了 `Copy`。你也可以为自己的类型实现它，前提是该类型的所有字段也都实现了 `Copy`。

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

## 小结

- `trait` 定义共享行为接口；
- `impl Trait for Type` 为类型实现 trait；
- 关联类型让 trait 的使用更灵活；
- `Copy` 是内置标记 trait，实现它的类型使用复制语义而非移动语义。
