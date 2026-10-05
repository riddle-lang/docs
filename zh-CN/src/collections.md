# 集合

`Vector`、`String`、`HashMap`、`HashSet`、`TreeMap`、`TreeSet` 的缓冲区在运行时分配，可以增长。定长数组 `[T; N]` 和切片 `[T]` 不管理分配，见[数据类型](./type-system.md)。

## String

`String` 内部是 `Vector<u8>`，内容始终是合法 UTF-8。`String::new()` 创建空串；`String::from_str` 从 `&str` 复制一份；`String::from_utf8` 校验字节序列，非法时返回 `None`。

```riddle
fun main() {
    let mut text = String::new();
    text.push_str("hello");
    text.push_char(' ');
    text.push_str("world");
    println!("{} {}", text.as_str(), text.len());

    let bytes = [228u8, 184u8, 173u8];
    println!("{}", String::from_utf8(&bytes).is_some());
}
```

| 方法 | 说明 |
| --- | --- |
| `String::new() -> String` | 空串 |
| `String::from_str(value: &str) -> String` | 复制一份 |
| `String::from_utf8(bytes: &[u8]) -> Option<String>` | 校验 UTF-8 |
| `as_str(&self) -> &str` | 借用整个缓冲区 |
| `as_bytes(&self) -> &[u8]` | 原始字节 |
| `len(&self) -> usize`、`capacity(&self) -> usize`、`is_empty(&self) -> bool` | 字节数、容量、是否为空 |
| `push_str(&mut self, value: &str)`、`push_char(&mut self, value: char)` | 追加 |
| `clear(&mut self)` | 清空内容，容量保留 |
| `contains(&self, needle: &str) -> bool` | 是否包含子串 |
| `find(&self, needle: &str) -> Option<usize>` | 子串的字节下标 |
| `starts_with(&self, prefix: &str) -> bool`、`ends_with(&self, suffix: &str) -> bool` | 前后缀判断 |
| `trim(&self) -> &str` | 去掉两端的空格、TAB、LF、CR |
| `slice(&self, start: usize, end: usize) -> Option<&str>` | 字节区间，端点不在字符边界上返回 `None` |
| `split(&self, separator: &str) -> Vector<String>` | 切分 |
| `replace(&self, from: &str, to: &str) -> String` | 替换全部匹配 |
| `to_ascii_uppercase(&self) -> String`、`to_ascii_lowercase(&self) -> String` | 只转换 ASCII 字母 |

`String` 还有两个 `unsafe` 构造入口 `from_raw_bytes` 和 `from_utf8_raw`，接收裸指针和长度，不做校验。`&str` 上有同名的只读方法，所以字面量可以直接调用 `"abc".len()`。

`len`、`find`、`slice` 用的都是字节下标，不是字符下标：

```riddle
fun main() {
    let text = String::from_str("中x");
    println!("{} {}", text.len(), text.find("x").unwrap_or(0usize));   // 4 3
    println!("{:?}", text.slice(0usize, 1usize).is_none());            // true

    let csv = String::from_str("a,b,");
    println!("{:?}", csv.split(","));                                  // ["a", "b", ""]

    let word = String::from_str("abc");
    println!("{:?}", word.split(""));                                  // ["a", "b", "c"]
    println!("[{}]", word.replace("", "-"));                           // [abc]
}
```

`split("")` 按字符切开且不产生首尾空串，`replace("", ...)` 直接返回原串，这两点与 Rust 不同。非空分隔符保留尾随空串，所以 `"a,b,".split(",")` 有三段。

`String` 不能相加，也不能直接遍历：

```riddle
fun main() {
    let a = String::from_str("a");
    let b = String::from_str("b");
    let joined = a + b;      // E0003
    for c in joined {        // E0035
        println!("{}", c);
    }
}
```

拼接用 `push_str`、`format!`，或先 `String::from_str` 再追加；按字符遍历写 `for c in text.as_str()`，它产出 `char`。`String` 没有 `chars()`、`lines()`、`truncate`、`insert`、`remove`、`to_string`、`parse`。

`as_str` 借用缓冲区，借用到它的最后一次使用为止，所以修改可以紧跟在最后一次读取之后：

```riddle
fun main() {
    let mut text = String::from_str("hello");
    let view = text.as_str();
    println!("{}", view);
    text.push_str(" world");
    println!("{}", text.as_str());
}
```

把修改插到读取之前则报 `E0300`：

```riddle
fun main() {
    let mut text = String::from_str("hello");
    let view = text.as_str();
    text.push_str(" world");     // E0300
    println!("{}", view);
}
```

