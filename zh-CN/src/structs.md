# 结构体

结构体把一组命名字段组合成一个类型。字段列表不能省——没有元组结构体，也没有 unit 结构体：

```riddle
struct Point {
    x: i32,
    y: i32,
}
```

`struct Empty {}` 合法；`struct S(i32);` 和 `struct S;` 是语法错误。

## 构造与字段

字段简写和普通写法可以混用，没有 Rust 的函数式更新语法（`..other`）：

```riddle
fun main() {
    let x = 3;
    let point = Point { x, y: 4 };
    println!("{} {}", point.x, point.y);
}
```

写字段需要可变绑定或 `&mut`；共享引用下写普通字段报 `E0309`：

```riddle
fun main() {
    let mut point = Point { x: 1, y: 2 };
    point.x = 5;
    println!("{}", point.x);
}
```

字段默认私有，加 `pub` 才能被其它模块访问，规则见[模块、use 与包](./modules.md)。

## 泛型结构体

类型参数可以带 bound、`where` 和默认值。默认类型实参只允许出现在 struct、enum、trait 的声明里：

```riddle
struct Holder<T = i32> {
    value: T,
}

fun main() {
    let plain = Holder { value: 1 };
    let named: Holder<bool> = Holder { value: true };
    println!("{} {}", plain.value, named.value);
}
```

## 关联函数与方法

`impl` 块里带接收者的函数是方法，用 `.方法(...)` 调用；不带接收者的用 `类型::函数(...)` 调用。

固有 `impl` 里 `Self` 指回正在实现的那个类型，返回类型、参数、类型实参位置都能用：`fun zero() -> Self`、`fun combine(self, other: Self)`、`Vector<Self>`。只有构造写法不行，`Self { a: 0 }` 报 `E0050`，要写具体结构体名。trait 定义和 trait 实现里的 `-> Self` 一直正常，标准库的 `Clone` 就是 `fun clone(&self) -> Self;`。

```riddle
struct Point { x: i32, y: i32 }

impl Point {
    fun origin() -> Point {
        Point { x: 0, y: 0 }
    }

    fun length_squared(&self) -> i32 {
        self.x * self.x + self.y * self.y
    }
}

fun main() {
    let point = Point::origin();
    println!("{}", point.length_squared());
}
```

接收者可以写 `&self`、`&mut self` 或不带参数的 `self`。`Self` 之外的类型名解析规则、常量与类型别名见 [impl 块](./impls.md)。

## 递归类型

字段不能内联包含自己，否则报 `E0072`。用引用、原始指针、`dyn Trait` 或长度为 0 的数组打断环：

```riddle
struct Node {
    value: i32,
    next: Option<&Node>,
}

fun main() {
    let tail = Node { value: 2, next: None };
    let head = Node { value: 1, next: Some(&tail) };
    match head.next {
        Some(node) => println!("{}", node.value),
        None => println!("none"),
    }
}
```

`[T; N]`（N 不为 0）和 `[T]` 不打断环；`Vector<T>` 可以，因为它的内部存的是裸指针：

```riddle
struct Tree {
    value: i32,
    children: Vector<Tree>,
}

fun main() {
    let mut root = Tree { value: 1, children: Vector::new() };
    root.children.push(Tree { value: 2, children: Vector::new() });
    println!("{}", root.children.len());
}
```

## mut 字段

字段可以声明为 `mut`，表示它在共享引用下仍然可写，这是 Riddle 提供的内部可变性机制：

```riddle
struct Counter {
    mut hits: i32,
    name: &str,
}

impl Counter {
    fun bump(&self) {
        self.hits += 1;
    }
}

fun main() {
    let counter = Counter { hits: 0, name: "clicks" };
    counter.bump();
    counter.bump();
    println!("{} {}", counter.name, counter.hits);
}
```

修饰符顺序是 `pub` 在前、`mut` 在后（`pub mut hits: i32`）。`mut` 只作用于字段本身：字段类型写成 `&mut i32` 不会让字段变可变。枚举变体的字段不能声明 `mut`，报了 `E0014`。

完整规则（哪些场景能拿到 `&mut`、调用摘要怎么算）见[引用、借用与逃逸](./references-and-escape.md#通过共享引用写入)。

## 移动与 Copy

结构体默认按移动传递，除非实现了 `Copy`：

```riddle
#[derive(Copy, Clone)]
struct Point { x: i32, y: i32 }

fun main() {
    let point = Point { x: 1, y: 2 };
    let first = point;
    let second = point;
    println!("{}", first.x + second.x);
}
```

实现 `Copy` 要求所有字段都是 `Copy`（否则 `E0041`），并且不能同时实现 `Drop`（`E0055`）。见[移动语义](./move-semantics.md)。
