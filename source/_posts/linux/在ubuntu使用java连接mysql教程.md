---
title: 在ubuntu使用java连接mysql教程
date: 2026-10-11 09:42:09
tags: [linux,java,mysql]
categories: 学习
---

借助docker进行连接

# 检查环境

检查java环境

```
java -version
javac -version
echo $JAVA_HOME
```

检查Mysql环境

```
mysql --version
systemctl status mysql
ss -tlnp | grep 3306
```

如果没有mysql，直接使用docker启动即可(最好配置好镜像源或者梯子)

```
sudo docker run -d \
  --name mysql8 \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=testdb \
  -p 3306:3306 \
  mysql:8
```

可以验证一下容器在运行且MySQL能接受连接

```
sudo docker ps
sudo docker exec -it mysql8 mysql -uroot -p123456 -e "SHOW DATABASES;"
```

让Mysql开机后自动启动

```
sudo docker update --restart=always mysql8
```

# 使用JDBC驱动jar连接java

因为JDK是1.8,所以用mysql-connector-j-8.0.33.jar

可以先装一下wget

```
sudo apt install wget -y
```

安装mysql-connector-j-8.0.33.jar

```
cd ~/Desktop
mkdir -p javatest
cd javatest
wget https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/8.0.33/mysql-connector-j-8.0.33.jar
```

使用
```
ls -lh mysql-connector-j-8.0.33.jar
```
验证是否成功，正常大小大概 2.4 MB 左右

在当前目录创建一个java文件
```
nano TestMySQL.java
```

可以粘贴这段程序
```
import java.sql.*;

public class TestMySQL {
    public static void main(String[] args) {
        String url = "jdbc:mysql://localhost:3306/testdb"
                + "?useSSL=false"
                + "&allowPublicKeyRetrieval=true"
                + "&serverTimezone=Asia/Shanghai"
                + "&characterEncoding=utf8";
        String user = "root";
        String password = "123456";

        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            System.out.println("找不到 JDBC 驱动，检查 jar 是否在 classpath");
            return;
        }

        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            System.out.println("连接成功！");

            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT VERSION()")) {
                if (rs.next()) {
                    System.out.println("MySQL 版本: " + rs.getString(1));
                }
            }

            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SHOW DATABASES")) {
                System.out.println("数据库列表:");
                while (rs.next()) {
                    System.out.println("  - " + rs.getString(1));
                }
            }
        } catch (SQLException e) {
            System.out.println("连接失败：");
            e.printStackTrace();
        }
    }
}
```

保存退出：Ctrl+O → Enter → Ctrl+X

之后进行编译
```
javac -cp mysql-connector-j-8.0.33.jar TestMySQL.java
```
运行

```
java -cp .:mysql-connector-j-8.0.33.jar TestMySQL
```

预期会输出

```
连接成功！
MySQL 版本: 8.0.xx
数据库列表:
  - information_schema
  - mysql
  - performance_schema
  - sys
  - testdb
```
# 常用指令

```
sudo docker ps                    # 查看运行中的容器
sudo docker logs -f mysql8        # 跟踪 MySQL 日志
sudo docker exec -it mysql8 mysql -uroot -p123456   # 进容器用 mysql 客户端
sudo docker stop mysql8           # 停止
sudo docker start mysql8          # 启动
sudo docker restart mysql8        # 重启
```