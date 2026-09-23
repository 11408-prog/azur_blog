---
title: ubuntu配置操作留档
date: 2026-09-23 22:12:04
tags: [ubuntu]
categories: 学习
---

# Ubuntu 配置操作留档

## 1. 系统信息

- **虚拟机软件**：VirtualBox 7.2.6
- **Ubuntu 版本**：Ubuntu 26.04 (开发版，代号 resolute)
- **用户名**：`vboxuser`
- **主机名**：`lyh`
- **终端提示符**：`vboxuser@lyh`
- **当前会话类型**：Wayland（`echo $XDG_SESSION_TYPE` 输出 `wayland`，但剪贴板已正常工作）

---

## 2. 修复 APT 源 403 错误

国内镜像 `cn.archive.ubuntu.com` 的 IPv6 节点不可用，导致 `apt update` 报 `403 Forbidden` 和签名错误。

```bash
# 强制使用 IPv4 更新
sudo apt -o Acquire::ForceIPv4=true update

# 永久设置 IPv4 优先
echo 'Acquire::ForceIPv4 "true";' | sudo tee /etc/apt/apt.conf.d/99force-ipv4

# 如果仍失败，替换为官方主源或阿里云镜像
sudo sed -i 's/cn.archive.ubuntu.com/archive.ubuntu.com/g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null
# 或使用阿里云：
# sudo sed -i 's/cn.archive.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null

sudo apt update
```

---

## 3. 安装 VirtualBox 增强功能

### 3.1 通过 APT 安装发行版增强功能

```bash
sudo apt install build-essential dkms linux-headers-$(uname -r) virtualbox-guest-utils virtualbox-guest-x11
```

### 3.2 尝试通过官方 ISO 安装（失败记录）

- 挂载官方增强功能 ISO 后执行 `sudo ./VBoxLinuxAdditions.run`，出现 `Decompression failed` 错误。
- **原因**：已安装的 `virtualbox-guest-utils` 版本为 7.2.6，而官方 ISO 为 7.2.4，版本冲突。
- 后续执行了 `sudo /sbin/rcvboxadd setup` 重新编译内核模块。

### 3.3 结果

- 重启后，主机与虚拟机之间的**双向剪贴板已可正常使用**（尽管会话仍为 Wayland）。
- 若剪贴板失效，可手动执行：`VBoxClient --clipboard`

---

## 4. 共享文件夹配置

### 4.1 VirtualBox 设置

- 添加共享文件夹，名称设为 `share`，勾选“自动挂载”和“固定分配”。

### 4.2 Ubuntu 端操作

- 错误命令：`sudo usermod -aG vboxsf lyh`（`lyh` 是主机名，不是用户名）
- **正确命令**：
  ```bash
  sudo usermod -aG vboxsf vboxuser
  sudo reboot
  ```
- 重启后检查：`ls /media/sf_share`，确认共享文件夹内容可见。

---

## 5. 安装 JDK 与 Hadoop

### 5.1 准备安装包

从 Windows 主机将以下安装包放入共享文件夹 `/media/sf_share`：
- `jdk-8u371-linux-x64.tar.gz`
- `hadoop-3.3.5.tar.gz`

> 注意：主机上文件名可能带有 `(1)` 后缀，复制时需重命名。

### 5.2 创建安装目录

```bash
sudo mkdir -p /apps /data
sudo chown -R vboxuser:vboxuser /apps /data
```

### 5.3 复制安装包到 /apps

```bash
cp "/media/sf_share/jdk-8u371-linux-x64.tar(1).gz" /apps/jdk-8u371-linux-x64.tar.gz
cp "/media/sf_share/hadoop-3.3.5.tar(1).gz" /apps/hadoop-3.3.5.tar.gz
```

### 5.4 解压并重命名

```bash
cd /apps
tar zxvf jdk-8u371-linux-x64.tar.gz
mv jdk1.8.0_371 java
rm jdk-8u371-linux-x64.tar.gz

tar zxvf hadoop-3.3.5.tar.gz
mv hadoop-3.3.5 hadoop
rm hadoop-3.3.5.tar.gz
```

---

## 6. 配置环境变量（含 PATH 修复）

编辑 `~/.bashrc`，在末尾添加：

```bash
# Java
export JAVA_HOME=/apps/java
export PATH=$JAVA_HOME/bin:$PATH

# Hadoop
export HADOOP_HOME=/apps/hadoop
export PATH=$HADOOP_HOME/bin:$PATH
```

使配置生效：

```bash
source ~/.bashrc
```

### 6.1 问题记录：PATH 被字面字符串覆盖

- 错误现象：`echo $PATH` 输出 `/apps/hadoop/bin:/apps/java/bin:PATH`，导致系统命令（如 `which`、`vim`）无法找到。
- **原因**：在 `~/.bashrc` 中误写为 `export PATH=$JAVA_HOME/bin:PATH`（缺少 `$`）。
- **修复**：
  ```bash
  # 临时修复
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

  # 永久修复：编辑 ~/.bashrc，确保为 $PATH
  sed -i 's|:PATH$|:$PATH|g' ~/.bashrc
  source ~/.bashrc
  ```

