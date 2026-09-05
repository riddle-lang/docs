# 集合

集合类型持有多个值并支持增删改查。Riddle 目前提供 `Vector`、`HashMap`、`HashSet`、`TreeMap`、`TreeSet` 五种可增长容器和一个可变长字符串，它们的缓冲区都在运行时分配，并随容器一起释放。

字符串切片的只读知识（`str`、`&str`、字面量、raw string）在[数据类型](./type-system.md#字符串)一章；本章集中介绍会增长、会修改的容器。

## String

`String` 是可增长的 UTF-8 字符串，内部使用 `Vector<u8>` 持有字节：

```riddle
let mut text = String::from_str("hello");
text.push_str(" world");

let length = text.len();          // 11usize
let capacity = text.capacity();

text.clear();
let empty = text.is_empty();      // true

text.push_str("hello again");
let view = text.as_str();         // "hello again"
```

`String::new()` 创建空字符串。`as_str()` 返回借用当前缓冲区的 `&str`；借用持续到视图绑定离开作用域，期间借用检查器会拒绝 `push_str`、`clear` 等可变操作——即使视图之后再没有被读取。因此先完成所有修改、再创建视图，或把视图放进内层块，是最省事的顺序。

常用方法：

| 方法 | 作用 |
|------|------|
| `new()` | 创建空字符串 |
| `from_str(value)` | 从 `&str` 复制内容 |
| `as_str()` | 借用缓冲区为 `&str` |
| `len()` / `capacity()` | 字节长度 / 缓冲区容量 |
| `is_empty()` | 是否为空 |
| `push_str(value)` | 追加 `&str` |
| `clear()` | 清空内容 |

`String` 与 `&str` 的取舍和 Rust 类似：`&str` 是只读视图，`String` 是拥有型可增长数据。`len` 返回 UTF-8 字节数而不是字符数；按字符遍历请使用 `&str` 的 `for` 循环（见[数据类型](./type-system.md#字符串)）。

## Vector

`Vector<T>` 是可增长顺序容器，元素类型为 `T`：

```riddle
fun sum() -> i32 {
    let mut values = Vector::new();
    values.push(10);
    values.push(20);

    let first = match values.get(0usize) {
        Some(value) => *value,
        None => 0,
    };

    first + values.pop().unwrap_or(0)
}
```

`vec![]` 宏提供字面量式的构造。元素列表形式逐个 `push`，元素按值移动进向量；`vec![elem; count]` 重复形式要求元素实现 `Clone`，为每个槽位克隆一份；空 `vec![]` 的元素类型从绑定注解或后续用法推断：

```riddle
fun demos() {
    let list = vec![1, 2, 3];
    let zeros = vec![0; 8usize];
    let names = vec![String::from_str("a"), String::from_str("b")];
    let empty: Vector<i32> = vec![];
}
```

常用方法：

| 方法 | 作用 |
|------|------|
| `new()` | 创建空向量 |
| `from_elem(value, count)` | 创建含 `count` 个 `value` 克隆的向量（要求 `T: Clone`），`vec![value; count]` 的底层实现 |
| `len()` / `capacity()` / `is_empty()` | 长度、容量、是否为空 |
| `push(value)` / `pop()` | 末尾追加 / 取出末尾元素 |
| `get(index)` / `get_mut(index)` | 返回 `Option<&T>` / `Option<&mut T>`，越界返回 `None` |
| `swap(a, b)` | 交换两个位置 |
| `clear()` | 清空所有元素 |
| `as_slice()` | 借用全部元素为 `&[T]` |

`values[index]` 下标访问越界时会调用 `panic` 并终止进程；需要可恢复的访问时使用 `get`。按值 `for` 会消耗向量并逐个产出元素（见[闭包与迭代器](./functional.md#迭代协议)）。

## Map 与 Set

集合需要显式导入，不在 prelude 中：

```riddle
use std::collections::{HashMap, HashSet, TreeMap, TreeSet};

fun main() {
    let mut counts: HashMap<i32, i32> = HashMap::new();
    counts.insert(1, 10);

    let mut ordered: TreeSet<i32> = TreeSet::new();
    ordered.insert(3);
    ordered.insert(1);

    println!("count={} ordered={}", counts.len(), ordered.len());
}
```

| 类型 | 键的要求 | 特点 |
|------|---------|------|
| `HashMap<K, V>` | `Hash + Eq` | 开放寻址哈希表，平均 O(1) 访问 |
| `HashSet<T>` | `Hash + Eq` | 只有键的哈希集合 |
| `TreeMap<K, V>` | `Ord` | 红黑树，键有序 |
| `TreeSet<T>` | `Ord` | 只有键的有序集合 |

四个类型都提供 `new`、`insert`、`len` 和 `is_empty`；映射类型另有 `get` / `contains_key`，集合类型另有 `contains`，当前没有 `clear`。键要求决定选择：需要排序时用 `Tree*`，否则优先 `Hash*`。当前类型名就是这四个完整名称，不提供 `Map` / `Set` 别名。

## 数组与切片

定长数组 `[T; N]` 和切片 `[T]` 不是集合——它们不管理运行时分配。数组在编译期确定长度，切片是对已有存储的借用视图，相关规则见[数据类型](./type-system.md#固定长度数组)与[切片与不定长类型](./type-system.md#切片与不定长类型)。
