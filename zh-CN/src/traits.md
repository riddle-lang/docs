# Trait

trait 声明一组方法（有的可以带默认体）和关联类型，由具体类型在 impl 块里实现。声明和实现分开写，调用时按接收者的类型解析。

## 声明与实现

```riddle
trait Summary {
    fun summarize(&self) -> i32;
}

struct Article {
    words: i32,
}

impl Summary for Article {
    fun summarize(&self) -> i32 {
        self.words
    }
}

fun main() -> i32 {
    let article = Article { words: 3 };
    article.summarize()
}
```

没有函数体的方法就是必需方法，impl 里缺一个报 E0026。带体的方法可以直接调用同一 trait 的其它方法，impl 里覆写它时以 impl 的版本为准：

```riddle
trait Value {
    fun base(&self) -> i32;

    fun doubled(&self) -> i32 {
        self.base() * 2
    }
}

struct Item {
    value: i32,
}

impl Value for Item {
    fun base(&self) -> i32 {
        self.value
    }
}

fun main() -> i32 {
    let item = Item { value: 4 };
    item.doubled()
}
```

## 父 trait

`trait Tagged: Named` 表示实现 `Tagged` 的类型也必须实现 `Named`，于是 `T: Tagged` 的泛型代码可以直接调用 `Named` 的方法：

```riddle
trait Named {
    fun name(&self) -> i32;
}

trait Tagged: Named {
    fun tag(&self) -> i32;
}

struct Thing {
    value: i32,
}

impl Named for Thing {
    fun name(&self) -> i32 {
        self.value
    }
}

impl Tagged for Thing {
    fun tag(&self) -> i32 {
        self.value + 1
    }
}

fun combine<T: Tagged>(value: T) -> i32 {
    value.name() + value.tag()
}

fun main() -> i32 {
    combine(Thing { value: 1 })
}
```

父 trait 可以写多个，用 `+` 分隔。名字解析不到或继承成环报 E0044；只实现了子 trait 而没实现父 trait 报 E0036：

```riddle
trait Named {
    fun name(&self) -> i32;
}

trait Tagged: Named {
    fun tag(&self) -> i32;
}

struct Thing {
    value: i32,
}

impl Tagged for Thing { // E0036
    fun tag(&self) -> i32 {
        self.value
    }
}

fun main() {}
```

## 泛型约束

bound 写在类型参数上（`<T: Named>`）或 `where` 子句里，多个 bound 用 `+` 连接，可以约束关联类型（`T: std::ops::Add<Output = T>`）。语法与调用点检查见[泛型](./generics.md)：实参不满足 bound 报 E0035，trait 名解析不到报 E0023，实参个数不符报 E0032。

trait 的类型参数可以带默认值，省略时用默认值补齐：

```riddle
trait Same<Rhs = Self> {
    fun same(&self, other: Rhs) -> bool;
}

struct Number {
    value: i32,
}

impl Same for Number {
    fun same(&self, other: Number) -> bool {
        other.value == self.value
    }
}

fun main() -> bool {
    let a = Number { value: 1 };
    let b = Number { value: 1 };
    a.same(b)
}
```

## 关联类型

关联类型是 trait 里的占位类型，由每个 impl 填上具体类型。trait 的方法可以用 `Self::名字` 引用它：

```riddle
trait Source {
    type Item;
    fun get(&self) -> Self::Item;
}

struct Number {
    value: i32,
}

impl Source for Number {
    type Item = i32;
    fun get(&self) -> i32 {
        self.value
    }
}

fun read<S: Source<Item = i32>>(source: &S) -> i32 {
    source.get()
}

fun main() -> i32 {
    let number = Number { value: 7 };
    read(&number)
}
```

impl 里没给必需关联类型报 E0027。`dyn Trait` 用关联类型时必须写成 `dyn Source<Item = i32>`，漏掉绑定报 E0034：

```riddle
trait Source {
    type Item;
    fun get(&self) -> Self::Item;
}

fun read(value: &dyn Source) -> i32 { // E0034
    value.get()
}

fun main() {}
```

关联常量不存在：trait 的条目只允许 `fun` 和 `type`，写 `const` 在解析阶段就被拒绝（`expected trait item, found Const`），没有错误码。固有常量只能放在固有 impl 里，见 [impl 块](./impls.md)。

## dyn Trait