### 6.2 验证

```bash
java -version   # 显示 1.8.0_371
hadoop version  # 显示 Hadoop 3.3.5
```

---

## 7. SSH 免密登录配置

```bash
sudo apt install -y openssh-server
ssh-keygen -t rsa -P "" -f ~/.ssh/id_rsa
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
ssh localhost   # 首次输入 yes，之后免密
```

---

## 8. Hadoop 伪分布式配置

进入配置目录：

```bash
cd /apps/hadoop/etc/hadoop
```

### 8.1 hadoop-env.sh

```bash
sed -i 's|.*export JAVA_HOME=.*|export JAVA_HOME=/apps/java|' hadoop-env.sh
```

### 8.2 core-site.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <property>
        <name>hadoop.tmp.dir</name>
        <value>/data/tmp/hadoop/tmp</value>
    </property>
    <property>
        <name>fs.defaultFS</name>
        <value>hdfs://localhost:9000</value>
    </property>
</configuration>
```

### 8.3 hdfs-site.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <property>
        <name>dfs.namenode.name.dir</name>
        <value>/data/tmp/hadoop/hdfs/name</value>
    </property>
    <property>
        <name>dfs.datanode.data.dir</name>
        <value>/data/tmp/hadoop/hdfs/data</value>
    </property>
    <property>
        <name>dfs.replication</name>
        <value>1</value>
    </property>
    <property>
        <name>dfs.permissions.enabled</name>
        <value>false</value>
    </property>
</configuration>
```

### 8.4 workers

```bash
echo "localhost" > workers
```

### 8.5 mapred-site.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <property>
        <name>mapreduce.framework.name</name>
        <value>yarn</value>
    </property>
    <property>
        <name>yarn.application.classpath</name>
        <value>/apps/hadoop/etc/hadoop:/apps/hadoop/share/hadoop/common/lib/*:/apps/hadoop/share/hadoop/common/*:/apps/hadoop/share/hadoop/hdfs:/apps/hadoop/share/hadoop/hdfs/lib/*:/apps/hadoop/share/hadoop/hdfs/*:/apps/hadoop/share/hadoop/mapreduce/*:/apps/hadoop/share/hadoop/yarn:/apps/hadoop/share/hadoop/yarn/lib/*:/apps/hadoop/share/hadoop/yarn/*</value>
    </property>
    <property>
        <name>mapreduce.map.memory.mb</name>
        <value>2048</value>
    </property>
</configuration>
```

### 8.6 yarn-site.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <property>
        <name>yarn.nodemanager.aux-services</name>
        <value>mapreduce_shuffle</value>
    </property>
    <property>
        <name>yarn.nodemanager.pmem-check-enabled</name>
        <value>false</value>
    </property>
    <property>
        <name>yarn.nodemanager.vmem-check-enabled</name>
        <value>false</value>
    </property>
    <property>
        <name>yarn.nodemanager.vmem-pmem-ratio</name>
        <value>4</value>
    </property>
</configuration>
```

### 8.7 创建数据目录

```bash
mkdir -p /data/tmp/hadoop/tmp
mkdir -p /data/tmp/hadoop/hdfs/name
mkdir -p /data/tmp/hadoop/hdfs/data
```

---

## 9. 格式化与启动集群

### 9.1 格式化 HDFS（仅一次）

```bash
hadoop namenode -format
```

> ⚠️ 不要重复执行。若误操作，清空 `/data/tmp/*` 后重新创建目录再格式化。

### 9.2 启动 HDFS 和 YARN

```bash
/apps/hadoop/sbin/start-dfs.sh
/apps/hadoop/sbin/start-yarn.sh
```

### 9.3 检查进程

```bash
jps
```

应看到：NameNode、DataNode、SecondaryNameNode、ResourceManager、NodeManager。

---

## 10. 运行 MapReduce 测试

```bash
cd /apps/hadoop/share/hadoop/mapreduce/
hadoop jar hadoop-mapreduce-examples-3.3.5.jar pi 3 3
```

日志显示 `Job job_xxx completed successfully`，并输出 `Estimated value of Pi is 3.55555555555555555556`，验证成功。

---

## 11. Web 界面

- HDFS：`http://localhost:9870`
- YARN：`http://localhost:8088`

---

## 12. 常用启停命令

```bash
# 启动
/apps/hadoop/sbin/start-dfs.sh
/apps/hadoop/sbin/start-yarn.sh

# 停止
/apps/hadoop/sbin/stop-dfs.sh
/apps/hadoop/sbin/stop-yarn.sh

# 一键启停
/apps/hadoop/sbin/start-all.sh
/apps/hadoop/sbin/stop-all.sh
```

---

## 13. 注意事项

- 修改 Hadoop 配置文件后，必须先停止集群，再重新启动，配置才会生效。
- 共享文件夹路径为 `/media/sf_share`，不能直接修改其权限，需复制到本地目录后再 `chown`。
- 建议为虚拟机创建快照，以便环境损坏时快速恢复。
- 遇到内存不足导致容器被杀，可在 `yarn-site.xml` 中关闭内存检查（已配置）。