`String` 实现了 `Clone`、`PartialEq`、`Eq`、`Hash`、`Display`、`Debug` 和 `From<&str>`，所以它能当 `HashMap` 的键。

## Vector

`Vector<T>` 是可增长的顺序容器，元素按值存放在 GC 堆上的缓冲区里。

```riddle
fun main() {
    let mut values = vec![3, 1, 2];
    values.push(4);
    values.sort();
    let removed = values.remove(1usize);
    println!("{} {:?}", removed, values);      // 2 [1, 3, 4]

    let first = match values.get(0usize) {
        Some(value) => *value,
        None => 0,
    };
    println!("{}", first);                     // 1
}
```

`vec!` 有三种形态：`vec![a, b]` 逐个把元素移动进去，`vec![value; count]` 要求 `T: Clone` 并复制 `count` 份，`vec![]` 的元素类型由标注或后续用法推断。等价的构造器是 `Vector::from_elem(value, count)` 和 `Vector::from_iterator(&mut iterator)`。

| 方法 | 说明 |
| --- | --- |
| `new() -> Vector<T>` | 空向量 |
| `from_elem(value: T, count: usize) -> Vector<T>` | `count` 份 `value` 的克隆，要求 `T: Clone` |
| `from_iterator<I>(iterator: &mut I) -> Vector<T>` | 抽干迭代器，要求 `I: Iterator<Item = T>` |
| `len(&self) -> usize`、`capacity(&self) -> usize`、`is_empty(&self) -> bool` | 长度、容量、是否为空 |
| `push(&mut self, value: T)`、`pop(&mut self) -> Option<T>` | 末尾追加、取出末尾 |
| `get(&self, index: usize) -> Option<&T>`、`get_mut(&mut self, index: usize) -> Option<&mut T>` | 越界返回 `None` |
| `swap(&mut self, left: usize, right: usize)` | 交换两个位置，越界或相等时不做任何事 |
| `insert(&mut self, index: usize, value: T)` | 插入并后移，越界 panic |
| `remove(&mut self, index: usize) -> T` | 移位删除：后面的元素整体前移，越界 panic |
| `contains(&self, value: &T) -> bool` | 要求 `T: PartialEq` |
| `sort(&mut self)` | 稳定排序，要求 `T: PartialOrd` |
| `retain(&mut self, predicate: impl FnMut(&T) -> bool)` | 原地保留谓词为真的元素 |
| `clear(&mut self)` | 长度清零，容量保留 |
| `as_ptr(&self) -> *const T`、`as_slice(&self) -> &[T]` | 裸指针视图、切片视图 |
| `iter(&self) -> SliceIter<T>`、`iter_mut(&mut self) -> SliceIterMut<T>` | 借用迭代器 |

`remove` 是移位删除，顺序不变，代价是 O(n)。`Vector` 没有 `swap_remove`，也没有 `sort_by`、`binary_search`、`truncate`、`resize`、`drain`、`extend`、`first`、`last`：

```riddle
fun main() {
    let v = vec![1, 2, 3];
    let copy = v.clone();              // E0013
    let value = v.swap_remove(0usize); // E0013
    println!("{} {}", copy.len(), value);
}
```

`Vector` 也不实现 `Clone`；复制只能新建一个向量再逐个 `push`。

下标 `values[index]` 越界时直接 panic（消息 `Vector index out of bounds`，进程退出码 3），需要可恢复的访问就用 `get`。`Index` 和 `IndexMut` 在标准库里只有 `Vector` 的实现。

三种遍历方式产出的元素不同：按值 `for value in values` 消耗向量并产出 `T`，`for value in &values` 产出 `&T`，`for value in &mut values` 产出 `&mut T`。按值遍历之后原向量不能再使用（`E0100`）。

```riddle
fun main() {
    let mut values = vec![1, 2, 3];
    for value in &mut values {
        *value *= 2;
    }
    let total = values.iter().fold(0, [acc, value: &i32 -> acc + *value]);
    println!("{:?} {}", values, total);
}
```

## HashMap 与 HashSet

两个哈希容器的键要求 `Hash + Eq`。实现 `Hash` 的类型有 `bool`、`char`、全部整数、`f32`/`f64`（按位模式）、`String`、`&str`、2 到 6 元组，加上派生出来的结构体和枚举。`&str` 与 `String` 用同一套 FNV-1a 折叠，所以 `"alpha"` 和 `String::from("alpha")` 的哈希相同。`str` 本身不是值类型，`&str` 才是可以放进 `HashMap` 的那个键；浮点实现了 `Hash` 却没有实现 `Eq`，所以 `f64` 键仍然报 `E0035`：

