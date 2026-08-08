# 闭包与迭代器

函数式能力在 Riddle 中表现为两类：匿名函数（闭包）让行为可以按值传递，`Iterator` / `IntoIterator` 协议让遍历可以统一。这两者都依赖泛型与 trait，因此本章放在[泛型、Trait 与模块](./data-and-abstraction.md)之后阅读。

## 匿名函数

匿名函数使用 `fun(...) { ... }`，可以保存到变量或作为参数传递：

```riddle
fun apply(f: impl Fn(i32) -> i32, value: i32) -> i32 {
    f(value)
}

fun main() -> i32 {
    let inc = fun(x) { x + 1 };
    apply(inc, 41)
}
```

省略的参数和返回类型会在当前函数体内做单态推断。无法确定类型时需要显式标注，例如 `fun(x: i32) -> i32 { x }`。每个匿名函数表达式都有独立的具体类型，即使两个表达式的参数和返回类型完全相同，它们也不会自动变成同一种类型。

`move fun(...)` 会按值捕获所有使用到的外部位置，`Copy` 值仍然复制。`move` 只改变捕获所有权，不会单独把匿名函数变成 `FnOnce`；按值捕获后只读取的值仍可产生 `Fn`。

## 捕获

匿名函数可以捕获外层局部变量和参数，捕获方式由函数体中的用法自动推断：

- 只读取时按共享引用捕获；
- 赋值或取得 `&mut` 时按可变引用捕获；
- 把非 `Copy` 值交给按值参数、返回或存入其他值时按值捕获。

捕获按位置精确到静态字段或元组元素。读取 `pair.left` 不会同时捕获 `pair.right`；动态索引无法在编译期确定元素，因此会捕获索引基值；通过引用解引用时捕获的是完成访问所需的引用值。

```riddle
fun count() -> i32 {
    let mut total = 0;
    let mut add = fun(value: i32) -> i32 {
        total += value;
        total
    };
    add(1);
    add(2)
}
```

捕获方式也决定调用能力：只共享读取环境的匿名函数是 `Fn`，需要修改环境的是 `FnMut`，调用时移出环境中非 `Copy` 值的是 `FnOnce`。`Fn` 同时满足 `FnMut` 和 `FnOnce` 要求，`FnMut` 同时满足 `FnOnce` 要求。调用 `FnMut` 需要可变位置；作为参数时写成 `mut f: impl FnMut(...) -> ...`。`FnOnce` 调用后不能再次使用。

非 `Copy` 值捕获会在创建闭包时移动该值；`move fun` 按值捕获所有使用到的外部位置。按引用捕获的局部需要稳定地址，逃逸分析会决定闭包环境留在栈上还是提升到 GC 堆（见[引用与逃逸](./references-and-escape.md#触发逃逸)）。

## 可调用参数与返回值

参数位置使用 `impl Fn`、`impl FnMut` 或 `impl FnOnce` 接收匿名函数和安全命名函数项：

```riddle
fun call_twice(mut f: impl FnMut(i32) -> i32, value: i32) -> i32 {
    f(value);
    f(value)
}
```

`mut` 修饰参数绑定，因此也可以用于普通参数。每个 `impl Fn*` 参数引入独立的隐藏类型；需要让多个参数保持同一具体类型时，显式声明泛型参数：

```riddle
fun combine<F>(first: F, second: F, value: i32) -> i32
where F: Fn(i32) -> i32
{
    first(value) + second(value)
}
```

返回位置的 `impl Fn*` 隐藏一个具体返回类型：

```riddle
fun make_adder(base: i32) -> impl Fn(i32) -> i32 {
    move fun(value: i32) { base + value }
}
```

所有返回路径必须产生同一个具体匿名函数或命名函数项类型。

`Fn`、`FnMut`、`FnOnce` 只能作为编译器提供的静态能力使用；当前不支持 `dyn Fn*`，用户代码也不能手动实现它们。可调用分派只做静态单态化；递归匿名函数、匿名函数泛型参数和匿名函数参数模式同样不支持。不安全函数项不能传给安全的 `Fn*` 参数。

## 迭代协议

`for item in value` 依赖两个 trait：`IntoIterator` 决定如何把值变成迭代器，`Iterator` 决定如何逐个取出元素：

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

标准库的 `Range` 位于 `std::ops`，并提供了 `range(start, end)` 构造半开区间 `[start, end)`。与 Rust 一样，prelude 不会自动导入 `Range` 或 `range`，使用前需要显式导入：

```riddle
use std::ops::range;

fun sum_to_three() -> i32 {
    let mut sum = 0;

    for item in range(0, 3) {
        sum += item;
    }

    sum
}
```

用户类型只要实现 `IntoIterator`，并让它的 `IntoIter` 实现 `Iterator`，也可以用于 `for`。MIR 降级会把这类循环降成 `into_iter` 和 `next` 方法调用；泛型参数也可以通过 `IntoIterator<Item = ..., IntoIter = ...>` bound 使用 `for`，具体 impl 在单态化时解析。

## 内置可迭代值

标准库和语言为以下值直接提供了 `IntoIterator` 实现：

- 固定长度数组 `[T; N]` 通过 `std::array::IntoIter<T>` 逐个按值产出元素，元素类型不需要实现 `Copy`；
- `Vector<T>` 按值产出当前保存的元素并消耗向量；
- 共享切片 `&[T]`、可变切片 `&mut [T]` 产出元素引用；
- `&str` 按 UTF-8 解码产出 Unicode `char`。

```riddle
fun use_array() -> i32 {
    let mut sum = 0;

    for item in [1, 2, 3] {
        sum += item;
    }

    sum
}
```

`[T; N]` 的迭代器定义为 `std::array::IntoIter<T>`，因此 `[1, 2, 3]` 匹配 `impl<T, const N: usize> IntoIterator for [T; N]`。

## break 与 continue

`break` 立即结束最近一层循环，`continue` 跳到最近一层循环的下一次迭代：

```riddle
use std::ops::range;

fun first_three_odd_sum() -> i32 {
    let mut sum = 0;

    for value in range(0, 10) {
        if value == 6 {
            break;
        }
        if value % 2 == 0 {
            continue;
        }
        sum += value;
    }

    sum
}
```

当前只支持无值、无标签的 `break;` 和 `continue;`，并且只能在 `while` 或 `for` 循环体中使用。`for` 的当前元素、迭代器和提前退出路径具有独立的析构作用域：非 `Copy` 的模式绑定在元素离开当前迭代时析构，`break`、`continue` 和 `return` 会先清理正在离开的绑定。
