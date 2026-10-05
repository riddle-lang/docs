# 函数

用 `fun` 声明函数。参数写在括号里并带类型，返回类型跟在 `->` 后面，函数体是一个块：

```riddle
fun add(a: i32, b: i32) -> i32 {
    a + b
}
```

没有返回值时省略 `->`，函数体类型是 `()`。

参数就是绑定：传非 `Copy` 值会把所有权移动进函数，`Copy` 类型按复制传入。见[移动语义](./move-semantics.md)。

## 返回值

块的最后一个是表达式就是返回值，不需要 `return`：

```riddle
fun square(x: i32) -> i32 {
    x * x
}
```

`return` 留给提前退出：条件分支里结束函数时用它，其余情况用尾表达式更省事。

```riddle
fun abs(x: i32) -> i32 {
    if x < 0 {
        return -x;
    }
    x
}
```

## 函数是值

函数名本身可以当值使用：

```riddle
fun add(a: i32, b: i32) -> i32 {
    a + b
}

fun main() {
    let f = add;
    println!("{}", f(1, 2)); // 3
}
```

`fun(i32, i32) -> i32` 这种函数类型语法已经移除。需要把函数当参数传时，用 `impl Fn(i32, i32) -> i32` 或显式的 `F: Fn(i32, i32) -> i32` 约束：

```riddle
fun apply<F: Fn(i32, i32) -> i32>(f: F, x: i32) -> i32 {
    f(x, x)
}
```

捕获环境、`Fn` / `FnMut` / `FnOnce` 的区别和 `dyn Fn` 见[匿名函数与迭代器](./functional.md)。

## impl Trait

参数位置的 `impl Trait` 等价于一个隐藏的泛型参数，每次调用按具体类型单态化：

```riddle
fun show(x: impl std::fmt::Display) {
    println!("{}", x);
}

fun main() {
    show(1);
    show("text");
}
```

返回位置的 `impl Trait` 隐藏一个具体的返回类型，所有返回路径必须是同一个类型：

```riddle
fun make() -> impl std::fmt::Display {
    1
}
```

两个位置不能简单互推：返回位置不允许直接把调用方传进来的泛型参数还回去，`fun f(x: impl Display) -> impl Display { x }` 会报 `E0035`，因为编译器无法证明这个不透明类型实现了 `Display`。需要在调用方和被调方之间传递抽象类型时，用泛型参数或 `dyn Trait`。

## 泛型函数

类型参数、推断、显式实参和 const 泛型见[泛型](./generics.md)。

## 只写签名

语法上允许省略函数体：

```riddle
fun external_log(value: i32);
```

这种声明只通过前端检查，编译器不会为它生成任何实现；调用它时解释器会报 `call to unknown function`，C 后端生成的调用也没有对应的定义。需要调用外部实现时用 `unsafe extern "C"`，见[FFI 与 C 后端](./ffi-and-tooling.md)。
