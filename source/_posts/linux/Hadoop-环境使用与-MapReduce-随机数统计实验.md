---
title: Hadoop 环境使用与 MapReduce 随机数统计实验
date: 2026-10-03 17:21:03
tags: [linux,hadoop]
categories: 学习
---

# Hadoop 环境使用与 MapReduce 随机数统计实验

> 本文记录在 Linux 虚拟机中使用 Hadoop 的过程，以及通过自定义 MapReduce 程序统计 1000 万个随机整数的完整实验。
>
> 主要用于后续复盘和学习，重点记录环境、常用命令、程序结构、实验过程、运行结果以及遇到的问题。

---

## 一、实验环境

### 1.1 Linux 环境

当前使用 VirtualBox 创建的 Linux 虚拟机。

终端提示符：

```text
vboxuser@lyh
```

实验项目目录：

```text
~/Desktop/randomstats
```

进入项目：

```bash
cd ~/Desktop/randomstats
```

---

## 二、检查基础环境

正式使用 Hadoop 前，可以先检查 Java、Python、SSH 和 Hadoop。

### 2.1 Java

```bash
java -version
```

当前 Java：

```text
java version "1.8.0_371"
Java(TM) SE Runtime Environment (build 1.8.0_371-b11)
Java HotSpot(TM) 64-Bit Server VM (build 25.371-b11, mixed mode)
```

Java 路径：

```text
/apps/java
```

Hadoop 配置：

```bash
export JAVA_HOME=/apps/java
```

---

### 2.2 Python

```bash
python3 --version
```

当前版本：

```text
Python 3.14.4
```

Python 主要用于：

* 生成测试数据
* 编写辅助脚本
* 对 Hadoop 结果进行本地验证

---

### 2.3 SSH

```bash
ssh -V
```

SSH 在 Hadoop 单机伪分布式环境中主要用于 Hadoop 组件之间的启动和管理。

---

### 2.4 Hadoop

```bash
hadoop version
```

Hadoop 安装目录：

```text
/apps/hadoop
```

检查 Hadoop：

```bash
which hadoop
```

结果：

```text
/apps/hadoop/bin/hadoop
```

---

# 三、Hadoop 基本组成

当前环境可以简单理解为：

```text
Hadoop
├── HDFS
│   ├── NameNode
│   └── DataNode
│
├── YARN
│   ├── ResourceManager
│   └── NodeManager
│
└── MapReduce
    ├── Mapper
    ├── Shuffle
    └── Reducer
```

## 3.1 HDFS

HDFS 是 Hadoop 的分布式文件系统，主要负责：

> 存储数据。

### NameNode

负责管理 HDFS 的元数据，例如：

* 文件信息
* 文件被分成哪些 Block
* Block 位于哪个 DataNode

### DataNode

真正保存数据 Block。

---

## 3.2 YARN

YARN 主要负责：

> 管理计算资源和运行任务。

主要组件：

### ResourceManager

负责整个集群的资源管理。

### NodeManager

负责具体节点上的任务执行。

---

## 3.3 MapReduce

MapReduce 负责：

> 对数据进行分布式计算。

基本过程：

```text
输入数据
   ↓
Mapper
   ↓
Shuffle
   ↓
Reducer
   ↓
输出结果
```

---

# 四、检查 HDFS 是否正常

查看 HDFS 根目录：

```bash
hadoop fs -ls /
```

如果可以正常返回结果，说明 HDFS 基本正常。

也可以查看 DataNode：

```bash
hdfs dfsadmin -report
```

当前环境之前查看到：

```text
Configured Capacity: 48.91 GB
Present Capacity:    37.42 GB
DFS Remaining:       37.42 GB
DFS Used:            28 KB
```

当前环境只有一个 DataNode。

因此这是：

> 单机伪分布式 Hadoop 环境

而不是多台服务器组成的真正 Hadoop 集群。

---

# 五、检查 YARN

可以使用：

```bash
jps
```

查看 Hadoop 相关 Java 进程。

正常情况下可以看到类似：

```text
NameNode
DataNode
SecondaryNameNode
ResourceManager
NodeManager
```

各组件作用：

| 组件                | 作用                  |
| ----------------- | ------------------- |
| NameNode          | 管理 HDFS 元数据         |
| DataNode          | 保存 HDFS 数据          |
| SecondaryNameNode | 辅助 NameNode 进行检查点操作 |
| ResourceManager   | YARN 资源管理           |
| NodeManager       | YARN 节点管理           |

