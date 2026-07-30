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
    print(&foo.x)
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

结构体可以带类型参数：

```riddle
struct Box<T> {
    value: T,
}

fun main() -> i32 {
    let b: Box<i32> = Box { value: 1 };
    b.value
}
```

类型参数可以嵌套使用，`>` 之间不需要空格：

```riddle
let b: Box<Box<i32>> = Box { value: Box { value: 1 } };
```

也可以在结构体字面量中用 `::<>` 显式指定类型参数，这在无法从上下文推断时很有用：

```riddle
let b = Box::<i32> { value: 1 };
```

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
    print(&foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    take(foo);
    print(&foo); // error: foo 已经被移动
}
```

如果你只是想临时使用它，可以传引用：

```riddle
fun inspect(foo: &Foo) {
    print(&foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    inspect(&foo);
    print(&foo)
}
```

只要引用没有逃逸当前作用域，`foo` 仍然可以保持栈分配。