`&dyn Trait` 和 `&mut dyn Trait` 是借用视图，具体类型在运行时才确定。`&T` 可以自动转成 `&dyn Trait`，`&dyn 子 trait` 也可以转成 `&dyn 父 trait`：

```riddle
trait Speak {
    fun speak(&self) -> i32;
}

trait Loud: Speak {
    fun volume(&self) -> i32;
}

struct Speaker {
    value: i32,
}

impl Speak for Speaker {
    fun speak(&self) -> i32 {
        self.value
    }
}

impl Loud for Speaker {
    fun volume(&self) -> i32 {
        self.value * 2
    }
}

fun quiet(value: &dyn Speak) -> i32 {
    value.speak()
}

fun main() -> i32 {
    let speaker = Speaker { value: 5 };
    let loud: &dyn Loud = &speaker;
    quiet(loud)
}
```

方法表是可派发方法的并集：impl 提供的方法、trait 默认方法和父 trait 的方法都在里面。父 trait 与子 trait 有同名方法时，`dyn` 上的那次调用报 E0013 ambiguous；普通方法解析不报歧义，见 [impl 块](./impls.md)。

裸 `dyn Trait` 是拥有所有权的值，可以直接当返回类型或参数类型，不需要额外的包装类型：

```riddle
trait Speak {
    fun speak(&self) -> i32;
}

struct Speaker {
    value: i32,
}

impl Speak for Speaker {
    fun speak(&self) -> i32 {
        self.value
    }
}

fun make() -> dyn Speak {
    Speaker { value: 7 }
}

fun call_owned(value: dyn Speak) -> i32 {
    value.speak()
}

fun main() -> i32 {
    call_owned(make())
}
```

拥有型对象在堆上保存数据指针、方法槽和一个 drop 槽；离开作用域时通过 drop 槽析构具体类型的值。`dyn Fn(i32) -> i32` 这类 callable 对象用同一套表示，接收者规则见[匿名函数与迭代器](./functional.md)。

## 对象安全

对象安全不是 trait 声明处的检查：trait 定义和 impl 本身都能通过，只有在 `dyn` 上调用那个方法时才报 E0013。判定条件有五个：

- 第一个参数必须是 `self` 接收者，否则报 the first parameter is not a `self` receiver；
- 接收者必须借用（`&self` / `&mut self`），按值 `self` 报 by-value `self` cannot be called through a borrowed dyn object；
- 方法不能有自己的泛型参数（含 `const` 参数），否则报 generic methods require static monomorphization；
- 非接收者参数里不能出现裸 `Self`；
- 返回类型里不能出现裸 `Self`。

按值 `self` 的 trait 可以正常声明和实现，只有拿它做动态调用时才失败：

```riddle
trait Duplicate {
    fun duplicate(self) -> Self;
}

struct Speaker {
    value: i32,
}

impl Duplicate for Speaker {
    fun duplicate(self) -> Self {
        self
    }
}

fun call(value: &dyn Duplicate) -> i32 {
    value.duplicate().value // E0013
}

fun main() {}
```

## 孤儿规则与一致性

trait 和类型都在同一个包里时随意实现。跨包实现要求 `Self` 或 trait 的类型实参里有本包定义的结构体或枚举，否则报 E0048：

```riddle
impl std::ops::Add for bool { // E0048
    type Output = bool;
    fun add(self, rhs: bool) -> bool {
        self
    }
}

fun main() {}
```

`&T` 和 `&mut T` 在判定中是透明的，本地性跟着被指向的类型走。`#[fundamental]` 能把同样的透明性给自定义类型，但它是标准库保留属性，用户代码写它报 E0049。

同一个 trait 对重叠的类型实现两次报 E0047。impl 的 `where` 子句还要满足 Paterson 条件：bound 里的类型必须严格小于被实现的类型，`impl<T> Foo for T where Wrap<T>: Foo` 报 E0037。

## 内置 trait

`Copy`、`Clone`、`Drop`、比较与运算符 trait、`Display` 和 `Debug` 都是标准库里的 trait，用 `#[lang = "..."]` 标记，编译器按标记识别它们。`Copy` 与 `Drop` 的语义见[移动语义](./move-semantics.md)，运算符、派生和格式化见[常用标准库](./standard-library.md)。

`Fn`、`FnMut`、`FnOnce` 是保留名，用户声明同名 trait 报 E0048。`#[lang]` 和 `#[fundamental]` 同样只有标准库能用，用户包写它们报 E0049。
