# 泛型

泛型参数写在 `<>` 里：`<T>` 是类型参数，`<const N: usize>` 是常量参数。函数、结构体、枚举、trait 和 impl 都可以声明它们。

## 泛型函数

类型参数由实参推断，一个函数可以有多个：

```riddle
fun id<T>(value: T) -> T {
    value
}

fun pair<A, B>(first: A, second: B) -> (A, B) {
    (first, second)
}

fun main() -> i32 {
    let n = id(1);
    let p = pair(n, true);
    p.0
}
```

调用处可以显式给出类型实参，写法和 Rust 一致，需要前导 `::`：

```riddle
fun id<T>(value: T) -> T {
    value
}

struct Wrapper<T> {
    value: T,
}

impl<T: Copy> Wrapper<T> {
    fun with<U>(self, extra: U) -> (T, U) {
        (self.value, extra)
    }
}

fun main() -> bool {
    let n = id::<i32>(1);
    let wrapper = Wrapper { value: n };
    let pair = wrapper.with::<bool>(true);
    pair.1
}
```

方法自己的类型实参写在方法名后（`wrapper.with::<bool>(true)`），类型本身的实参写在类型路径上：`Vector::<i32>::new()`。表达式的类型实参后面必须紧跟 `(` 或 `{`，所以结构体字面量也能显式指定：

```riddle
struct Box2<T> {
    value: T,
}

fun main() -> i32 {
    let b = Box2::<i32> { value: 1 };
    b.value
}
```

类型位置不需要 `::`，直接写 `Box2<i32>`。

## 泛型类型

结构体和枚举的类型参数用法相同。嵌套泛型里 `>>` 直接连写，不用插空格：

```riddle
struct Pair2<A, B> {
    first: A,
    second: B,
}

enum Slot<T> {
    Empty,
    Value(T),
}

fun main() -> i32 {
    let slot: Slot<Pair2<i32, bool>> = Slot::Value(Pair2 { first: 1, second: true });
    match slot {
        Slot::Empty => 0,
        Slot::Value(pair) => pair.first,
    }
}
```

结构体和枚举的声明里可以直接写 bound（`struct Box2<T: Copy>`），也可以写 `where` 子句。

## const 泛型

常量参数的用途是数组长度。它由数组实参推断，也可以在类型标注里显式写出：

```riddle
struct Buffer<T, const N: usize> {
    data: [T; N],
}

impl<T, const N: usize> Buffer<T, N> {
    fun len(&self) -> usize {
        N
    }
}

fun len_of<const N: usize>(values: [i32; N]) -> usize {
    N
}

fun main() -> usize {
    let buffer: Buffer<i32, 3> = Buffer { data: [1, 2, 3] };
    buffer.len() + len_of([1, 2, 3])
}
```

常量参数的推断只来自类型：函数调用里不能写 `len_of::<3>(..)`。

```riddle
fun len_of<const N: usize>(values: [i32; N]) -> usize {
    N
}

fun main() -> usize {
    len_of::<3>([1, 2, 3]) // E0005
}
```

常量参数没有出现在任何数组长度里时，函数无法被调用：`fun f<const N: usize>() -> usize { N }` 没有可以推断 `N` 的来源，调用它报 E0005。类型标注不受这个限制，`let s: S<3> = ...` 可以给一个只声明 `<const N: usize>` 的结构体定值。

## 泛型 impl

固有 impl 和 trait impl 都可以带参数，bound 写在 impl 上，对该 impl 里的所有方法生效：

```riddle
struct Wrap<T> {
    value: T,
}

trait Peek {
    fun peek(&self) -> i32;
}

struct Thing {
    n: i32,
}

impl Peek for Thing {
    fun peek(&self) -> i32 {
        self.n
    }
}

impl<T: Peek> Peek for Wrap<T> {
    fun peek(&self) -> i32 {
        self.value.peek()
    }
}

fun main() -> i32 {
    let wrapper = Wrap { value: Thing { n: 4 } };
    wrapper.peek()
}
```

bound 不满足时方法根本找不到，报 E0013 unknown method（`Wrap<i32>::peek()`）；这一点与自由函数的 E0035 不同，见 [impl 块](./impls.md)。

## bound 与 where

`<T: A + B>` 要求同时满足多个 trait，`where` 子句等价，只是位置更灵活：

```riddle
trait Named {
    fun name(&self) -> i32;
}

trait Tagged {
    fun tag(&self) -> i32;
}

fun combine<T>(value: T) -> i32
where T: Named + Tagged
{
    value.name() + value.tag()
}
```

bound 里可以约束关联类型：

```riddle
fun add_box<T: std::ops::Add<Output = T>>(left: T, right: T) -> T {
    left + right
}

fun main() -> i32 {
    add_box(1, 2)
}
```

bound 在调用点检查。实参类型不满足时报 E0035：

```riddle
trait Named {
    fun name(&self) -> i32;
}

fun read<T: Named>(value: T) -> i32 {
    value.name()
}

fun main() -> i32 {
    read(1) // E0035
}
```

trait 名解析不到报 E0023，类型实参个数不符报 E0032，泛型实参列表不允许尾逗号。trait 声明可以给类型参数默认值（`trait Add<Rhs = Self>`），函数和 impl 不行。

## 单态化

泛型在编译期按用到的类型组合展开成具体函数，运行时没有类型信息。MIR 里能看到展开后的符号：

```text
fn id__i32(%0: I32) -> I32
fn id__bool(%0: bool) -> bool
```

需要运行时多态时用 `dyn Trait`，见 [Trait](./traits.md)。

## 递归泛型

递归调用如果让类型实参变大，实例会无限增长，类型检查直接拒绝：

```riddle
struct Wrap<T> {
    inner: T,
}

fun grow<T>(value: T) -> i32 {
    grow(Wrap { inner: value }) // E0033
}

fun main() -> i32 {
    grow(1)
}
```

类型实参不变的递归是允许的：

```riddle
fun depth<T>(value: T, n: i32) -> i32 {
    if n == 0 {
        0
    } else {
        depth(value, n - 1)
    }
}

fun main() -> i32 {
    depth(1, 3)
}
```

生命周期参数不存在；`dyn A + B` 和 `impl A + B` 也不支持，多个 bound 只能写在 bound 位置。