---

# 六、WordCount 实验

Hadoop 自带 MapReduce 示例程序。

例如：

```bash
hadoop jar $HADOOP_HOME/share/hadoop/mapreduce/hadoop-mapreduce-examples-*.jar \
wordcount \
/wordcount/input \
/wordcount/output
```

成功后可以查看：

```bash
hadoop fs -cat /wordcount/output/part-r-00000
```

例如：

```text
hadoop 1
hello 2
mapreduce 1
```

这个实验主要用于确认：

```text
HDFS
  +
YARN
  +
MapReduce
```

三部分能够正常协作。

---

# 七、Pi 实验

Hadoop 还提供了 Pi 示例：

```bash
hadoop jar $HADOOP_HOME/share/hadoop/mapreduce/hadoop-mapreduce-examples-*.jar \
pi 10 1000
```

其中：

```text
10
```

表示 Mapper 数量。

```text
1000
```

表示每个 Mapper 使用的样本数量。

程序使用 Monte Carlo 方法估计 π。

基本思想：

```text
随机生成大量点
      ↓
判断点是否位于圆内
      ↓
统计圆内点数量
      ↓
估计 π
```

公式：

```text
π ≈ 4 × 圆内点数量 / 总点数量
```

本次实验得到：

```text
Estimated value of Pi is 3.14080000000000000000
```

这个实验主要用于理解：

> Hadoop 可以将一个计算任务拆分成多个 Map Task 并行执行。

---

# 八、RandomStats 实验

## 8.1 实验目标

编写自己的 Hadoop MapReduce Java 程序。

目标：

> 生成 1000 万个随机整数，然后使用 MapReduce 统计：

```text
count
sum
mean
min
max
```

最后使用本地 `awk` 对结果进行验证。

---

# 九、创建项目目录

项目放在 Desktop：

```bash
mkdir -p ~/Desktop/randomstats
cd ~/Desktop/randomstats
```

项目最终结构：

```text
randomstats/
├── RandomStats.java
├── RandomStats.class
├── RandomStats$StatsMapper.class
├── RandomStats$StatsReducer.class
├── RandomStats.jar
└── numbers.txt
```

各文件作用：

| 文件               | 作用              |
| ---------------- | --------------- |
| RandomStats.java | Java 源代码        |
| `*.class`        | Java 编译后的字节码    |
| RandomStats.jar  | 提交给 Hadoop 的程序包 |
| numbers.txt      | 测试数据            |

---

# 十、生成 1000 万个随机整数

使用 Python：

```bash
python3 - <<'PY' > numbers.txt
import random

for _ in range(10_000_000):
    print(random.randint(0, 100000))
PY
```

这会生成：

```text
10,000,000
```

个随机整数。

每个数字的范围：

```text
0 ~ 100000
```

查看文件大小：

```bash
ls -lh numbers.txt
```

本次生成的文件约：

```text
56.2 MB
```

---

# 十一、为什么选择 1000 万条数据？

不同规模的数据可以大致理解为：

|    数据量 |  大约文件大小 | 当前环境       |
| -----: | ------: | ---------- |
|   10 万 |   几百 KB | 很轻松        |
|  100 万 |    几 MB | 很轻松        |
| 1000 万 | 约 56 MB | 很适合当前实验    |
|    1 亿 |   数百 MB | 可以尝试       |
|   10 亿 |    数 GB | 会明显增加计算时间  |
|   TB 级（约1800亿） |      TB | 不适合当前单机虚拟机 |

当前 HDFS 剩余空间有限，因此没有必要一开始就生成几十亿条数据。

---

# 十二、RandomStats.java

完整代码：

