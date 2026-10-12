---
title: Kafka 端到端数据管道实验问题复盘
date: 2026-10-12 20:09:10
tags: [Kafka, Filebeat, HDFS, linux]
categories: 学习
---


# Kafka 端到端数据管道实验问题复盘

本次实验搭建了 **Filebeat → Kafka → Kafka Connect → HDFS** 的完整日志采集管道。过程中遇到了若干典型问题，现按“现象 → 原因 → 解决 → 验证”的方式整理，方便以后快速排查。

## 问题 1：生产者连接不上 Kafka，报 `Topic not present in metadata`

**现象**

```text
WARN Connection to node -1 (localhost/127.0.0.1:9092) could not be established.
WARN Bootstrap broker localhost:9092 disconnected
ERROR TimeoutException: Topic first_topic not present in metadata after 60000 ms.
```

**原因**

Kafka Broker 根本没有启动。`jps` 中只有 `QuorumPeerMain` 和 `Jps`，没有 `Kafka` 进程，9092 端口无人监听。原因是之前用前台方式启动 Broker，终端关闭或按了 Ctrl+C，进程随之退出。

**解决**

用后台方式启动 Broker：

```bash
cd /apps/kafka
bin/kafka-server-start.sh -daemon config/server.properties
# 如果 -daemon 不支持，使用：
# nohup bin/kafka-server-start.sh config/server.properties > logs/server.out 2>&1 &
```

**验证**

```bash
jps | grep Kafka
ss -lntp | grep 9092
bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

---

## 问题 2：Broker 启动后立刻退出，报 `UnknownHostException: lyh`

**现象**

`jps` 看不到 `Kafka`，`/apps/kafka/logs/server.log` 末尾出现：

```text
java.net.UnknownHostException: lyh: lyh: Name or service not known
    at java.net.InetAddress.getLocalHost(InetAddress.java:1525)
ERROR Exiting Kafka due to fatal exception during startup.
```

**原因**

Kafka 启动时调用 `InetAddress.getLocalHost()`，用主机名 `lyh` 去解析 IP，但 `/etc/hosts` 中没有 `lyh` 的映射，解析失败导致 Broker 直接退出。

**解决**

在 `/etc/hosts` 中添加本机主机名映射：

```bash
echo "127.0.0.1    $(hostname)" | sudo tee -a /etc/hosts
hostname -i   # 应返回 127.0.0.1
```

然后重新启动 Broker。

**验证**

```bash
hostname -i
jps | grep Kafka
```

---

## 问题 3：Kafka Connect 启动失败，8083 端口无法连接

**现象**

```bash
curl: (7) Failed to connect to localhost port 8083
```

`jps` 中没有 `ConnectDistributed`，`/apps/kafka/logs/connectDistributed.out` 末尾报：

```text
java.lang.UnsupportedClassVersionError: org/springframework/stereotype/Component
has been compiled by a more recent version of the Java Runtime (class file version 61.0),
this version of the Java Runtime only recognizes class file versions up to 52.0
```

**原因**

Confluent HDFS 3 Sink Connector 3.0.4 是用 **Java 17** 编译的（class file version 61.0），而 Kafka Connect 运行在 **Java 8** 上（只支持到 52.0），类加载失败，Connect 崩溃退出。

**解决**

1. 安装 Java 17：

```bash
sudo apt update
sudo apt install -y openjdk-17-jdk
```

2. 用 Java 17 启动 Connect：

```bash
cd /apps/kafka
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
  bin/connect-distributed.sh -daemon config/connect-distributed.properties
```

**验证**

```bash
sleep 20
jps | grep ConnectDistributed
ss -lntp | grep 8083
curl -s http://localhost:8083/ | jq .
curl -s http://localhost:8083/connector-plugins | jq '.[].class'
```

应看到 `"io.confluent.connect.hdfs3.Hdfs3SinkConnector"`。

---

## 问题 4：插件目录混入 `.zip` 文件，Connect 扫描异常

**现象**

`connectDistributed.out` 中出现：

```text
Loading plugin from: /apps/kafka/kafka-plugins/confluentinc-kafka-connect-hdfs3-3.0.4.zip
```

虽然未直接导致失败，但 Connect 会把 `.zip` 也当作插件目录扫描，浪费启动时间，可能引发意外问题。

**原因**

解压后没有删除原始 `.zip` 文件，而 `plugin.path` 指向整个 `kafka-plugins` 目录。

**解决**

```bash
rm -f /apps/kafka/kafka-plugins/confluentinc-kafka-connect-hdfs3-3.0.4.zip
```

**验证**

```bash
ls /apps/kafka/kafka-plugins/
# 只应看到解压后的目录
```

---

## 问题 5：提交 Connector 后立刻查询状态报 404

**现象**

```json
{"error_code": 404, "message": "No status found for connector hdfs-sink"}
```

**原因**

`POST /connectors` 返回时 Connector 还在初始化，task 和 status 尚未生成。这是时序问题，并非故障。

**解决**

等待约 10 秒再查询：

```bash
sleep 10
curl -s http://localhost:8083/connectors/hdfs-sink/status | jq .
```

看到 `"state": "RUNNING"` 即可。

**验证**

```bash
curl -s http://localhost:8083/connectors | jq .
curl -s http://localhost:8083/connectors/hdfs-sink/status | jq '.connector.state, .tasks[].state'
```

---

## 问题 6：重复创建 Topic 报 `TopicExistsException`

**现象**

```text
Error while executing topic command : Topic 'first_topic' already exists.
org.apache.kafka.common.errors.TopicExistsException
```

**原因**

之前已经创建过 `first_topic`，再次执行 `--create` 会报“已存在”。这是幂等冲突，不影响后续操作。

**解决**

忽略即可。如需重新创建，先删除再建：

```bash
bin/kafka-topics.sh --delete --bootstrap-server localhost:9092 --topic first_topic
sleep 5
bin/kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --replication-factor 1 --partitions 3 --topic first_topic
```

**验证**

```bash
bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

---

## 总结与建议

| 编号 | 问题 | 根本原因 | 解决方式 |
|------|------|----------|----------|
| 1 | 生产者连不上 9092 | Broker 未启动 | 用 `-daemon` 或 `nohup` 后台启动 |
| 2 | Broker 启动即崩 | `/etc/hosts` 缺主机名 | 添加 `127.0.0.1 主机名` |
| 3 | Connect 连不上 8083 | Java 8 加载 Java 17 插件 | 安装 JDK 17，指定 `JAVA_HOME` |
| 4 | 插件扫描异常 | `.zip` 被当作插件目录 | 删除 `.zip` 文件 |
| 5 | 提交后查状态 404 | 初始化未完成 | `sleep 10` 后再查 |
| 6 | Topic 已存在报错 | 重复创建 | 忽略或先删再建 |

**最关键的三个坑：**

1. **`/etc/hosts` 补主机名** → 解决 `UnknownHostException`。
2. **Kafka Connect 用 Java 17 启动** → 解决 `UnsupportedClassVersionError`。
3. **服务用 `-daemon` / `nohup` 后台启动** → 避免终端关闭导致进程退出。

以后搭建类似环境时，先检查这三项，可以节省大量排查时间。