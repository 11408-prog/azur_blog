---
title: 在宿主机连接虚拟机docker教程
date: 2026-10-12 18:49:38
tags: [docker,linux,ubuntu]
categories: 学习
---

本文章假定Linux虚拟机已经安装好了docker

# 在windows系统安装Docker CLI

```
winget install --id=Docker.DockerCLI -e
```

重启一个终端执行

```
# 安装 Docker CLI 后，重启 PowerShell 再执行
docker context create ubuntu-vm --docker "host=ssh://vboxuser@127.0.0.1:2222"
docker context use ubuntu-vm
docker ps
```

# 查看用户名和虚拟机IP

```
whoami
hostname -I
```

如果输出的是10.0.2.15 172.17.0.1 fd17:625c:f037:2:a00:27ff:fe12:5aea 。

在virtualbox中点开 高级 → 端口转发 → 添加一条规则：

名称	协议	主机 IP	主机端口	子系统 IP	子系统端口
SSH	TCP	留空	2222	留空	22

保存，启动虚拟机。

# 在ubuntu虚拟机确保SSH已开启

```
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
sudo systemctl status ssh
```

# 在终端执行

```
ssh -p 2222 vboxuser@127.0.0.1
```

输入密码就可以进去

第一次进入之后选项一定要输入yes,不能直接回车。执行

```
sudo usermod -aG docker vboxuser
exit
```

重新执行

```
ssh -p 2222 vboxuser@127.0.0.1
```

# 后续在windows powershell使用只需要启动虚拟机，执行

```
docker ps
docker images
docker run hello-world
```