```java
import java.io.IOException;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;

import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.Text;

import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;

import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;

public class RandomStats {

    public static class StatsMapper
            extends Mapper<LongWritable, Text, Text, Text> {

        private long count = 0;
        private long sum = 0;
        private long min = Long.MAX_VALUE;
        private long max = Long.MIN_VALUE;

        private final Text outputKey = new Text("stats");

        @Override
        protected void map(
                LongWritable key,
                Text value,
                Context context)
                throws IOException, InterruptedException {

            String line = value.toString().trim();

            if (line.isEmpty()) {
                return;
            }

            long number = Long.parseLong(line);

            count++;
            sum += number;

            if (number < min) {
                min = number;
            }

            if (number > max) {
                max = number;
            }
        }

        @Override
        protected void cleanup(Context context)
                throws IOException, InterruptedException {

            String result =
                    count + "," +
                    sum + "," +
                    min + "," +
                    max;

            context.write(
                    outputKey,
                    new Text(result)
            );
        }
    }

    public static class StatsReducer
            extends Reducer<Text, Text, Text, Text> {

        @Override
        protected void reduce(
                Text key,
                Iterable<Text> values,
                Context context)
                throws IOException, InterruptedException {

            long totalCount = 0;
            long totalSum = 0;
            long globalMin = Long.MAX_VALUE;
            long globalMax = Long.MIN_VALUE;

            for (Text value : values) {

                String[] parts =
                        value.toString().split(",");

                long count =
                        Long.parseLong(parts[0]);

                long sum =
                        Long.parseLong(parts[1]);

                long min =
                        Long.parseLong(parts[2]);

                long max =
                        Long.parseLong(parts[3]);

                totalCount += count;
                totalSum += sum;

                if (min < globalMin) {
                    globalMin = min;
                }

                if (max > globalMax) {
                    globalMax = max;
                }
            }

            double mean =
                    (double) totalSum / totalCount;

            String result =
                    "count=" + totalCount +
                    ", sum=" + totalSum +
                    ", mean=" + mean +
                    ", min=" + globalMin +
                    ", max=" + globalMax;

            context.write(
                    new Text("result"),
                    new Text(result)
            );
        }
    }

    public static void main(String[] args)
            throws Exception {

        if (args.length != 2) {
            System.err.println(
                    "Usage: RandomStats <input> <output>"
            );
            System.exit(2);
        }

        Configuration conf =
                new Configuration();

        Job job =
                Job.getInstance(
                        conf,
                        "Random Number Statistics"
                );

        job.setJarByClass(RandomStats.class);

        job.setMapperClass(StatsMapper.class);
        job.setReducerClass(StatsReducer.class);

        job.setMapOutputKeyClass(Text.class);
        job.setMapOutputValueClass(Text.class);

        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(Text.class);

        FileInputFormat.addInputPath(
                job,
                new Path(args[0])
        );

        FileOutputFormat.setOutputPath(
                job,
                new Path(args[1])
        );

        System.exit(
                job.waitForCompletion(true)
                        ? 0 : 1
        );
    }
}
```

---

# 十三、RandomStats 的核心思想

这个程序没有让 Mapper 把 1000 万个数字全部发送给 Reducer。

Mapper 首先进行局部统计。

```text
Mapper
│
├── count
├── sum
├── min
└── max
```

处理完之后，只输出一条记录：

```text
stats    count,sum,min,max
```

Reducer 再负责把不同 Mapper 的统计结果进行合并。

因此：

```text
1000 万条输入
      ↓
   Mapper
      ↓
   局部统计
      ↓
  只输出 1 条
      ↓
    Shuffle
      ↓
   Reducer
      ↓
   最终结果
```

这是一种：

> 局部聚合（Local Aggregation）→ 全局聚合（Global Aggregation）

的思想。

---

# 十四、编译 Java 程序

使用 Hadoop 提供的 classpath：

```bash
javac -classpath "$(hadoop classpath)" \
-d . RandomStats.java
```

编译成功后：

```bash
find . -name "*.class"
```

可以看到：

```text
./RandomStats.class
./RandomStats$StatsMapper.class
./RandomStats$StatsReducer.class
```

---

# 十五、打包成 JAR

Hadoop 运行 Java MapReduce 程序时，一般将 `.class` 文件打包成 JAR。

```bash
jar -cvf RandomStats.jar RandomStats*.class
```

检查：

```bash
ls -lh RandomStats.jar
```

---

# 十六、上传数据到 HDFS

创建 HDFS 输入目录：

```bash
hadoop fs -mkdir -p /randomstats/input
```

上传：

```bash
hadoop fs -put numbers.txt /randomstats/input/
```

查看：

```bash
hadoop fs -ls -h /randomstats/input
```

本次结果：

```text
Found 1 items
-rw-r--r--   1 vboxuser supergroup     56.2 M 2026-10-03 09:10 /randomstats/input/numbers.txt
```

---

# 十七、检查 HDFS 中的数据量

可以直接统计行数：

```bash
hadoop fs -cat /randomstats/input/numbers.txt | wc -l
```

应该得到：

```text
10000000
```

这可以验证 HDFS 中确实保存了 1000 万条数据。

---

# 十八、运行 MapReduce

执行：

