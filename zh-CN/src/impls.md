# impl 块

`impl` 用来给类型添加固有函数，或者为类型实现 trait。当前 Riddle 的写法接近 Rust：`impl Type` 写固有实现，`impl Trait for Type` 写 trait 实现。

## 固有 impl

固有 impl 直接写目标类型：

```riddle
struct Point {
    x: i32,
    y: i32,
}

impl Point {
    fun new(x: i32, y: i32) -> Point {
        Point { x, y }
    }

    fun x(&self) -> i32 {
        self.x
    }
}
```

关联函数通过路径调用：

```riddle
let p = Point::new(1, 2);
```

带接收者的方法通过点号调用：

```riddle
let x = p.x();
```

## self 接收者

方法可以使用 `self`、`&self` 或 `&mut self` 作为第一个参数：

```riddle
impl Point {
    fun take(self) -> i32 {
        self.x
    }

    fun inspect(&self) -> i32 {
        self.x
    }

    fun shift(&mut self, dx: i32) {
        self.x += dx;
    }
}
```

`&self` 适合只读访问，`&mut self` 适合修改接收者，`self` 会移动接收者。

## 泛型 impl

泛型类型可以写泛型 impl：

```riddle
struct Box<T> {
    value: T,
}

impl<T> Box<T> {
    fun get(&self) -> T {
        self.value
    }
}

fun main() -> i32 {
    let b: Box<i32> = Box { value: 1 };
    b.get()
}
```

当前 C backend 会为用到的泛型方法生成单态化函数。

泛型 impl 也可以带 const 参数：

```riddle
struct ArrayIter<T, const N: usize> {
    values: [T; N],
    index: usize,
}

impl<T, const N: usize> ArrayIter<T, N> {
    fun len(&self) -> usize {
        N
    }
}
```

## Trait impl

为类型实现 trait 使用 `impl Trait for Type`：

```riddle
trait Show {
    fun show(value: i32) -> &str;
    type Output;
}

struct Widget {}

impl Show for Widget {
    fun show(value: i32) -> &str {
        "ok"
    }

    type Output = i32;
}
```

编译器会检查 trait 要求的方法和关联类型是否完整、签名是否匹配。

trait impl 可以使用 `where` 子句约束泛型参数：

```riddle
trait Marker {}
trait Wrap {}

struct Box<T> {
    value: T,
}

impl<T> Wrap for Box<T>
where T: Marker
{}
```

为了避免 trait 求解无限递归，`impl` 的 `where` 约束必须满足 Paterson condition：约束里的类型要严格小于被实现的类型。例如 `impl<T> Foo for T where Vec<T>: Foo {}` 会被拒绝。

## 常量和类型别名

`impl` 块中还可以定义关联常量和关联类型别名：

```riddle
impl Point {
    const ORIGIN: Point = Point { x: 0, y: 0 };
    type Pair = (i32, i32);
}
```

## 小结

- `impl Type` 定义固有函数和方法；
- `Type::function(...)` 调用关联函数；
- `value.method(...)` 调用带接收者的方法；
- `impl<T> Type<T>` 支持泛型 impl；
- `impl<T, const N: usize>` 支持 const 泛型 impl；
- `impl Trait for Type` 为类型实现 trait；
- trait impl 会检查方法签名和关联类型；
- `where` 子句可以约束泛型 impl，并会检查 Paterson condition；
- `impl` 块内也可以定义关联常量（`const`）和关联类型别名（`type`）。
