# Riddle 错误码参考

## 类型检查 (E0001–E0011)

### E0001 — 类型不匹配
赋值、函数参数、返回值的类型与预期不符。
```riddle
let x: i32 = "hello";  // E0001: expected i32, got str
```

### E0002 — 分支类型不兼容
`if` 各分支或 `match` 各 arm 的返回类型不一致。
```riddle
let x = if cond { 1 } else { "hello" };  // E0002: incompatible types: i32 and str
```

### E0003 — 需要数值类型
算术/比较运算符的操作数必须是数值类型。
```riddle
let x = true + 1;  // E0003: left operand must be numeric, got bool
```

### E0004 — 不能调用非函数值
对非函数类型进行了函数调用。
```riddle
let x = 42;
x();  // E0004: cannot call value of type i32
```

### E0005 — 函数参数数量不匹配
调用函数时传入的参数数量与声明不符。
```riddle
add(1);  // E0005: function expects 2 arguments, got 1
```

### E0006 — 未知字段
访问或初始化结构体中不存在的字段。
```riddle
let p = Point { x: 1, z: 2 };  // E0006: unknown field `z` on struct `Point`
```

### E0007 — 缺少字段
结构体字面量缺少必填字段。
```riddle
let p = Point { x: 1 };  // E0007: missing field `y` in struct literal `Point`
```

### E0008 — 不能解引用
对非指针/非引用类型使用了 `*` 解引用运算符。
```riddle
let x = *42;  // E0008: cannot dereference value of type i32
```

### E0009 — 结构体字面量未解析
结构体字面量的路径无法解析到结构体定义。
```riddle
let x = UnknownType { a: 1 };  // E0009: struct literal does not resolve to a struct
```

### E0010 — 模式不匹配
`match` 或 `let` 的模式与值的类型不兼容。
```riddle
let (x, y) = 42;  // E0010: tuple pattern cannot match value of type i32
```

### E0011 — 未知字面量后缀
整数或浮点数字面量的类型后缀无效。
```riddle
let x = 42_i99;  // E0011: unknown integer literal suffix `i99`
```

---

## Trait / Impl 检查 (E0020–E0030)

### E0020 — trait 重复方法
同一个 trait 内定义了同名方法。
```riddle
trait Foo {
    fun bar();
    fun bar();  // E0020: duplicate method `bar`
}
```

### E0021 — trait 方法有函数体
trait 声明中的方法不能有实现体。
```riddle
trait Foo {
    fun bar() { }  // E0021: trait method must not have a body
}
```

### E0022 — trait 重复关联类型
同一个 trait 内定义了同名关联类型。
```riddle
trait Foo {
    type T;
    type T;  // E0022: duplicate associated type `T`
}
```

### E0023 — impl 引用未知 trait
`impl Trait for Type` 中引用的 trait 不存在。
```riddle
impl UnknownTrait for Point { }  // E0023: references unknown trait
```

### E0024 — impl 重复方法
同一个 impl 块内定义了同名方法。
```riddle
impl Point {
    fun bar() { }
    fun bar() { }  // E0024: duplicate method `bar`
}
```

### E0025 — impl 重复关联类型
同一个 impl 块内定义了同名关联类型。
```riddle
impl Point {
    type T = i32;
    type T = i64;  // E0025: duplicate associated type `T`
}
```

### E0026 — impl 缺少方法
impl 块未实现 trait 要求的所有方法。
```riddle
trait Foo { fun bar(); }
impl Foo for Point { }  // E0026: missing method `bar`
```

### E0027 — impl 缺少关联类型
impl 块未提供 trait 要求的所有关联类型。
```riddle
trait Foo { type T; }
impl Foo for Point { }  // E0027: missing associated type `T`
```

### E0028 — impl 方法参数数量不匹配
impl 中方法参数数量与 trait 声明不一致。
```riddle
trait Foo { fun bar(x: i32); }
impl Foo for Point {
    fun bar() { }  // E0028: parameter count mismatch
}
```

### E0029 — impl 方法参数类型不匹配
impl 中方法参数类型与 trait 声明不一致。
```riddle
trait Foo { fun bar(x: i32); }
impl Foo for Point {
    fun bar(x: &str) { }  // E0029: parameter type mismatch
}
```

### E0030 — impl 方法返回类型不匹配
impl 中方法返回类型与 trait 声明不一致。
```riddle
trait Foo { fun bar() -> i32; }
impl Foo for Point {
    fun bar() -> bool { true }  // E0030: return type mismatch
}
```

---

## HIR 降级 (E0040)

### E0040 — 语法降级错误
AST 到 HIR 降级过程中的语法/语义错误，如无效字面量、缺少表达式等。
```riddle
let x = 99999999999999999999;  // E0040: invalid integer literal
let y = ;                       // E0040: missing expression statement
```

---

## 移动检查 (E0100)

### E0100 — 使用了已移动的值
在所有权转移后再次使用该值。
```riddle
let x = Point { x: 1, y: 2 };
let y = x;    // x 的所有权转移到 y
let z = x;    // E0100: use of moved value: `x`
```