```bash
hadoop jar RandomStats.jar RandomStats \
    /randomstats/input \
    /randomstats/output
```

参数含义：

| 参数                    | 含义           |
| --------------------- | ------------ |
| `RandomStats.jar`     | MapReduce 程序 |
| `RandomStats`         | Main Class   |
| `/randomstats/input`  | HDFS 输入目录    |
| `/randomstats/output` | HDFS 输出目录    |

注意：

> Hadoop 要求输出目录不存在。

如果已经存在：

```bash
hadoop fs -rm -r /randomstats/output
```

然后重新运行。

---

# 十九、Job 运行过程

运行过程中可以看到：

```text
map 0% reduce 0%
map 100% reduce 0%
map 100% reduce 100%
```

最终：

```text
Job job_1791015664134_0003 completed successfully
```

说明 Job 成功完成。

---

# 二十、本次 Job 的 Counters

本次任务：

```text
job_1791015664134_0003
```

关键数据：

```text
Launched map tasks=1
Launched reduce tasks=1
Data-local map tasks=1
```

即：

```text
1 Mapper
1 Reducer
```

---

# 二十一、为什么 1000 万条数据只有 1 个 Mapper？

这是本次实验中非常值得理解的问题。

文件大小：

```text
numbers.txt ≈ 56.2 MB
```

而当前 HDFS 默认 Block Size 很可能是：

```text
128 MB
```

由于：

```text
56.2 MB < 128 MB
```

因此这个文件只需要一个 HDFS Block。

通常情况下：

```text
HDFS Block
     ↓
Input Split
     ↓
Mapper
```

于是：

```text
56.2 MB
   ↓
1 Block
   ↓
1 Input Split
   ↓
1 Mapper
```

所以 Hadoop 没有必要启动多个 Mapper。

这并不意味着 Hadoop 没有并行计算能力，而是：

> 当前输入数据没有被切分成多个 Map Task。

---

# 二十二、本次 Job 的数据流

本次任务实际上是：

```text
numbers.txt
56.2 MB
   │
   ▼
  HDFS
   │
   ▼
1 个 Input Split
   │
   ▼
1 个 Mapper
   │
   ├── count = 10000000
   ├── sum = ...
   ├── min = 0
   └── max = 100000
   │
   ▼
只输出 1 条记录
   │
   ▼
 Shuffle
   │
   ▼
1 个 Reducer
   │
   ▼
最终统计结果
```

---

# 二十三、Mapper 的输入输出数量

Job Counters：

```text
Map input records=10000000
Map output records=1
```

这两个数字非常重要。

意味着：

```text
输入：
10000000 条

输出：
1 条
```

Mapper 已经在本地完成统计。

如果直接把 1000 万个数字全部发送到 Reducer：

```text
10000000
    ↓
 Shuffle
    ↓
 Reducer
```

会产生大量网络和磁盘开销。

当前程序：

```text
10000000
    ↓
Mapper 本地统计
    ↓
1
    ↓
Shuffle
    ↓
Reducer
```

可以显著减少 Shuffle 数据量。

---

# 二十四、查看 Hadoop 最终结果

运行：

```bash
hadoop fs -cat /randomstats/output/part-r-00000
```

本次结果：

```text
result	count=10000000, sum=499970254026, mean=49997.0254026, min=0, max=100000
```

整理如下：

| 统计量   |       Hadoop 结果 |
| ----- | --------------: |
| Count |      10,000,000 |
| Sum   | 499,970,254,026 |
| Mean  |  49,997.0254026 |
| Min   |               0 |
| Max   |         100,000 |

---

# 二十五、验证 Mean

平均值公式：

```text
mean = sum / count
```

代入：

```text
499970254026 / 10000000
```

得到：

```text
49997.0254026
```

与 Hadoop 输出完全一致。

---

# 二十六、使用 awk 进行本地验证

为了确认 Hadoop 的结果正确，可以使用本地 `awk` 对原始数据进行统计。

```bash
awk '
{
    count++;
    sum += $1;

    if (count == 1 || $1 < min)
        min = $1;

    if (count == 1 || $1 > max)
        max = $1;
}
END {
    printf "count=%d\n", count;
    printf "sum=%d\n", sum;
    printf "mean=%.10f\n", sum/count;
    printf "min=%d\n", min;
    printf "max=%d\n", max;
}
' numbers.txt
```

预期结果：

```text
count=10000000
sum=499970254026
mean=49997.0254026000
min=0
max=100000
```

