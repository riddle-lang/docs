# 你好，Riddle

学习一门语言，最好的方式通常不是先背语法，而是先看一段能表达真实意图的代码。
这一章会从一个很小的程序开始，介绍 Riddle 程序由哪些部分组成。

```riddle
struct Point {
    x: i32,
    y: i32,
}

fun distance_squared(point: Point) -> i32 {
    point.x * point.x + point.y * point.y
}

fun main() {
    let point = Point { x: 3, y: 4 };
    let value = distance_squared(point);
    print(value)
}
```

这段程序做了三件事：

- 定义一个 `Point` 结构体；
- 定义一个 `distance_squared` 函数；
- 在 `main` 中创建一个点并调用函数。

## 程序从数据开始

`struct Point` 定义了一种数据形状：

```riddle
struct Point {
    x: i32,
    y: i32,
}
```

它表示一个 `Point` 有两个字段：`x` 和 `y`，类型都是 `i32`。
你可以把结构体理解成“把相关数据放在一起”的方式。

## 函数描述行为

函数使用 `fun` 定义：

```riddle
fun distance_squared(point: Point) -> i32 {
    point.x * point.x + point.y * point.y
}
```

`point: Point` 表示函数接收一个 `Point` 参数。
`-> i32` 表示函数返回一个 `i32`。

函数体最后一行没有分号，因此它是这个块的返回值。这种写法让简单计算更直接，不需要每次都写 `return`。

## main 是入口

`main` 通常是程序的入口：

```riddle
fun main() {
    let point = Point { x: 3, y: 4 };
    let value = distance_squared(point);
    print(value)
}
```

`let point = ...` 创建一个变量绑定。Riddle 中变量默认不可变，这意味着你不能在后面随意修改 `point`。
如果你确实需要修改变量，需要显式写出 `mut`，这会在后面的章节中介绍。

## 值会被移动

注意这行代码：

```riddle
let value = distance_squared(point);
```

Riddle 的值默认遵循移动语义。把 `point` 传给函数时，`point` 的值会被移动进函数。
移动之后，原来的 `point` 绑定不再可用。

这种规则让资源归属更清晰，也让编译器更容易判断一个值什么时候可以被释放、什么时候需要提升到 GC 管理区域。

## 小结

本章中你已经见到了 Riddle 程序最常见的几个部分：

- 用 `struct` 组织数据；
- 用 `fun` 定义函数；
- 用 `let` 创建变量绑定；
- 用尾表达式返回值；
- 值在传递时默认移动。

接下来我们会从变量开始，逐步解释这些概念。
