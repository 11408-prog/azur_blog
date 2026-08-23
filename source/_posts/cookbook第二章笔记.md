---
title: cookbook第二章笔记
date: 2026-08-21 18:07:15
tags: [python,字符串文本]
categories: 学习
---

本章讲述了如何高效、优雅地处理现实世界中“不规矩”的文本数据

## 名词解释

### 正则修饰符
定义:用于改变正则表达式引擎默认匹配行为的额外参数或内联指令。它只改变匹配的方式和规则，如是否忽略大小写等。

## 2.1 使用多个界定字符分割字符串

split()方法不允许有多个分割符或者不确定的空格。建议使用re.split()。
使用方法为：
```python
re.split(pattern, string, maxsplit=0, flags=0)
```
其中，pattern表示正则表达式，string表示要分割的字符串，maxsplit表示最大分割次数，flags表示正则修饰符。
```python 
>>> line = 'asdf fjdk; afed, fjek,asdf, foo'
>>> import re
>>> re.split(r'[;,\s]\s*', line)
['asdf', 'fjdk', 'afed', 'fjek', 'asdf', 'foo']
```

## 2.2 字符串开头或结尾匹配

使用str.startswith()或者str.endswith()。

'''python
url = 'http://www.python.org'

print(url.endswith('com'))
print(url.startswith('http'))
'''

## 2.3 用shell通配符匹配字符串

fnmatch模块提供了fnmatch()和fnmatchcase()来实现。相比于前者，后者会严格按照的你用的模式的大小写匹配。前者使用操作系统的大小写敏感规则来匹配模式。

```python
from fnmatch import fnmatch,fnmatchcase

names = ['Dat1.csv', 'Dat2.csv', 'config.ini', 'foo.py']
print([name for name in names if fnmatch(name, 'Dat*.csv')])
#输出['Dat1.csv', 'Dat2.csv']

print(fnmatch('foot.txt','*.txt'))
print(fnmatch('foot.txt','*.TXT'))
print(fnmatchcase('foot.txt','*.txt'))
print(fnmatchcase('foot.txt','*.TXT'))
```

## 2.4 字符串匹配搜索

需要调用str.find() , str.endswith() , str.startswith() 或者类似的方法。

需要注意的是，如果你打算做大量的匹配和搜索操作的话，最好先编译正则表达式，然后再重复使用它。 模块级别的函数会将最近编译过的模式缓存起来，因此并不会消耗太多的性能， 但是如果使用预编译模式的话，你将会减少查找和一些额外的处理损耗。

```python
>>> text = 'yeah, but no, but yeah, but no, but yeah'
>>> # Exact match
>>> text == 'yeah'
False
>>> # Match at start or end
>>> text.startswith('yeah')
True
>>> text.endswith('no')
False
>>> # Search for the location of the first occurrence
>>> text.find('no')
10
```

## 2.5 字符串搜索和替换