然后与 Hadoop 输出进行比较。

---

# 二十七、Hadoop 与本地计算

本次实验实际上比较了两种计算方式。

## 本地计算

```text
numbers.txt
    ↓
awk
    ↓
统计结果
```

特点：

* 单机
* 简单
* 小数据非常方便

---

## Hadoop MapReduce

```text
numbers.txt
    ↓
HDFS
    ↓
Mapper
    ↓
Shuffle
    ↓
Reducer
    ↓
统计结果
```

特点：

* 可以处理大量数据
* 可以将数据拆分
* 可以让多个 Mapper 并行处理
* 可以将多个 Mapper 的结果交给 Reducer 合并

当前只有一个 Mapper，是因为输入数据只有一个 Input Split。

---

# 二十八、为什么本次实验还没有真正体现 Hadoop 的并行优势？

虽然已经成功运行 MapReduce，但是：

```text
Mapper = 1
Reducer = 1
```

所以当前实际上是：

```text
单个 Mapper
    ↓
单个 Reducer
```

还没有真正看到：

```text
Mapper 1 ─┐
Mapper 2 ─┤
Mapper 3 ─┼──→ Reducer
Mapper 4 ─┤
Mapper 5 ─┘
```

下一步可以把 1000 万条数据拆成多个文件，或者调整 HDFS Block Size，使 Hadoop 创建多个 Input Split。

例如：

```text
numbers-1.txt
numbers-2.txt
numbers-3.txt
numbers-4.txt
```

然后观察：

```text
Mapper 1 ─┐
Mapper 2 ─┤
Mapper 3 ─┼──→ Reducer
Mapper 4 ─┘
```

这样可以更加直观地理解 Hadoop 的并行计算。

---

# 二十九、常见问题

## 29.1 重复运行 Job 报输出目录已经存在

如果出现：

```text
FileAlreadyExistsException
Output directory already exists
```

原因：

Hadoop 不允许 MapReduce 直接覆盖已有输出目录。

解决：

```bash
hadoop fs -rm -r /randomstats/output
```

然后重新执行：

```bash
hadoop jar RandomStats.jar RandomStats \
    /randomstats/input \
    /randomstats/output
```

---

## 29.2 不要随便执行 namenode format

不要为了处理普通问题而随便执行：

```bash
hdfs namenode -format
```

这个命令会重新初始化 NameNode。

如果已有 Hadoop 环境和数据：

> 不要随便重新 format。

当前环境的 NameNode 已经正常运行，不需要重新格式化。

---

## 29.3 删除不存在的 HDFS 目录

例如：

```bash
hadoop fs -rm -r /randomstats/input
```

如果目录不存在：

```text
rm: `/randomstats/input': No such file or directory
```

这不代表 Hadoop 出问题。

只是说明：

> 要删除的目录本来就不存在。

之后可以直接：

```bash
hadoop fs -mkdir -p /randomstats/input
```

---

## 29.4 resource-types.xml not found

Job 日志中出现：

```text
resource-types.xml not found
Unable to find 'resource-types.xml'
```

但是同时：

```text
Submitted application
```

并最终：

```text
completed successfully
```

说明本次 Job 没有因为这个信息失败。

当前实验中可以暂时理解为：

> 当前 Hadoop 配置没有额外定义 Resource Types，但不影响这个 MapReduce Job 正常运行。

---

## 29.5 为什么只有一个 Mapper？

不要简单认为：

> 数据有 1000 万条，所以应该有很多 Mapper。

Mapper 数量主要与：

```text
Input Split
```

有关。

而 Input Split 通常受到：

```text
文件大小
HDFS Block Size
```

等因素影响。

因此：

```text
数据条数 ≠ Mapper 数量
```

更准确的理解是：

```text
文件
 ↓
Block / Input Split
 ↓
Mapper
```

---

# 三十、HDFS 常用命令

查看根目录：

```bash
hadoop fs -ls /
```

查看目录：

```bash
hadoop fs -ls /randomstats/input
```

以人类可读格式显示大小：

```bash
hadoop fs -ls -h /randomstats/input
```

创建目录：

```bash
hadoop fs -mkdir -p /randomstats/input
```

上传文件：

```bash
hadoop fs -put numbers.txt /randomstats/input/
```

查看文件：

```bash
hadoop fs -cat /randomstats/input/numbers.txt
```

删除目录：

```bash
hadoop fs -rm -r /randomstats/output
```

查看结果：

```bash
hadoop fs -cat /randomstats/output/part-r-00000
```

查看 HDFS 状态：

```bash
hdfs dfsadmin -report
```

---

# 三十一、YARN / Job 常用命令

查看 Java 进程：

```bash
jps
```

查看 YARN Application：

```bash
yarn application -list
```

查看 YARN 节点：

```bash
yarn node -list
```

查看 Job 日志：

```bash
yarn logs -applicationId <application_id>
```

例如：

```bash
yarn logs -applicationId application_1791015664134_0003
```

---

# 三十二、Java MapReduce 开发流程

以后自己写 MapReduce 程序时，可以按照以下流程：

```text
1. 准备数据
      ↓
