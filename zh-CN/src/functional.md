# 匿名函数与迭代器

## 方括号匿名函数

匿名函数写成 `[参数 -> 体]`，可以存进变量、当实参传递、从函数返回：

```riddle
fun apply(f: impl Fn(i32) -> i32, value: i32) -> i32 {
    f(value)
}

fun main() {
    let inc = [it -> it + 1];
    let doubled = [it: i32 -> it * 2](21);
    println!("{} {}", apply(inc, 41), doubled);
}
```

参数类型和返回类型都从期望的可调用签名推断，推断不出来时给参数写标注（`[x: i32 -> x]`）；返回类型始终推断，不能标注。`it` 只是单参时的惯用名，不是关键字或隐式参数。

零参写成 `[ -> 体]`——空的 `[]` 仍然是空数组字面量。参数支持解构和尾逗号，体可以是块表达式：

```riddle
fun main() {
    let sum = [a: i32, b: i32 -> a + b];
    let maker = [ -> 7];
    let base = 10;
    let offset = move [it: i32 -> base + it];
    println!("{} {} {}", sum(1, 2), maker(), offset(1));
}
```

`move [...]` 把用到的外部位置按值捕获，`Copy` 值仍然复制：

```riddle
fun main() {
    let base = 5;
    let add = move [it: i32 -> it + base];
    println!("{} {}", add(1), base);
}
```

后缀位置写 `expr [参数 -> 体]` 表示用这个匿名函数作为唯一实参调用 `expr`，方法链依赖这条规则：`values.iter().map [value -> *value * 2]`。

每个匿名函数表达式有自己的具体类型，两个写法完全相同的表达式也是不同类型。需要让两个参数是同一个具体类型时，用泛型参数加 `Fn` bound（见下）。匿名函数不能声明泛型参数、`where` 子句或返回类型，也不能递归调用自己：

```riddle
fun main() {
    let fact = [n: i32 -> if n <= 1 { 1 } else { n * fact(n - 1) }];   // E0050
    println!("{}", fact(3));
}
```

三种写法已经移除：竖线闭包 `|x| x` 是解析错误，`fun(x) { x }` 有专门诊断，类型位置的 `fun(i32) -> i32` 同样有专门诊断。旧代码里的 `fun` 匿名函数写成方括号形式即可。

```riddle
fun main() {
    let f = |x| x;      // 解析错误：竖线闭包语法已移除
    println!("{}", f(1));
}
```

## 捕获

匿名函数按函数体里的用法决定每个外部位置的捕获方式：

- 只读取：按共享引用捕获；
- 赋值或取 `&mut`：按可变引用捕获；
- 值被移走（交给按值参数、作为返回值、存进其他值）：按值捕获，`Copy` 值在这个位置仍然按复制处理。

捕获精确到静态字段和元组元素。读 `pair.left` 不会借用 `pair.right`：

```riddle
struct Pair { left: String, right: String }

fun main() {
    let mut pair = Pair { left: String::from_str("a"), right: String::from_str("b") };
    let left_len = [ -> pair.left.len()];
    pair.right.push_str("!");
    println!("{} {}", left_len(), pair.right.as_str());
}
```

常量下标 `values[0]` 同样精确到元素，变量下标 `values[i]` 只能捕获整个 `values`。解引用捕获的是那个引用值本身，不是它指向的存储。

捕获方式决定调用能力：只读环境的是 `Fn`，修改环境的是 `FnMut`，调用时移出环境中非 `Copy` 值的是 `FnOnce`。`Fn` 满足 `FnMut` 和 `FnOnce`，`FnMut` 满足 `FnOnce`。`FnMut` 需要可变绑定才能调用：

```riddle
fun count() -> i32 {
    let mut total = 0;
    let mut add = [value: i32 -> {
        total += value;
        total
    }];
    add(1);
    add(2);
    total
}

fun main() {
    println!("{}", count());
}
```

可变捕获的借用活到闭包的最后一次使用，在那之前读被捕获的绑定会报 `E0301`：

