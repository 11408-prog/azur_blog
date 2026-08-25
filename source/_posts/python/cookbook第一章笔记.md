---
title: cookbook第一章笔记
date: 2026-08-19 12:18:47
tags: [数据结构,python,字典,堆 ]
categories: 学习
---

    数据结构与算法，讲述一些对于序列和字典的操作。主要借助collections来实现。

## 名词解释

### 可迭代对象
定义：可以一次一个地返回元素。在python中，能够放在for循环右侧的基本都是可迭代对象

代表：生成器，文件对象，集合，字典（遍历的是键）

### 序列
定义：有索引的可迭代对象

代表：列表，元组，字符串，范围（range）

### collections
定义：python的标准库之一，提供了多种数据类型，如 defaultdict、deque、OrderedDict、Counter等

### 可哈希（hashable）
定义：如果一个对象有固定的哈希值，并且在其生命周期内这个号码绝对不会变，同时它能和其它正常对象比较是否相等，那就是可哈希的。

### os (operating system)
它为我们提供了一种跨平台的方式，让我们编写的 Python 程序能够与底层的操作系统进行交互，比如操作文件、目录、环境变量和进程等

## 1.1 将序列分解为单独的变量

任何序列都可以通过赋值操作分解为与序列元素数相等的变量。

```python

a = [1,2,3]

b,c,d = a

print(f"{b}\n{c}\n{d}")

```

## 1.2 解压可迭代对象赋值给多个变量

通过在变量名称前加*可以起到类似于切片的效果。星号解压语法也可以用来分割长度不确定的序列。

```python

information = ["enterprise","10-03","girl","uss"]

name,*value = information

print(f"{name}\n{value}\n")

*key,country = information

print(f"{key}\n{country}\n")
```

## 1.3 保留最后N个元素

正常情况下采用切片即可，但是对于动态流式的数据采用collections.deque更好。核心思想是定义一个数组，元素先进先出。

```python
from collections import deque

answer = deque(maxlen=10)

for i in "yorktown":
    answer.append(i)

for i in "enterprise":
    answer.append(i)

print(answer)
```

## 1.4 查找最大或最小的N个元素

colllecions.heapq的nlargest()和nsmallest()可以完美解决这个问题。分别用于查找最大和最小元素。

```python
import heapq

a = "enterprise"

print(heapq.nlargest(4,a))
```

## 1.5 实现优先级队列

借助heapq来实现。特点为列表中索引为0的元素永远最小。当数据规模是动态的时候吗，使用堆来满足获取极值的要求具有绝对的优势。

```python
import heapq

# 创建一个列表作为堆
pq = []

# 插入元素（元组格式：优先级, 数据）
heapq.heappush(pq, [2, 'enterprise'])
heapq.heappush(pq, [1, 'yorktown'])  
heapq.heappush(pq, [3, 'hornet'])

# 弹出优先级最高的元素（数字最小的）
print(heapq.heappop(pq))  
print(heapq.heappop(pq))  
print(heapq.heappop(pq))

#弹出之后的元素消失
print(pq)
```

## 1.6 字典映射多个值

可以将value用序列来表示，也可以借助collections.default,本质是一样的。

```python
from collections import defaultdict

ship = defaultdict(set) #容器类型需要声明

ship["yorktown"].add("yorktown")
ship["yorktown"].add("enterprise")
ship["yorktown"].add("hornet")

ship["lexington"].add("lexington")
ship["lexington"].add("saratoga")

print(ship)
```

## 1.7 字典排序

使用collections.QrderedDict可以在迭代操作中保持元素被插入时的顺序。（注：不是按大小重新排序）

```python
from collections import OrderedDict

ship = OrderedDict()

ship['yorktown'] = 5
ship['enterprise'] = 6
ship['hornet'] = 7
ship['saratoga'] = 3

print(ship)
```

## 1.8 字典的运算

对于求字典的最值和排序，需要先借助zip()函数将键和值反转过来。否则会作用于键而不是值。

```python
from collections import OrderedDict

ship = OrderedDict()

ship['yorktown'] = 5
ship['enterprise'] = 6
ship['hornet'] = 7
ship['saratoga'] = 3

answer = max(zip(ship.values(),ship.keys()))
print(answer)

sorted(zip(ship.values(),ship.keys()))
```

## 1.9 查找两字典的相同点

查找字典相同点的方法很多，但是无法直接查找相同的值，因为值不一定满足一一映射。

```python
print(a.keys() & b.keys()) #找相同的键，如果想用相同方法找相同的值需要先用zip翻转
print(a.items() & b.items()) #找键和值都相同的组合
print(a.keys()-b.keys()) #找两个字典键的差集

c = {key:a[key] for key in a.keys() - {'z', 'w'}} #构建排除指定键的字典
```

## 1.10 删除序列相同元素并保持顺序

定义一个集合，将序列的元素按顺序逐一放入

```python
def dedupe(items, key=None):
    seen = set()
    for item in items:
        val = item if key is None else key(item)
        if val not in seen:
            yield item
            seen.add(val)
```

## 1.11 命名切片

变量可以用切片来赋值

```python
record = '....................100 .......513.25 ..........'

SHARES = slice(20, 23)
PRICE = slice(31, 37)

cost = int(record[SHARES]) * float(record[PRICE])
```

## 1.12 序列中出现次数最多的元素

可以用collections.Counter解决