2. 上传 HDFS
      ↓
3. 编写 Mapper
      ↓
4. 编写 Reducer
      ↓
5. 编写 main()
      ↓
6. javac 编译
      ↓
7. 打包 JAR
      ↓
8. hadoop jar
      ↓
9. 查看 Job Counters
      ↓
10. 查看 HDFS 输出
      ↓
11. 本地程序验证结果
```

核心命令：

```bash
javac -classpath "$(hadoop classpath)" \
-d . RandomStats.java
```

```bash
jar -cvf RandomStats.jar RandomStats*.class
```

```bash
hadoop jar RandomStats.jar RandomStats \
    /randomstats/input \
    /randomstats/output
```

```bash
hadoop fs -cat /randomstats/output/part-r-00000
```

---

# 三十三、当前实验掌握的知识

通过本实验，已经接触到：

## Hadoop

```text
HDFS + YARN + MapReduce
```

## HDFS

```text
NameNode
DataNode
Block
```

## YARN

```text
ResourceManager
NodeManager
Application
```

## MapReduce

```text
Mapper
Shuffle
Reducer
```

## MapReduce 数据流

```text
Input
  ↓
InputSplit
  ↓
Mapper
  ↓
Shuffle
  ↓
Reducer
  ↓
Output
```

## 局部聚合

当前 RandomStats 使用：

```text
Mapper 本地统计
      ↓
count
sum
min
max
      ↓
只发送一条记录
      ↓
Reducer 全局合并
```

这是一种重要的 MapReduce 优化思想。

---

# 三十四、后续实验计划

当前 RandomStats 可以继续升级。

```text
RandomStats v1
│
├── count
├── sum
├── mean
├── min
└── max
      ↓
RandomStats v2
│
├── variance
└── standard deviation
      ↓
RandomStats v3
│
├── 多文件输入
└── 多 Mapper
      ↓
RandomStats v4
│
├── Combiner
└── 对比有无 Combiner 的性能
      ↓
RandomStats v5
│
└── 更大规模数据测试
```

尤其值得继续做三个实验。

### 实验 A：多个 Mapper

把数据拆成多个文件，观察：

```text
Launched map tasks=?
```

---

### 实验 B：Combiner

比较：

```text
Mapper → Reducer
```

和：

```text
Mapper → Combiner → Reducer
```

理解为什么 Combiner 可以减少 Shuffle 数据量。

---

### 实验 C：方差和标准差

在当前程序基础上增加：

```text
variance
standard deviation
```

进一步理解如何设计可以进行 MapReduce 聚合的统计量。

---

# 三十五、实验总结

本次实验完成了一个完整的 Hadoop MapReduce 数据处理流程：

```text
Python
  ↓
生成 1000 万条随机数据
  ↓
numbers.txt
  ↓
HDFS
  ↓
RandomStats MapReduce
  ↓
Mapper
  ↓
局部统计
  ↓
Shuffle
  ↓
Reducer
  ↓
count / sum / mean / min / max
  ↓
HDFS 输出
  ↓
awk 本地验证
```

最终 Hadoop 得到：

```text
count=10000000
sum=499970254026
mean=49997.0254026
min=0
max=100000
```

本次实验最重要的不是记住这些数字，而是理解：

> Hadoop MapReduce 的核心不是“用 Hadoop 计算一个平均数”，而是把大量数据划分成可以并行处理的任务，再通过 Shuffle 和 Reduce 将局部结果合并成全局结果。

同时，本次实验也发现：

> 1000 万条数据并不一定意味着多个 Mapper。Mapper 数量主要取决于 Input Split，而 Input Split 又与输入文件、文件大小和 HDFS Block Size 等因素有关。

因此，下一阶段应该通过**多文件 / 多 Split 实验**，真正观察 Hadoop 的并行计算过程。