```riddle
fun main() {
    let mut total = 0;
    let mut add = [value: i32 -> {
        total += value;
        total
    }];
    add(1);
    println!("{} {}", total, add(2));      // E0301
}
```

按值捕获时目标仍有活借用报 `E0304`；从实现了 `Drop` 的类型移出字段报 `E0305`。闭包环境需要逃逸时被提升到 GC 堆，所以可以从函数返回拥有捕获的匿名函数：

```riddle
fun make_len() -> impl Fn() -> usize {
    let text = String::from_str("hello");
    move [ -> text.len()]
}

fun main() {
    println!("{}", make_len()());
}
```

反过来，闭包返回指向被捕获容器的引用过不了借用检查：

```riddle
fun main() {
    let values = vec![1, 2, 3];
    let pick = [index: usize -> &values[index]];     // E0306
    println!("{}", *pick(1usize));
}
```

## 可调用参数与返回值

参数位置的 `impl Fn(i32) -> i32` 引入一个隐藏类型参数，接收匿名函数、命名函数项和实现了 callable trait 的用户类型。每个 `impl Fn*` 参数各自引入一个隐藏类型；要让两个参数是同一个具体类型，写显式泛型参数：

```riddle
fun apply2(first: impl Fn(i32) -> i32, second: impl Fn(i32) -> i32, value: i32) -> i32 {
    first(value) + second(value)
}

fun combine<F>(first: F, second: F, value: i32) -> i32
where F: Fn(i32) -> i32
{
    first(value) + second(value)
}

fun main() {
    println!("{}", apply2([it -> it + 1], [it -> it * 2], 10));
    let inc = [it -> it + 1];
    println!("{}", combine(inc, inc, 10));
}
```

`mut` 写在参数绑定上，`FnMut` 参数需要它才能调用两次：

```riddle
fun call_twice(mut f: impl FnMut(i32) -> i32, value: i32) -> i32 {
    f(value);
    f(value)
}

fun main() {
    println!("{}", call_twice([it -> it + 1], 1));
}
```

返回位置的 `impl Fn*` 隐藏一个具体返回类型，所有返回路径必须产生同一个类型：

```riddle
fun make_adder(base: i32) -> impl Fn(i32) -> i32 {
    move [value: i32 -> base + value]
}

fun main() {
    let add = make_adder(3);
    println!("{}", add(4));
}
```

两个不同的匿名函数不能从同一个 `impl Fn` 返回路径出去：

```riddle
fun pick(flag: bool) -> impl Fn(i32) -> i32 {
    if flag {
        [it -> it + 1]
    } else {
        [it -> it * 2]      // E0002
    }
}

fun main() {
    println!("{}", pick(true)(1));
}
```

用户类型可以实现 callable trait，`call` 的 receiver 依次是 `&self`、`&mut self`、`self`，与 `Fn`、`FnMut`、`FnOnce` 对应：

```riddle
struct Adder { amount: i32 }

impl Fn(i32) -> i32 for Adder {
    fun call(&self, value: i32) -> i32 {
        value + self.amount
    }
}

fun main() {
    let adder = Adder { amount: 2 };
    println!("{}", adder(40));
}
```

receiver 写错报 `E0020`，缺少 `call` 报 `E0021`。`Fn`、`FnMut`、`FnOnce` 是保留 trait 名，自己声明同名 trait 报 `E0048`：

```riddle
struct Adder { amount: i32 }

impl Fn(i32) -> i32 for Adder {
    fun call(&mut self, value: i32) -> i32 {      // E0020
        value + self.amount
    }
}
```

`dyn Fn*` 支持拥有值和借用值，三种能力都可用。`dyn Fn` 必须带签名，缺签名报 `E0047`：

```riddle
fun apply(f: &dyn Fn(i32) -> i32, value: i32) -> i32 {
    f(value)
}

fun main() {
    let inc = [it: i32 -> it + 1];
    let borrowed: &dyn Fn(i32) -> i32 = &inc;
    println!("{} {}", apply(borrowed, 1), borrowed(2));
}
```

