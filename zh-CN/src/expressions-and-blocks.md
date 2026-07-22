# 表达式与块

Riddle 中很多东西都是表达式。表达式会产生值，而语句主要用于执行动作。
理解表达式和块，是理解 Riddle 函数、控制流和所有权规则的基础。

## 表达式会产生值

下面这些都是表达式：

```riddle
1
x + y
foo(1, 2)
point.x
items[0]
n as i64
```

表达式可以出现在变量初始化、函数参数、返回值和更大的表达式中。

## 匿名函数

匿名函数使用 `fun(...) { ... }`，可以保存到变量或作为参数传递：

```riddle
fun apply(f: fun(i32) -> i32, value: i32) -> i32 {
    f(value)
}

fun main() -> i32 {
    let inc = fun(x) { x + 1 };
    apply(inc, 41)
}
```

省略的参数和返回类型会在当前函数体内做单态推断。无法确定类型时需要显式标注，例如 `fun(x: i32) -> i32 { x }`。

匿名函数可以捕获外层局部变量和参数，捕获方式由函数体中的用法自动推断：

- 只读取时按共享引用捕获；
- 赋值或取得 `&mut` 时按可变引用捕获；
- 把非 `Copy` 值交给按值参数、返回或存入其他值时按值捕获。

```riddle
fun make_adder(base: i32) -> fun(i32) -> i32 {
    fun(value: i32) { base + value }
}

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

捕获模式也决定调用能力：只共享捕获的闭包是 `Fn`，包含可变捕获的是 `FnMut`，移入非 `Copy` 值的是 `FnOnce`。调用 `FnMut` 的绑定必须写成 `let mut`；`FnOnce` 调用后不能再次使用。局部控制流汇合会保留限制最强的调用能力，例如两个分支产生的 `FnOnce` 闭包在汇合后仍只能调用一次。

语法中没有单独的 `move` 关键字，也还不能显式写出 `FnMut` 或 `FnOnce` 类型。类型标注、函数参数和返回值中的 `fun(...) -> T` 当前表示 `Fn`，所以推断为 `FnMut` 或 `FnOnce` 的闭包不能穿过这种显式边界。

当前捕获粒度是整个绑定，不会把同一结构体的不同字段拆成独立捕获。普通局部变量、函数参数、外层匿名函数参数，以及 `match`、`for` 等模式产生的绑定都可以捕获。

## 分号会丢弃值

在 Riddle 中，分号表示“把这个表达式当成语句执行，并丢弃它的结果”。

```riddle
fun main() {
    let x = 1 + 2;
    x + 1;
}
```

`x + 1;` 有分号，所以它的结果不会作为函数体返回值。

如果去掉分号，它就会成为块的尾表达式：

```riddle
fun value() -> i32 {
    let x = 1 + 2;
    x + 1
}
```

这个函数返回 `x + 1` 的结果。

## 块也是表达式

块由 `{}` 包围，可以包含多条语句，也可以有一个尾表达式：

```riddle
fun main() {
    let value = {
        let a = 1;
        let b = 2;
        a + b
    };

    print(value)
}
```

这里内部块的值是 `a + b`，因此 `value` 会绑定到这个结果。

## 块创建作用域

块不仅能产生值，也会创建新的作用域：

```riddle
fun main() {
    let outer = 1;

    {
        let inner = 2;
        print(inner);
    }

    print(outer)
    // inner 在这里不可用
}
```

作用域会影响变量何时失效，也会影响引用是否逃逸。后面的“引用与逃逸”会详细解释这一点。

## 常见表达式

数组字面量和索引用于固定长度数组：

```riddle
fun first() -> i32 {
    let values: [i32; 3] = [1, 2, 3];
    let zeros: [i32; 3] = [0; 3];
    values[0]
}
```

类型转换使用 `as`：

```riddle
let wide = 1i32 as i64;
```

当前支持整数之间、整数与浮点数之间、浮点数之间、布尔值到整数、整数到布尔值、整数到原始指针，以及原始指针之间的转换。不支持的组合会报告 E0012。

复合赋值会读取左侧、执行对应运算，再写回左侧：

```riddle
fun count() {
    let mut n: i32 = 1;
    n += 2;
    n <<= 1;
}
```

`unsafe` 块也是表达式。当前它主要保留语法结构，方便后续接入需要显式标记的低层能力：

```riddle
let value = unsafe {
    1
};
```
