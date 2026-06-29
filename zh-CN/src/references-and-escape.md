# 引用与逃逸

引用让你在不移动值的情况下访问它。Riddle 会用逃逸分析决定局部值留在栈上，还是因为引用可能活得更久而提升到 GC 堆。

## 临时引用

临时引用最常见的用途是把值借给函数使用：

```riddle
struct Foo {
    x: i32,
    y: i32,
}

fun read(foo: &Foo) -> i32 {
    foo.x
}

fun main() -> i32 {
    let foo = Foo { x: 1, y: 2 };
    let x = read(&foo);
    foo.y + x
}
```

`&foo` 只是临时借用。只要引用没有逃出当前需要的范围，`foo` 可以继续按普通局部值处理。

## 共享引用和可变引用

`&T` 是共享引用，`&mut T` 是可变引用：

```riddle
let value = 1;
let r: &i32 = &value;

let mut other = 2;
let m: &mut i32 = &mut other;
```

当前 move checker 会检查这些基本冲突：

- 已有共享借用时不能再创建可变借用；
- 已有可变借用时不能再创建共享借用；
- 不能同时创建两个可变借用；
- 借用期间不能移动或赋值同一位置。

逃逸到堆上的局部值会跳过这些栈局部借用冲突检查，因为它已经按堆对象访问。

## 触发逃逸

当局部变量的引用作为函数结果返回时，变量会逃逸：

```riddle
fun make_ref() -> &Foo {
    let foo = Foo { x: 1, y: 2 };
    &foo
}
```

`foo` 不能只存在于 `make_ref` 的栈帧里，因此 MIR 降级会为它生成 GC 堆分配。

包含引用的结构体或数组如果逃逸，里面引用到的局部值也会一起被标记：

```riddle
struct Pair {
    value: &Foo,
}

fun build() -> Pair {
    let foo = Foo { x: 1, y: 2 };
    Pair { value: &foo }
}
```

字段访问和数组索引也会传播引用来源：

```riddle
fun pick() -> &Foo {
    let items = [
        Foo { x: 1, y: 2 },
        Foo { x: 3, y: 4 },
    ];
    &items[0]
}
```

当前分析粒度是整个局部变量，不做字段级拆分。

## 函数调用中的逃逸

把引用传给未知函数或外部函数时，编译器会保守地认为该引用可能逃逸：

```riddle
extern "C" {
    fun store(value: &Foo);
}

fun caller() {
    let foo = Foo { x: 1, y: 2 };
    store(&foo); // 保守处理：foo 可能逃逸
}
```

对当前编译单元内能解析到的函数，逃逸分析会做一个参数摘要的不动点计算：如果被调函数没有让对应参数逃逸，调用方传入的引用可以不触发堆提升。

```riddle
fun read(foo: &Foo) -> i32 {
    foo.x
}

fun caller() -> i32 {
    let foo = Foo { x: 1, y: 2 };
    read(&foo) // read 不保存也不返回这个引用
}
```

## 分支、循环和 match

逃逸会从 `if`、`while` 和 `match` 的子表达式向外传播。只要某条路径产生了逃逸引用，对应局部就会被标记：

```riddle
fun maybe(flag: bool) -> &Foo {
    let a = Foo { x: 1, y: 2 };
    let b = Foo { x: 3, y: 4 };

    if flag {
        &a
    } else {
        &b
    }
}
```

## 分配结果

逃逸分析结果进入 MIR 降级：

| 结果 | MIR 分配 |
|------|----------|
| 未逃逸局部 | `Alloca`，栈上存储 |
| 逃逸局部 | `HeapAlloc`，GC 堆存储 |

C backend 会把 `HeapAlloc` 降为 `GC_MALLOC`，因此使用 C backend 运行这类程序时需要链接 Boehm GC。

## 小结

- `&T` 和 `&mut T` 用于不移动值的访问；
- move checker 会检查基本借用冲突；
- 返回引用、逃逸聚合、未知函数调用会让局部值提升到堆；
- 本地函数调用会通过参数摘要减少不必要的堆提升；
- 当前逃逸粒度是整个局部变量。
