# 泛型

泛型让同一份逻辑适用于多种类型。Riddle 的泛型通过静态单态化编译：每个用到的具体类型组合都会在编译期生成独立的实现，运行时没有类型信息，也不存在动态分派。

本章统一介绍函数、类型和 impl 中的泛型写法；trait bound 的完整规则见[Trait](./traits.md)。

## 泛型函数

函数可以带类型参数：

```riddle
fun id<T>(value: T) -> T {
    value
}

fun main() {
    let n = id(1);       // T 推断为 i32
    let b = id(true);    // T 推断为 bool
}
```

多个类型参数用逗号分隔：

```riddle
fun pair<A, B>(first: A, second: B) -> (A, B) {
    (first, second)
}
```

调用泛型函数或方法时，编译器会联合全部实参与调用位置的期望返回类型推断类型参数，实参的书写顺序不影响推导；也可以在函数名后用 Rust 风格的 `::<...>` 显式指定：

```riddle
fun main() {
    let n = id::<i32>(1);   // 显式指定 T = i32
    let b = id::<bool>(true);
}
```

方法的显式类型实参使用相同语法，例如 `value.convert::<Target>()`。调用泛型类型上的关联函数时，类型实参写在类型路径段上：

```riddle
let values = Vector::<i32>::new();
let converted = Wrapper::<i32>::convert::<bool>();
```

这里第一组参数选择 `impl<T>` 的 `T`，末尾一组参数选择关联函数自己的泛型参数。类型标注中仍然写作 `Vector<T>`，不需要 `::`。

## const 泛型

函数、结构体和 impl 都可以带 const 参数。当前最常见的用法是把数组长度作为编译期参数：

```riddle
fun len<const N: usize>(values: [i32; N]) -> i32 {
    0
}

fun main() {
    let n = len([1, 2, 3]); // N 推断为 3
}
```

const 参数声明自己的整数类型，并可以像类型参数一样实例化：

```riddle
struct Buffer<T, const N: usize> {
    data: [T; N],
}

let buffer: Buffer<i32, 3> = Buffer { data: [1, 2, 3] };
```

## 泛型类型

结构体和枚举都可以带类型参数：

```riddle
struct Box<T> {
    value: T,
}

enum Slot<T> {
    Empty,
    Value(T),
}
```

嵌套泛型不需要在 `>` 之间插入空格：

```riddle
let value: Slot<Pair<i32, bool>> = Slot::Value(Pair {
    first: 1,
    second: true,
});
```

结构体字面量可以用 `::<>` 显式指定类型参数，在无法从上下文推断时很有用：

```riddle
let b = Box::<i32> { value: 1 };
```

## 泛型 impl

固有 impl 可以带类型参数和 const 参数：

```riddle
impl<T> Box<T> {
    fun get(&self) -> T {
        self.value
    }
}

impl<T, const N: usize> ArrayIter<T, N> {
    fun len(&self) -> usize {
        N
    }
}
```

## 约束与单态化

类型参数可以带 trait bound：函数和 trait 与 impl 的泛型位置直接写 `<T: Trait>`，多个 bound 用 `+` 连接，也可以写成 `where` 子句；bound 还可以约束关联类型，例如 `<T: std::ops::Add<Output = T>>`。函数与 trait 和 impl 的类型参数可以直接带 bound，结构体和枚举通过 `where` 子句约束类型参数。完整规则见[Trait](./traits.md)和[impl 块](./impls.md)。

编译器会检查推断或显式给出的实参类型是否满足 bound；函数体内可以通过 bound 调用 trait 方法。C backend 会为用到的泛型函数和方法按类型组合生成单态化函数，并静态分派到具体 impl，不会生成动态分派。