拥有的 `FnMut` 值通过不可变绑定调用报 `E0031`；`&mut dyn FnMut` 只要求引用本身可变。`unsafe` 函数项不能传给安全的 `Fn*` 参数，报 `E0001`。类型位置曾经存在的 `fun(T) -> U` 已经移除，写上会得到指向 `impl Fn` 的诊断：

```riddle
fun apply(f: fun(i32) -> i32, value: i32) -> i32 {      // 解析错误：函数类型语法已移除
    f(value)
}
```

## 迭代协议

`for value in x` 只需要两个协议：`IntoIterator` 把值变成迭代器，`Iterator` 逐个取出元素。

```text
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

手写实现必须把 `next` 写成 `&mut self`。`for` 只看 `IntoIterator`：只实现 `Iterator` 的类型报 `E0035`，标准库里的 `SliceIter`、`HashMapIter` 都是这种情况。

```riddle
struct Counter {
    limit: i32,
}

struct CounterIter {
    limit: i32,
    current: i32,
}

impl Iterator for CounterIter {
    type Item = i32;

    fun next(&mut self) -> Option<i32> {
        if self.current >= self.limit {
            return None;
        }
        let value = self.current;
        self.current += 1;
        Some(value)
    }
}

impl IntoIterator for Counter {
    type Item = i32;
    type IntoIter = CounterIter;

    fun into_iter(self) -> CounterIter {
        CounterIter { limit: self.limit, current: 0 }
    }
}

fun main() {
    let counter = Counter { limit: 3 };
    let mut total = 0;
    for value in counter {
        total += value;
    }
    println!("{}", total);
}
```

泛型参数用 `IntoIterator<Item = ..., IntoIter = ...>` bound 后同样能写 `for`。

区间语法 `start..end` 和 `start..=end` 降级为 `std::ops` 里的 `range` 和 `range_inclusive` 调用；`Range` 不在 prelude，函数形式要先 `use std::ops::range;`。

## 内置可迭代值

标准库为下列值实现了 `IntoIterator`：

| 值 | 产出 |
| --- | --- |
| `Vector<T>` | `T`，顺序遍历并消耗向量 |
| `&Vector<T>`、`&mut Vector<T>` | `&T`、`&mut T` |
| `[T; N]` | `T`；`&[T; N]` 和 `&mut [T; N]` 产出引用 |
| `&[T]`、`&mut [T]` | `&T`、`&mut T` |
| `&str`、字符串字面量 | `char`，按 UTF-8 解码 |
| `&HashMap<K, V>` | `(&K, &V)`，插入顺序，第一次删除后顺序改变 |
| `HashSetIter<T>`、`&HashSet<T>` | `&T`，顺序同 `HashMap` |
| `&TreeMap<K, V>`、`TreeMapKeys`、`TreeMapValues`、`TreeMapRangeIter` | 按键升序 |
| `TreeSetIter<T>`、`&TreeSet<T>` | `&T`，升序 |
| `Range<T>`、`RangeInclusive<T>` | `T`，升序 |
| 十个迭代器适配器 | 见下一节 |

没有实现 `IntoIterator` 的包括 `HashMapIter`、`HashMapKeys`、`HashMapValues`、`TreeMapIter`、`SliceIter`、`SliceIterMut`、`StrIter`、`VectorIntoIter`、`array::IntoIter`，以及按值的 `HashSet<T>` 和 `TreeSet<T>`。

```riddle
fun main() {
    let values = vec![1, 2, 3];
    let mut total = 0;
    for value in &values {
        total += *value;
    }
    let mut letters = 0;
    for _ in "abc" {
        letters += 1;
    }
    println!("{} {}", total, letters);
}
```

## 迭代器适配器

`Iterator` 的必需项只有 `next`，其余 15 个方法都带默认实现。按 receiver 分成两组：

| 收 `&mut self` | 收 `self` |
| --- | --- |
| `count() -> usize` | `fold<B>(init: B, f: impl FnMut(B, Item) -> B) -> B` |
| `nth(n: usize) -> Option<Item>` | `map<U, F>(f) -> Map<...>`，闭包收 `Item`、产出 `U` |
| `for_each(f: impl FnMut(Item) -> ())` | `filter<F>(predicate) -> Filter<...>`，谓词收 `&Item`、产出 `Item` |
| `all(predicate: impl FnMut(Item) -> bool)` | `chain<J>(other: J) where J: Iterator<Item = Item>` |
| `any(predicate: impl FnMut(Item) -> bool)` | `take_while<F>(predicate)`、`skip_while<F>(predicate)`，谓词收 `&Item`、产出 `Item` |
| `find(predicate: impl FnMut(&Item) -> bool) -> Option<Item>` | `inspect(f: impl FnMut(&Item) -> ())`，产出 `Item` |
| `position(predicate: impl FnMut(&Item) -> bool) -> Option<usize>` | `collect(self) -> Vector<Item>` |

两组方法的 receiver 不同带来两个结果：`count`、`nth`、`find` 这类方法用完还能继续用同一个迭代器（Rust 里不行）；`map`、`filter` 这类方法会消费迭代器，产出的适配器本身也是迭代器。谓词收 `&Item`，所以对 `values.iter()`（元素是 `&i32`）写 `filter` 时闭包参数是 `&&i32`。

```riddle
fun main() {
    let values = vec![1, 2, 3, 4, 5];
    let total = values.iter().fold(0, [acc, value: &i32 -> acc + *value]);
    let evens: Vector<i32> = values.iter().map([value: &i32 -> *value]).filter([value: &i32 -> *value % 2 == 0]).collect();
    println!("{} {:?}", total, evens);
}
```

`collect` 只能收集成 `Vector<Item>`。要急切地映射或过滤到新向量，用自由函数 `map_into(&mut iterator, f)` 和 `filter_into(&mut iterator, predicate)`。

自由函数位于 `std::iter`，需要导入：`enumerate`、`take`、`skip`、`zip`、`chain`、`take_while`、`skip_while`、`inspect`、`map_into`、`filter_into`、`min`、`max`。`take`、`skip`、`chain`、`take_while`、`skip_while`、`inspect` 产出原来的 `Item`，`enumerate` 产出 `(usize, Item)`，`zip` 产出 `(A::Item, B::Item)` 二元组。其中 `take`、`skip`、`zip`、`enumerate` 只有函数形式，写成方法报 `E0013`：

```riddle
use std::iter::{enumerate, take};

