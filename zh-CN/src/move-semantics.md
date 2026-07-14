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
    print(a); // error: a 已经被移动
    print(b);
}
```

`let b = a;` 之后，`Foo` 的值移动到了 `b`。`a` 不再可用。

## 传参会移动

把值传给函数也会移动：

```riddle
fun consume(foo: Foo) {
    print(foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    consume(foo);
    print(foo); // error: foo 已经被移动
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
    print(foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    inspect(&foo);
    print(foo); // 可以继续使用
}
```

引用没有逃逸时，`foo` 仍然保留在当前作用域中。

## Copy 类型

有些类型不会在赋值和传参时移动，而是复制。标量、引用、函数和枚举等内置类型属于 Copy 候选。

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
