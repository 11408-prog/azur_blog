---
title: Flink CDC 实时同步 MySQL 实验笔记
date: 2026-10-26 19:13:26
tags: [linux,flink,mysql]
categories: 学习
---

# Flink CDC 实时同步 MySQL 实验笔记

本实验使用 Flink 1.20.5 和 Flink CDC 3.5.0，实现从 MySQL 到 MySQL 的实时增量同步，体会 CDC（Change Data Capture）相比于 DataX 批量同步的优势。

## 一、 环境与前置准备

### 1.1 基础环境检查
- **Java**：使用 `/apps/java` 下的 Java 8。
- **MySQL**：确保服务运行，`binlog` 已开启且格式为 `ROW`。
- **内存与端口**：可用内存 ≥ 3GB，8081 端口空闲（用于 Flink Web UI）。

### 1.2 Flink 安装与配置
1. 解压 Flink 至 `/apps/flink`。
2. 修改 `conf/config.yaml`，追加单机配置：
```yaml
jobmanager.rpc.address: localhost
jobmanager.bind-host: 0.0.0.0
taskmanager.bind-host: 0.0.0.0
taskmanager.host: localhost
rest.bind-address: 0.0.0.0
parallelism.default: 1
env.java.home: /apps/java
```
3. 将三个依赖 Jar 放入 `lib/` 目录：
   - `flink-sql-connector-mysql-cdc-3.5.0.jar`
   - `mysql-connector-j-8.0.33.jar`
   - `flink-connector-jdbc-3.4.0-1.20.jar`
4. 启动集群：`/apps/flink/bin/start-cluster.sh`，访问 `http://localhost:8081` 确认。

## 二、 配置 MySQL 支持 CDC

Flink CDC 依赖读取 MySQL binlog，需满足三个条件：binlog 开启、账号有 REPLICATION 权限、源表有主键。

### 2.1 五项体检
在 MySQL 中检查以下配置：
- `log_bin` = `ON`
- `binlog_format` = `ROW`
- `binlog_row_image` = `FULL`（保证能拿到更新前的旧值）
- `@@server_id` ≠ `0`
- 源表有 `PRIMARY KEY`

### 2.2 创建 CDC 专用账号
实验6 的 `datax` 账号只有 `SELECT` 权限，无法读取 binlog。需创建新账号：
```sql
CREATE USER 'cdc'@'%' IDENTIFIED WITH mysql_native_password BY 'Cdc@123';
GRANT SELECT, SHOW DATABASES, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'cdc'@'%';
GRANT INSERT, UPDATE, DELETE ON shop.* TO 'cdc'@'%';
FLUSH PRIVILEGES;
```

## 三、 观察 CDC 变更流

在 Flink SQL Client 中，执行：
```sql
SET 'sql-client.execution.result-mode' = 'tableau';
```

### 3.1 全量读取
建源表 `orders`（默认 `scan.startup.mode = initial`），查询 `SELECT COUNT(*) FROM orders;`。
> **观察**：数字从 0 递增至 128000。到达后查询不结束，而是等待新变更，这证明 CDC 是一根“一直在线的数据管道”。

### 3.2 观察四种变更
建增量源表 `orders_live`（使用 `latest-offset` 模式），开启查询：
```sql
SELECT order_id, status, amount, remark, updated_at
FROM orders_live
WHERE order_id = 900001;
```
去 MySQL 中制造四种操作，观察输出：
1. `INSERT`：产生 `+I`。
2. `UPDATE`：产生 `-U`（旧值）和 `+U`（新值），成对出现。
3. 仅更新一列：依然产生整行的 `-U` 和 `+U`。
4. `DELETE`：产生 `-D`。

## 四、 构建端到端同步管道

### 4.1 建目标表
在 MySQL 建 `orders_rt` 表（需含主键），并加一列 `synced_at` 记录到达时间。

### 4.2 建 JDBC Sink
在 Flink 中建目标表 `orders_rt`，**必须包含 `PRIMARY KEY (order_id) NOT ENFORCED`**，否则 JDBC Sink 无法处理更新和删除：
```sql
CREATE TABLE orders_rt (
  ...
  PRIMARY KEY (order_id) NOT ENFORCED
) WITH (
  'connector' = 'jdbc',
  'sink.buffer-flush.max-rows' = '200',
  'sink.buffer-flush.interval' = '1s',
  ...
);
```

### 4.3 提交持续同步作业
```sql
INSERT INTO orders_rt
SELECT order_id, user_id, amount, status, remark, created_at, updated_at, LOCALTIMESTAMP
FROM orders;
```
验证：
- **新增**：目标表出现新记录。
- **更新**：目标表对应行被直接修改（而不是追加）。
- **删除**：目标表对应行消失（`Empty set`）。

## 五、 时效性测试（时延）

### 5.1 默认参数
在 `max-rows=200`、`interval=1s` 下，实测端到端延迟约为 **128 ms**。

### 5.2 极速参数
调整参数为 `max-rows=1`、`interval=0`，实测延迟约为 **476 ms**。
> **注意**：在虚拟机环境下，单次事务开销、时钟微调等会导致数值波动，但整体都在亚秒级，证明 CDC 具有极高的时效性。

## 六、 踩坑记录与排障

1. **一次性粘贴多条 SQL 报错**：
   报错 `only single statement supported`。SQL Client 每次只接受一条语句，需逐条执行。
2. **作业启动报 `NoResourceAvailableException`**：
   由于反复提交/取消作业，导致 TaskManager 的 Slot 未及时释放。解决：停止集群并重启 `/apps/flink/bin/stop-cluster.sh`。
3. **极速模式下没捕获到更新数据**：
   `latest-offset` 只读取作业启动后的变更。若在 Flink 完全连接上 MySQL 前就执行了 `UPDATE`，该变更会被跳过。需确保作业状态为 `RUNNING` 后再去 MySQL 造数据。
4. **时间精度丢失**：
   源表的 `updated_at` 默认是 `DATETIME`（秒级），测试毫秒级时延需改为 `DATETIME(3)`。

## 七、 实验总结

与 DataX 相比，Flink CDC 的核心优势在于：
- **实时性**：从分钟级/天级提升至毫秒/秒级。
- **变更捕获**：能感知 `UPDATE` 和 `DELETE`，保证目标端数据与源端严格一致。
- **全量+增量一体化**：无需像 DataX 那样写两套脚本，也不必担心两次同步之间的数据断层。