```riddle
use std::collections::HashMap;

fun main() {
    let mut by_name: HashMap<&str, i32> = HashMap::new();
    by_name.insert("a", 1);              // ok
    let mut by_score: HashMap<f64, i32> = HashMap::new();
    by_score.insert(1.5, 2);             // E0035
    println!("{} {}", by_name.len(), by_score.len());
}
```

键也可以用 `String`，或给结构体派生 `Hash`、`PartialEq`、`Eq`。

| `HashMap` 方法 | 说明 |
| --- | --- |
| `new() -> HashMap<K, V>` | 空表 |
| `len(&self) -> usize`、`is_empty(&self) -> bool` | 元素个数 |
| `insert(&mut self, key: K, value: V)` | 键已存在时覆盖值，返回 `()` |
| `get(&self, key: &K) -> Option<&V>`、`get_mut(&mut self, key: &K) -> Option<&mut V>` | 按键查找 |
| `remove(&mut self, key: &K) -> Option<V>` | 删除并返回旧值 |
| `contains_key(&self, key: &K) -> bool` | 是否存在 |
| `get_or_insert(&mut self, key: K, default: V) -> &mut V` | 不存在时插入 `default`，返回值的可变引用 |
| `entry(&mut self, key: K) -> Entry<K, V>` | 进入条目 API |
| `iter(&self) -> HashMapIter<K, V>` | 产出 `(&K, &V)` |
| `keys(&self) -> HashMapKeys<K, V>`、`values(&self) -> HashMapValues<K, V>` | 产出 `&K` / `&V` |

`entry` 返回枚举 `Entry<K, V>`，两个变体是 `Occupied { value: &mut V }` 和 `Vacant { key: K, map: &mut HashMap<K, V> }`，可以直接 `match`。更常用的是三个收尾方法：`or_insert(default) -> &mut V`、`or_insert_with(impl FnOnce() -> V) -> &mut V`、`or_default() -> &mut V`（要求 `V: Default`）：

```riddle
use std::collections::HashMap;

fun main() {
    let mut counts: HashMap<String, i32> = HashMap::new();
    let a = counts.entry(String::from_str("a")).or_insert(0);
    *a += 1;
    let b = counts.entry(String::from_str("b")).or_insert_with([ -> 7]);
    *b += 1;
    println!("{} {}", *counts.get(&String::from_str("a")).unwrap(), *counts.get(&String::from_str("b")).unwrap());
}
```

`entry(...).or_insert(...)` 的返回值要绑定到变量，或把整条语句放进内层块。直接把它当语句丢弃时，`HashMap` 的可变借用会保持到当前块结束，紧接着的 `insert` 或下一次 `entry` 报 `E0302`：

```riddle
use std::collections::HashMap;

fun main() {
    let mut counts: HashMap<i32, i32> = HashMap::new();
    counts.entry(1).or_insert(0);
    counts.insert(2, 0);            // E0302
    println!("{}", counts.len());
}
```

遍历 `&HashMap` 得到的是插入顺序，直到发生第一次删除。删除在内部的平行 `keys`/`values` 上做 swap-remove——最后一个条目被换进空槽——所以被移动的键会出现在被删键的位置：插入 1、2、3 之后再 `remove(&1)`，遍历顺序是 3、2。顺序是实现细节，不要写进程序逻辑。

```riddle
use std::collections::HashMap;

fun main() {
    let mut m: HashMap<i32, i32> = HashMap::new();
    m.insert(1, 10);
    m.insert(2, 20);
    m.insert(3, 30);
    m.remove(&1);
    for (key, value) in &m {
        println!("{} {}", *key, *value);     // 3 30，然后 2 20
    }
}
```

三个视图类型只实现 `Iterator`，没有 `IntoIterator`，所以 `for` 循环里要写 `&m`，而视图本身仍能用 `count()` 这类迭代器方法：

```riddle
use std::collections::HashMap;

fun main() {
    let mut m: HashMap<i32, i32> = HashMap::new();
    m.insert(1, 10);
    for (key, value) in m.iter() {      // E0035
        println!("{} {}", *key, *value);
    }
}
```

遍历产出的是引用，`println!("{}", key)` 里 `key: &i32` 既不实现 `Display` 也不实现 `Debug`，先写 `*key` 解引用。

| `HashSet` 方法 | 说明 |
| --- | --- |
| `new() -> HashSet<T>` | 空集合 |
| `len(&self) -> usize`、`is_empty(&self) -> bool` | 元素个数 |
| `insert(&mut self, value: T)` | 已存在时不做任何事，返回 `()` |
| `contains(&self, value: &T) -> bool` | 是否存在 |
| `remove(&mut self, value: &T) -> bool` | 删除，返回是否删掉了元素 |
| `iter(&self) -> HashSetIter<T>` | 产出 `&T` |