fun main() {
    let values = vec![10, 20, 30];
    for (index, value) in enumerate(take(values.iter(), 2usize)) {
        println!("{} {}", index, *value);
    }
}
```

`min` 和 `max` 按元素自身的顺序比较。元素是引用时先把值取出来：`min(values.iter())` 比较的是 `&i32`，当前实现返回的结果不正确；`min(values.iter().map([value: &i32 -> *value]))` 才有正确的语义。

```riddle
use std::iter::{max, min};

fun main() {
    let values = vec![4, 1, 3];
    let smallest = min(values.iter().map([value: &i32 -> *value])).unwrap_or(0);
    let largest = max(values.iter().map([value: &i32 -> *value])).unwrap_or(0);
    println!("{} {}", smallest, largest);
}
```

十个适配器都实现了 `IntoIterator`，所以 `for value in values.iter().map(f)` 能过，而 `for value in values.iter()` 不能——这不是同一件事。`DoubleEndedIterator` 只有 `SliceIter` 一个实现者：

```riddle
fun main() {
    let values = vec![1, 2, 3];
    let mut iter = values.as_slice().iter();
    println!("{} {}", *iter.next_back().unwrap(), *iter.next().unwrap());
}
```

`Iterator` 没有 `sum`、`product`、`last`、`rev`、`reduce`、`flat_map`、`filter_map`、`peekable`、`step_by`、`scan`、`by_ref`、`size_hint`；也没有 `FromIterator` 和 `Extend`，`Option`、`Result`、`&mut I` 都不是迭代器。循环里的 `break`、`continue` 与迭代器的析构规则见[控制流](./control-flow.md)。
