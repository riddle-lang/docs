# 你好，Riddle

这一章创建一个真实项目，写入一段完整代码，然后让 Clue 检查并运行它。

## 创建项目

在终端执行：

```bash
clue new hello
cd hello
```

Clue 会创建：

```text
hello/
  Clue.toml
  src/
    main.rid
```

`Clue.toml` 描述包和构建目标，`src/main.rid` 是默认二进制入口。

## 写入第一个程序

把 `src/main.rid` 改成：

```riddle
struct Point {
    x: i32,
    y: i32,
}

fun distance_squared(point: Point) -> i32 {
    point.x * point.x + point.y * point.y
}

fun main() {
    let point = Point { x: 3, y: 4 };
    let value = distance_squared(point);
    println!("distance squared = {}", value);
}
```

先检查项目：

```bash
clue check
```

检查通过后构建并运行：

```bash
clue run
```

程序输出的最后一行应为：

```text
distance squared = 25
```

## 这段代码包含什么

`struct Point` 定义一种数据形状，两个字段都是 `i32`。`Point { x: 3, y: 4 }` 构造一个值。

函数使用 `fun` 声明。参数类型写在名称后，返回类型写在 `->` 后。`distance_squared` 的最后一个表达式没有分号，因此它成为函数返回值。

`let` 创建默认不可变的绑定。`println!` 使用 `{}` 按 `Display` 格式输出值。

把 `point` 传给 `distance_squared` 会移动这个结构体，调用后原绑定不再可用。这里恰好不再需要它；完整规则会在[移动语义](./move-semantics.md)解释。

## 检查与运行的区别

`clue check` 执行解析、名字解析、类型检查以及移动、借用和逃逸分析，但不调用系统 C 编译器。`clue run` 会先完成构建，再运行生成的本机可执行文件。

项目清单、本地依赖、缓存和输出路径稍后统一放在[创建与构建项目](./clue-create.md)说明。现在先进入[Riddle 基础](./basics.md)。