`HashSetIter` 和 `&HashSet` 都实现了 `IntoIterator`，`for value in seen.iter()` 与 `for value in &seen` 都能用；按值 `for value in seen` 报 `E0035`。顺序规则与 `HashMap` 相同。

```riddle
use std::collections::HashSet;

fun main() {
    let mut seen: HashSet<i32> = HashSet::new();
    seen.insert(3);
    seen.insert(1);
    seen.insert(3);
    for value in seen.iter() {
        println!("{}", *value);
    }
    println!("{} {}", seen.len(), seen.remove(&3));
}
```

两个类型都没有 `clear`、`with_capacity`、`retain`；`HashSet` 也没有 `union`、`is_subset`，`HashMap` 没有 `iter_mut`、`values_mut`，也没有按值的 `IntoIterator`。

## TreeMap 与 TreeSet

有序容器的键要求 `Ord`，内部是红黑树，遍历按升序。

| `TreeMap` 方法 | 说明 |
| --- | --- |
| `new() -> TreeMap<K, V>` | 空表 |
| `len(&self) -> usize`、`is_empty(&self) -> bool` | 元素个数 |
| `insert(&mut self, key: K, value: V)` | 键已存在时覆盖值，返回 `()` |
| `get(&self, key: &K) -> Option<&V>`、`contains_key(&self, key: &K) -> bool` | 按键查找 |
| `remove(&mut self, key: &K) -> Option<V>` | 删除并返回旧值 |
| `iter(&self) -> TreeMapIter<K, V>` | 中序遍历，产出 `(&K, &V)` |
| `keys(&self) -> TreeMapKeys<K, V>`、`values(&self) -> TreeMapValues<K, V>` | 产出 `&K` / `&V` |
| `range(&self, start: &K, end: &K) -> TreeMapRangeIter<K, V>` | 左闭右开区间，产出 `(&K, &V)` |

`range` 的参数是引用，区间包含 `start`、不包含 `end`：

```riddle
use std::collections::TreeMap;

fun main() {
    let mut scores: TreeMap<i32, i32> = TreeMap::new();
    scores.insert(30, 3);
    scores.insert(10, 1);
    scores.insert(20, 2);
    scores.insert(40, 4);
    for (key, value) in &scores {
        println!("{} {}", *key, *value);          // 10 1、20 2、30 3、40 4
    }
    for (key, _) in scores.range(&20, &40) {
        println!("range {}", *key);               // 20、30
    }
    println!("{}", scores.range(&35, &40).count());   // 0
}
```

`keys`、`values`、`range` 三个视图都有 `IntoIterator`，而 `iter()` 返回的 `TreeMapIter` 没有，所以 `for (k, v) in scores.iter()` 报 `E0035`，写 `for (k, v) in &scores`。`TreeMap` 没有 `get_mut`（`E0013`）、没有 `entry`、没有 `clear`，也没有按值的 `IntoIterator`。

`TreeSet<T>` 是 `TreeMap<T, ()>` 的包装，提供 `new`、`len`、`is_empty`、`insert`（返回 `()`）、`contains`、`remove`（返回 `bool`）和 `iter`（产出 `&T`）。`TreeSetIter` 与 `&TreeSet` 实现 `IntoIterator`：

```riddle
use std::collections::TreeSet;

fun main() {
    let mut ids: TreeSet<i32> = TreeSet::new();
    ids.insert(30);
    ids.insert(10);
    ids.insert(20);
    ids.insert(10);
    for id in &ids {
        println!("{}", *id);          // 10、20、30
    }
    println!("{} {}", ids.len(), ids.remove(&10));
}
```

`TreeSet` 没有 `range`，即使内部的 `TreeMap` 有。

## 数组与切片

`[T; N]`、`&[T; N]`、`&mut [T; N]`、`&[T]`、`&mut [T]` 都实现了 `IntoIterator`，按值或按引用产出元素。`SliceIter` 和 `SliceIterMut` 自己不实现 `IntoIterator`，所以 `for value in values.iter()` 报 `E0035`：

```riddle
fun main() {
    let values = vec![1, 2, 3];
    let mut total = 0;
    for value in values.iter() {      // E0035
        total += *value;
    }
    println!("{}", total);
}
```

正确写法是 `for value in &values` 或 `for value in values.as_slice()`。切片类型的方法只有 `len`、`is_empty`、`get`、`get_mut`、`as_ptr`、`as_mut_ptr`、`iter`、`iter_mut`；`first`、`last`、`split_at`、`chunks`、`windows`、`sort` 都不存在。数组本身只有 `Debug` 和迭代器实现。两者的类型规则见[数据类型](./type-system.md)。
