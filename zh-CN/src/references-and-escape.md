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

这些规则按重叠内存位置计算，而不是统计函数里声明了多少个引用。不同结构体字段可以分别拥有可变借用；整个值、同一字段以及无法证明不同的动态索引则视为重叠。

`&T` 是可复制的共享访问权，复制后两个引用都可以继续读取。`&mut T` 不是 `Copy`：普通赋值会移动独占访问权，原引用不能再使用。把 `&mut T` 传给期望引用的函数时，编译器会创建只覆盖调用的短期重借用，因此同一个可变引用可以重复传递。

```riddle
let mut value = 1;
let reference = &mut value;
update(reference);
update(reference);
```

共享重借用会暂时冻结父可变引用的写权限；子借用最后一次使用后，父引用恢复可用。

## 解引用 `*expr`

前缀 `*` 是解引用运算符。它把引用或原始指针指向的存储位置重新作为一个位置表达式使用：

```riddle
let value = 1;
let shared: &i32 = &value;
let read = *shared;

let mut other = 2;
let mutable: &mut i32 = &mut other;
*mutable = 3;
```

`*shared` 的类型是 `i32`，但它不是一个新的引用，也不会自动生成别名。它在不同上下文中的含义不同：

- `let read = *shared` 是按值读取；如果 `T: Copy`，读取一个副本；如果安全引用指向的 `T` 不是 `Copy`，不能从借用内容中搬出值，会报 `E0308`；
- `*mutable = value` 是通过可变引用写入原位置，不是把引用改成一个值；
- `&*mutable` 和 `&mut *mutable` 分别创建共享重借用和可变重借用；
- 结构体字段和索引访问会自动进行同样的解引用，例如 `mutable.field` 访问的是 `(*mutable).field` 所在的存储位置。

原始指针的 `*ptr` 还必须位于 `unsafe` 上下文中，并且不参与普通引用的借用来源跟踪。要访问原值，应直接绑定引用，例如 `let mut point = f(&mut p); point.x = 1;`。绑定另一个变量会移动 `&mut T` 的独占访问权，原引用不能继续使用；它不会创建第二个可变引用。要从安全引用按值取得一个 `Point`，当前需要让 `Point` 实现 `Copy`。

当前 E0308 覆盖显式 `*reference` 在按值绑定、传参、返回和聚合构造中的消费，以它为根的字段、索引位置，以及自动字段或索引解引用（例如 `reference.field`、`reference[0]`）的非 `Copy` 搬出。移动式模式绑定从引用搬出的检查仍待补齐；完整收紧前需要先为拥有型数组迭代提供类似 `ManuallyDrop`/`ptr::read` 的内部原语。

## 方法返回值的引用来源

方法返回的引用会保留 receiver 的来源关系，即使引用被包装进泛型容器，再通过另一个方法取出：

```riddle
let mut values = Vector::new();
values.push(1);
let mut fallback = 0;
let reference = values.get_mut(0).unwrap_or(&mut fallback);
values.push(2); // E0302: reference 仍借用了 values
*reference = 3;
```

编译器会让引用来源穿过结构体、枚举、数组、分支、模式绑定和可解析的函数调用。元组和数组构造会按元素保留来源，解构后每个绑定只继承对应元素；如果调用或控制流使聚合形状无法恢复，则退回整体合并的保守规则。无法解析的外部函数或函数值采用保守规则：返回值可能来自所有携带引用的输入。借用通常在引用最后一次使用后结束，而不是机械地持续到整个代码块末尾。

逃逸到堆上只会改变存储位置，不会放宽移动或借用规则；共享借用、可变借用和移动冲突仍按相同方式检查。

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

结构体、元组和数组会保留字段级引用来源。模式绑定只引用某个字段时，MIR 可以只为该绑定建立稳定存储；整个聚合值、动态索引或解引用无法静态区分位置时，才会提升更大的存储槽。

匿名函数按共享或可变引用捕获局部变量时，该局部需要稳定地址。逃逸分析会继续跟踪闭包值：只在当前函数内调用的闭包，其环境和捕获存储都留在栈上；闭包被返回、存入逃逸聚合值或传给可能保存它的函数时，环境及必要的捕获来源才提升到 GC 堆。按值捕获会把值直接放入闭包环境。

## 函数调用中的逃逸

把引用传给未知函数或外部函数时，编译器会保守地认为该引用可能逃逸：

```riddle
unsafe extern "C" {
    fun store(value: &Foo);
}

fun caller() {
    let foo = Foo { x: 1, y: 2 };
    unsafe { store(&foo); } // 保守处理：foo 可能逃逸
}
```

对当前编译单元内能解析到的函数，逃逸分析会做参数摘要的不动点计算，并区分两种结果：参数被保存到未知位置，以及参数的引用来源只流入返回值。前者会立即触发调用方的堆提升；后者会附着到调用表达式，由调用者是否继续返回或保存该结果决定。本地闭包返回捕获引用时也会保留这条来源关系。仅在调用者内部读取返回引用时，来源仍可留在栈上。

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
| 未逃逸且不需要稳定地址的局部 | SSA 值，不生成分配指令 |
| 未逃逸但可变或被闭包按引用捕获的局部 | `Alloca`，栈上存储 |
| 逃逸局部 | `HeapAlloc`，GC 堆存储 |
| 未逃逸 / 逃逸的闭包环境 | `Alloca` / `HeapAlloc` |

C backend 会把 `HeapAlloc` 降为运行时 ABI 的 `rgc_alloc`。`clue build` 默认链接内置 GC，也可以按 `Clue.toml` 的 `[runtime].source` 链接自定义 GC 或分配器；直接编译 `riddlec` 生成的 C 时需要同时提供一个运行时实现。

二进制包设置 `[runtime] gc = false` 后，C backend 不再生成 `rgc_*` 调用，运行时也不包含收集器或根扫描。拥有所有权的堆值改由 `riddle_alloc` / `riddle_free` 管理；原本只能依靠 GC 延长栈对象寿命的引用逃逸会被 E0310 拒绝，输入引用的直接转发不受影响。
