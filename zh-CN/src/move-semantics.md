# 移动语义

Riddle 中，值默认通过移动传递。
移动意味着一个值从一个绑定转移到另一个绑定后，原来的绑定不再拥有这个值。

## 赋值会移动

看一个结构体例子：

```riddle
struct Foo {
    x: i32,
    y: i32,
}

fun main() {
    let a = Foo { x: 1, y: 1 };
    let b = a;
    print(&a); // error: a 已经被移动
    print(&b);
}
```

`let b = a;` 之后，`Foo` 的值移动到了 `b`。`a` 不再可用。

## 传参会移动

把值传给函数也会移动：

```riddle
fun consume(foo: Foo) {
    print(&foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    consume(foo);
    print(&foo); // error: foo 已经被移动
}
```

这种规则能避免“一个值到底由谁负责”的问题。

## 为什么只有移动

很多语言同时存在复制、共享引用、隐式别名和可变状态。
这些能力都很方便，但组合在一起时，程序行为会变得难以推理。

Riddle 选择让值默认移动，是为了让资源流向更明显：

- 看到赋值，就知道所有权发生转移；
- 看到函数调用，就知道参数被交给函数；
- 需要共享时，显式使用引用；
- 引用逃逸时，由语言自动提升到 GC。

## 需要继续使用值时怎么办

如果只是临时查看一个值，可以借用它：

```riddle
fun inspect(foo: &Foo) {
    print(&foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    inspect(&foo);
    print(&foo); // 可以继续使用
}
```

引用没有逃逸时，`foo` 仍然保留在当前作用域中。

## Copy 类型

有些类型不会在赋值和传参时移动，而是复制。标量、共享引用、原始指针和命名函数项属于内置 Copy 候选。闭包值拥有环境和析构函数，因此按值传递时会移动。

用户类型可以通过实现 std 中的 lang `Copy` 进入复制语义：

```riddle
struct Point {
    x: i32,
    y: i32,
}

impl std::marker::Copy for Point {}

fun main() {
    let p = Point { x: 1, y: 2 };
    let q = p;
    let r = p; // OK：Point 实现了 Copy
}
```

`std/lib.rid` 已经提供 `std::marker::Copy`，普通程序不需要自己声明这个 trait。只有带 `#[lang = "copy"]` 的 Copy trait 会被 move checker 识别。

解引用不会改变按值使用的规则。`let value = *reference` 会读取 `reference` 指向的 `T`：`T: Copy` 时得到副本；否则因为引用不拥有 `T`，从解引用位置搬出值会报 `E0308`。如果要修改原值，应保留 `&mut T`，例如 `let mut point = f(&mut p); point.x = 1;`；`let value = *point` 则不是引用别名。

## 引用模式与自动借用

显式 `&pattern` / `&mut pattern` 与显式解引用相同：它们读取引用指向的值，内部按值绑定只允许取得 `Copy` 内容。模式不会移动引用本身，临时借用会在没有绑定继续持有它时结束：

```riddle
fun example() -> i32 {
    let mut original = 3;
    let (&mut copied, plain) = (&mut original, 4);
    original = 5; // OK：copied 是副本，临时借用已经结束
    copied + plain + original
}
```

结构化模式自动解引用 `&T` / `&mut T` 时则会创建字段重借用。绑定会保持对原位置的共享或可变借用，直到所有相关绑定的最后一次使用；可变重借用存活期间，父 `&mut` 会被冻结。不同字段的重借用仍按位置分别追踪。

## 模式绑定也会移动

`match` 和 `for` 中的非 `Copy` 绑定会接管匹配值的所有权：

```riddle
match value {
    Some(resource) => {
        consume(resource);
    }
}
```

`resource` 没有被继续移动时会在当前 arm 结束时析构；传给 `consume` 后，arm 不会再次析构它。结构体模式只移动实际绑定的非 `Copy` 字段，未绑定字段和按 `Copy` 取得的字段仍可在 `match` 后使用；整个原值因为处于部分移动状态而不能再作为整体使用。`for` 的当前元素遵循同一规则，未取出的元素继续由迭代器持有。为了保证用户析构函数始终能看到完整的 `self`，实现了 `Drop` 的类型不能通过解构模式移出非 `Copy` 字段，包括嵌套在普通聚合类型中的 `Drop` 值。
