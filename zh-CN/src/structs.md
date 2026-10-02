# 结构体

结构体用于把相关数据组合成一个命名类型。
当多个值总是一起出现时，把它们放进结构体通常会让代码更清晰。

## 定义结构体

使用 `struct` 定义结构体：

```riddle
struct Foo {
    x: i32,
    y: i32,
}
```

`Foo` 有两个字段：`x` 和 `y`。字段名后面写类型。

字段默认私有。需要让声明模块之外的代码构造、读取或解构字段时，在字段前添加 `pub`：

```riddle
pub struct Point {
    pub x: i32,
    pub y: i32,
}
```

私有字段仍可在声明模块及其子模块中使用，通常通过公开的构造函数和方法对外提供受控访问。

## 创建结构体值

可以使用结构体字面量创建值：

```riddle
fun main() {
    let foo = Foo { x: 1, y: 1 };
    print!("{}", foo.x)
}
```

字段访问使用点号：

```riddle
foo.x
foo.y
```

当局部变量名和字段名相同时，可以使用字段简写：

```riddle
fun make_foo(x: i32, y: i32) -> Foo {
    Foo { x, y }
}
```

结构体字面量会检查字段是否可见、是否存在、是否缺失以及字段类型是否匹配。

## 泛型结构体

结构体可以带类型参数和 const 参数，规则见[泛型](./generics.md)一章。

## 关联函数

可以在 `impl` 块中给结构体定义关联函数，并通过 `Type::function(...)` 调用：

```riddle
impl Foo {
    fun new(x: i32, y: i32) -> Foo {
        Foo { x, y }
    }
}

fun main() {
    let foo = Foo::new(1, 2);
}
```

## 结构体值会被移动

结构体也是普通值，因此遵循移动语义：

```riddle
fun take(foo: Foo) {
    print!("{}", foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    take(foo);
    print!("{}", foo); // error: foo 已经被移动
}
```

如果你只是想临时使用它，可以传引用：

```riddle
fun inspect(foo: &Foo) {
    print!("{}", foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    inspect(&foo);
    print!("{}", foo)
}
```

只要引用没有逃逸当前作用域，`foo` 仍然可以保持栈分配。

## mut 字段

默认情况下，`&T` 不允许写入它指向的值：在 `&self` 方法里给字段赋值、或对字段调用需要 `&mut self` 的方法，都会报 `E0309`。

如果一个字段需要在共享引用下也能改，就在声明处加 `mut`：

```riddle
struct Counter {
    mut hits: i32,
    name: i32,
}

impl Counter {
    fun bump(&self) {
        self.hits += 1;   // 可以：hits 声明为 mut
    }

    fun rename(&self) {
        self.name = 1;    // error[E0309]：name 没有声明 mut
    }
}
```

可写性是**字段自身**的属性，与到达它的路径无关：`self.a.b` 中只要 `a` 或 `b` 有一处声明为 `mut`，整条路径就可写。

`mut` 字段上可以取 `&mut`，但只限于**它所在的那次调用**：

```riddle
fun add_to(target: &mut i32) {
    *target += 1;
}

impl Counter {
    fun via_argument(&self) {
        add_to(&mut self.hits);   // 可以：作为实参
    }

    fun via_binding(&self) {
        let target = &mut self.hits;   // error[E0309]：不能绑出来
    }
}
```

`self.log.push(item)` 这种对字段调用 `&mut self` 方法的形式同样可以——接收者借用和实参借用一样，只在调用期间存在。把 `&mut` 绑出来或返回则不行：它的生命周期会超出这次调用，可能出现两个同时存在的 `&mut`。

反过来，调用 `&self` 方法时会检查它可能写入的那些 `mut` 字段。如果此时还持有指向字段**内部**的借用，调用会被拒绝：

```riddle
struct Inner { value: i32 }
struct Holder { mut inner: Inner }

impl Holder {
    fun bump(&self) {
        self.inner.value += 1;
    }
}

fun f() {
    let holder = Holder { inner: Inner { value: 0 } };
    let held = &holder.inner.value;
    holder.bump();          // error[E0300]：写入可能搬动 held 指向的存储
    let _ = *held;
}
```

借整个值或借字段本身都没有问题，而且能看到更新后的结果：

```riddle
let counter = Counter { hits: 0, name: 0 };
let view = &counter;
counter.bump();             // 可以
print!("{}", view.hits);    // 输出更新后的值
```

`mut` 字段是类型公开契约的一部分：给字段加 `mut` 是破坏性变更，调用方原本可以假设它不会在共享引用下改变。多个别名对同一 `mut` 字段的写入是"最后写入生效"，不提供顺序或原子性保证。