```python
words = [
    'look', 'into', 'my', 'eyes', 'look', 'into', 'my', 'eyes',
    'the', 'eyes', 'the', 'eyes', 'the', 'eyes', 'not', 'around', 'the',
    'eyes', "don't", 'look', 'around', 'the', 'eyes', 'look', 'into',
    'my', 'eyes', "you're", 'under'
]
from collections import Counter
word_counts = Counter(words)
# 出现频率最高的3个单词
top_three = word_counts.most_common(3)
print(top_three)
```

## 1.13 通过某个关键字排序一个字典列表

使用operator模块的itemgetter函数实现

```python
rows = [
    {'fname': 'Brian', 'lname': 'Jones', 'uid': 1003},
    {'fname': 'David', 'lname': 'Beazley', 'uid': 1002},
    {'fname': 'John', 'lname': 'Cleese', 'uid': 1001},
    {'fname': 'Big', 'lname': 'Jones', 'uid': 1004}
]

from operator import itemgetter

rows_by_fname = sorted(rows, key=itemgetter('fname'))
rows_by_uid = sorted(rows, key=itemgetter('uid'))
rows_by_lfname = sorted(rows, key=itemgetter('lname','fname')) # itemgetter支持多个keys

print(rows_by_fname , end='\n\n')
print(rows_by_uid , end='\n\n')
print(rows_by_lfname )
```

## 1.14 排序不支持原生比较的对象

当定义了一个类，并创建了多个实例放在列表里，使用sorted()排序会报错，因为py不知道按照什么规则来比。解决方法有两种，使用operate.attrgetter，或者借助lamba专门定义一个函数来实现。

```python
class User:
    def __init__(self, user_id):
        self.user_id = user_id

    def __repr__(self):
        return 'User({})'.format(self.user_id)


def sort_notcompare():
    users = [User(23), User(3), User(99)]
    print(users)
    print(sorted(users, key=lambda u: u.user_id),end='\n\n')

sort_notcompare()


from operator import attrgetter

users = [User(23), User(3), User(99)]

print(sorted(users, key=attrgetter('user_id')))

```

## 1.15 通过某个字段将记录分组

使用itertools.groupby()实现

```python
rows = [
    {'address': '5412 N CLARK', 'date': '07/01/2012'},
    {'address': '5148 N CLARK', 'date': '07/04/2012'},
    {'address': '5800 E 58TH', 'date': '07/02/2012'},
    {'address': '2122 N CLARK', 'date': '07/03/2012'},
    {'address': '5645 N RAVENSWOOD', 'date': '07/02/2012'},
    {'address': '1060 W ADDISON', 'date': '07/02/2012'},
    {'address': '4801 N BROADWAY', 'date': '07/01/2012'},
    {'address': '1039 W GRANVILLE', 'date': '07/04/2012'},
]

from operator import itemgetter
from itertools import groupby

rows.sort(key=itemgetter('date')) # 基于日期排序

example = groupby(rows, key=itemgetter('date'))

for date,items in example:
        print(date)
        for i in items:
            print(' ',i)
```

## 1.16 过滤序列元素

使用列表推导。对于复杂的过滤规则可以定义一个函数，并借助filter实现过滤。

```python
values = ['1', '2', '-3', '-', '4', 'N/A', '5']

def choose(e):
    try:
        e = int (e)
        return True
    except ValueError :
        return False

show = list(filter(choose, values))

print(show)
```

## 1.17 从字典中提取子集

使用字典推导

```python
prices = {
    'ACME': 45.23,
    'AAPL': 612.78,
    'IBM': 205.55,
    'HPQ': 37.20,
    'FB': 10.75
}

# Make a dictionary of all prices over 200
p1 = {key: value for key, value in prices.items() if value > 200}

# Make a dictionary of tech stocks
tech_names = {'AAPL', 'IBM', 'HPQ', 'MSFT'}
p2 = {key: value for key, value in prices.items() if key in tech_names}

print(p1,end='\n')
print(p2)
```

## 1.18 映射名称到序列元素

这个操作类似于定义一个结构体。

```python
>>> from collections import namedtuple
>>> Subscriber = namedtuple('Subscriber', ['addr', 'joined'])
>>> sub = Subscriber('jonesy@example.com', '2012-10-19')
>>> sub
Subscriber(addr='jonesy@example.com', joined='2012-10-19')
>>> sub.addr
'jonesy@example.com'
>>> sub.joined
'2012-10-19'
>>>
```

## 1.19 转换并同时计算数据

比较好的解决方式是使用一个生成器表达式参数。

```python
import os
files = os.listdir('dirname')
if any(name.endswith('.py') for name in files):
    print('There be python!')
else:
    print('Sorry, no python.')
# Output a tuple as CSV
s = ('ACME', 50, 123.45)
print(','.join(str(x) for x in s))
# Data reduction across fields of a data structure
portfolio = [
    {'name':'GOOG', 'shares': 50},
    {'name':'YHOO', 'shares': 75},
    {'name':'AOL', 'shares': 20},
    {'name':'SCOX', 'shares': 65}
]
min_shares = min(s['shares'] for s in portfolio)
```
## 1.20 合并多个字典或映射

使用collections.ChainMap,将b里面a不存在的键加入

```python
a = {'x': 1, 'z': 3 }
b = {'y': 2, 'z': 4 }

from collections import ChainMap
c = ChainMap(a,b)
print(c['x']) # Outputs 1 (from a)
print(c['y']) # Outputs 2 (from b)
print(c['z']) # Outputs 3 (from a)
```
