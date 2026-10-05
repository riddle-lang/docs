# 引用、借用与逃逸

Riddle 没有生命周期参数。引用的合法性由借用检查负责，引用的存储位置由逃逸分析决定。

## 共享引用与可变引用

`&T` 是共享引用，可以同时存在多个；`&mut T` 是可变引用，存活期间不能有别的引用指向同一位置：

```riddle
fun main() {
    let mut value = 42;
    let shared = &value;
    println!("{}", *shared);

    let exclusive = &mut value;
    *exclusive = 43;
    println!("{}", value);
}
```

同时存在的引用类型不匹配时按四种情况报错：

| 现在要 | 已经有了 | 错误码 |
| --- | --- | --- |
| `&mut` | `&` | `E0300` |
| `&` | `&mut` | `E0301` |
| `&mut` | `&mut` | `E0302` |
| `&` | `&` | 允许 |

借用在**持有它的绑定的最后一次使用**之后结束，不是等到作用域结束：

```riddle
fun main() {
    let mut value = 1;
    let shared = &value;
    println!("{}", *shared);
    value = 2;
    println!("{}", value);
}
```

这是 NLL（非词法生命周期）的近似实现：判定依据是源码位置，不构建控制流活跃性；循环体里的冲突用不动点求解，收敛后只报告一次。

## 借用期间不能赋值或移动

`E0303` 是有活借用时赋值，`E0304` 是有活借用时移动：

```riddle
fun main() {
    let mut value = 1;
    let shared = &value;
    value = 2; // E0303
    println!("{}", *shared);
}
```

不相交的结构体字段可以分别可变借用。已知常量下标可以分别借用，动态下标按重叠处理。

## 引用穿过函数

返回值里的引用保留它的来源：返回值派生自哪个参数，调用结束后那个参数就还在借用状态。

```riddle
struct Holder { value: i32 }

fun pick(holder: &Holder) -> &i32 {
    &holder.value
}

fun main() {
    let holder = Holder { value: 7 };
    let borrowed = pick(&holder);
    println!("{}", *borrowed);
}
```

编译器为每个函数计算「参数怎么流到返回值」的摘要，泛型 bound 派发时取所有实现的并集；拿不到具体被调者（`extern` 声明、函数指针、`dyn` 调用）时按最保守的情况处理。

## 通过共享引用写入

`&T` 不允许写入指向的值：

```riddle
struct Sample { n: i32 }

fun bump(sample: &Sample) {
    sample.n = 1; // E0309
}
```

字段可以声明为 `mut`，表示该字段在共享引用下也可写：

```riddle
struct Counter { mut hits: i32 }

impl Counter {
    fun bump(&self) {
        self.hits += 1;
    }
}

fun main() {
    let counter = Counter { hits: 0 };
    counter.bump();
    counter.bump();
    println!("{}", counter.hits); // 2
}
```

可写性是字段自己的属性，与到达它的路径无关：经 `&self`、经普通字段、经另一个 `mut` 字段到达都一样可写。枚举变体字段不能声明 `mut`，写了报 `E0014`，因为变体字段只能通过模式绑定访问。

经共享引用取 `&mut` 到 `mut` 字段只在**那一次调用内部**有效：可以当接收者或实参，不能绑定到名字、不能返回。

```riddle
struct Log { mut items: Vector<&str> }

impl Log {
    fun add(&self, item: &str) {
        self.items.push(item);
    }
}

fun main() {
    let log = Log { items: Vector::new() };
    log.add("first");
    println!("{}", log.items.len());
}
```

把 `&mut` 绑定到名字（`let target = &mut counter.hits;`）报 `E0309`，因为这个借用会活过那次调用。

调用别的函数时，被调方可能写哪些 `mut` 字段由每个函数的摘要决定。从某个 `mut` 字段派生的借用不能跨越可能写它的调用，否则报 `E0300`。`dyn` 调用和函数指针没有摘要，按「可能写该参数的所有 `mut` 字段」保守处理。

## Drop 与引用

借用了实现 `Drop` 的局部值时，引用不能活得比拥有者久，否则报 `E0306`：

```riddle
struct Resource { name: &str }

impl std::ops::Drop for Resource {
    fun drop(&mut self) { println!("drop {}", self.name); }
}

fun name_of(resource: &Resource) -> &str {
    resource.name
}

fun main() {
    let resource = Resource { name: "file" };
    println!("{}", name_of(&resource));
}
```

这个程序是合法的：`resource` 活到函数结束。把 `name_of(&resource)` 的结果存进比 `resource` 活得更久的绑定时才会报错。

## 逃逸与存储位置

逃逸分析判断值会不会在当前栈帧之外继续被使用：会逃逸的提到 GC 堆，不逃逸的留在栈上。所有权和借用规则在两种情况下完全相同。

默认开启 GC（`Clue.toml` 的 `[runtime] gc = true`）。关掉 GC 就没有堆可以提升，引用逃出栈存储报 `E0310`：

```riddle
fun make() -> &i32 {
    let value = 1;
    &value // GC 关闭时报 E0310
}
```

原始指针不受借用检查约束，这是 `unsafe` 之外的绕行方式，代价是编译器不再保证它指向有效存储。
