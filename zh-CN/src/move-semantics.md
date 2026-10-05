# 移动语义

赋值、传参和模式绑定默认移动非 `Copy` 值。移动之后，原来的绑定不再有效：

```riddle
struct Point { x: i32, y: i32 }

fun main() {
    let point = Point { x: 1, y: 2 };
    let moved = point;
    println!("{}", moved.x);
    println!("{}", point.x); // E0100：point 已经被移动
}
```

`consume(point)` 这样的调用同样移动实参。移动语义让「谁负责这个值」始终唯一，析构也因此有确定的位置。

## Copy

这些类型按复制传递，不移动：

- 整数、浮点、`bool`、`char`、`()`、`!`；
- `&T`、`*const T`、`*mut T`；
- 具名函数项；
- 元素都是 `Copy` 的元组和数组。

`&mut T` **不是** `Copy`，第一次使用之后再使用会报 `E0100`。

结构体和枚举不会因为字段都是标量就自动 `Copy`，必须显式声明：

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

也可以手写 `impl std::marker::Copy for Point {}`。两种写法都要求所有字段都是 `Copy`，否则报 `E0041`；`Copy` 与 `Drop` 不能同时实现，报 `E0055`。标准库只为标量提供了 `Copy` 实现，元组、数组和引用靠编译器内建规则。

`Clone` 是另一个 trait，要显式实现或派生，`Copy` 不会自动带来 `Clone`。

## 借用代替移动

只想读值就借用，所有权留在原处：

```riddle
struct Point { x: i32, y: i32 }

fun distance_squared(point: &Point) -> i32 {
    point.x * point.x + point.y * point.y
}

fun main() {
    let point = Point { x: 3, y: 4 };
    println!("{}", distance_squared(&point));
    println!("{}", point.x);
}
```

## 解引用按值读取

`*reference` 读取引用指向的值：`T: Copy` 时得到副本，否则是一次移动，而引用并不拥有 `T`，所以报 `E0308`：

```riddle
fun main() {
    let pair = (1i32, 2i32);
    let reference = &pair;
    let copy = *reference;
    println!("{} {}", copy.0, copy.1);
}
```

## 模式绑定与部分移动

`match` 和 `for` 里的绑定会取得匹配值的所有权。绑定 `Copy` 字段只是复制，绑定非 `Copy` 字段才是移动：

```riddle
struct Holder { items: Vector<i32>, name: &str }

fun main() {
    let holder = Holder { items: Vector::new(), name: "h" };
    match holder {
        Holder { items } => println!("{}", items.len()),
    }
    println!("{}", holder.name); // 未绑定的字段仍然可用
}
```

`let` 解构的粒度和 `match` 一样：模式移动了哪些字段，原值就只在那些字段上失效，没被绑定的字段照常可用：

```riddle
struct Holder { items: Vector<i32>, name: &str }

fun main() {
    let holder = Holder { items: Vector::new(), name: "h" };
    let Holder { items } = holder;
    println!("{}", items.len());
    println!("{}", holder.name);      // ok：name 没被移动
    println!("{}", holder.items.len()); // E0100：items 已经移出去了
}
```

字段全是 `Copy` 类型时，解构只产生副本，原值照常可用。

块表达式的尾表达式也是移动：块的值要比块自己的局部活得久，所以 `{ holder }` 无论结果是被走值还是只被借用都移动了 `holder`，之后再读 `holder` 报 `E0100`。写块是为了临时构造一个值时（`println!("{}", { ...; buffer })`、`format!(…).as_str()`）不用操心这一点，值的所有权已经交给块的结果，析构只在结果上做一遍。

实现了 `Drop` 的类型不允许通过模式移出非 `Copy` 字段，报 `E0305`——用户析构函数必须总能看到完整的 `self`：

```riddle
struct Resource { name: std::string::String }

impl std::ops::Drop for Resource {
    fun drop(&mut self) {
        println!("dropping");
    }
}

fun main() {
    let resource = Resource { name: std::string::String::from_str("file") };
    let Resource { name } = resource; // E0305
    println!("{:?}", name);
}
```

## 析构顺序

- 同一个作用域里的局部变量按声明**逆序**析构；
- 聚合值内部按字段**声明顺序**析构；
- 类型自己实现了 `Drop` 时，先调用用户的 `drop(&mut self)`，再按声明顺序析构字段。

```riddle
struct First { n: i32 }
struct Second { n: i32 }

impl std::ops::Drop for First {
    fun drop(&mut self) { println!("first {}", self.n); }
}

impl std::ops::Drop for Second {
    fun drop(&mut self) { println!("second {}", self.n); }
}

struct Pair { first: First, second: Second }

fun main() {
    let pair = Pair { first: First { n: 1 }, second: Second { n: 2 } };
    let last = First { n: 3 };
    println!("end");
}
```

输出是 `end`、`first 3`（`last` 后声明，先析构）、`first 1`、`second 2`（`pair` 的字段按声明顺序）。

部分移动只清掉对应字段的析构标记，其余字段照常析构。

## 控制流与借用

借用在持有它的绑定最后一次使用之后结束，循环体里的冲突只报一次。具体规则、冲突错误码和逃逸行为见[引用、借用与逃逸](./references-and-escape.md)。
