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

## 创建结构体值

可以使用结构体字面量创建值：

```riddle
fun main() {
    let foo = Foo { x: 1, y: 1 };
    print(foo.x)
}
```

字段访问使用点号：

```riddle
foo.x
foo.y
```

## 结构体值会被移动

结构体也是普通值，因此遵循移动语义：

```riddle
fun take(foo: Foo) {
    print(foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    take(foo);
    print(foo); // error: foo 已经被移动
}
```

如果你只是想临时使用它，可以传引用：

```riddle
fun inspect(foo: &Foo) {
    print(foo.x)
}

fun main() {
    let foo = Foo { x: 1, y: 1 };
    inspect(&foo);
    print(foo)
}
```

只要引用没有逃逸当前作用域，`foo` 仍然可以保持栈分配。

## 小结

- `struct` 定义命名数据类型；
- 结构体字段有名字和类型；
- 结构体字面量用于创建值；
- 点号用于字段访问；
- 结构体值默认移动；
- 临时访问可以使用引用。
