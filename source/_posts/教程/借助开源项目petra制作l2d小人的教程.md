---
title: 借助开源项目petra制作桌面l2d小人的教程
date: 2026-09-02 15:28:53
tags: [l2d,教程，桌宠]
categories: 学习
---

本教程借助github上的开源项目petra来实现，下载地址为
```
https://github.com/Wumiu/Petra/releases
```

# 制作PSD

PSD可以理解为将一张立绘按部件（头发、眼睛、身体等）拆分成独立图层的分层文件。

推荐使用：

```
https://huggingface.co/spaces/24yearsold/see-through-demo 
```

每天可以免费使用一次

如果从手机下载传到电脑上可能名称会变成一串数字，建议重新命名为一个后缀是psd的文件

# 调整

建议使用：

```
https://www.photopea.com/
```
由于一些原因，生成的psd的图层有时候会顺序混乱，例如不显示眼睛，或者帽子被拆成了两部分。这时候需要通过修图软件修改一下图层。

需要检查一下各图层的命名是否符合petra的文档要求的规范，否则在下一步可能会出现显示异常的问题

# 使用

在点开petra之后于模型设置部分导入修改好的psd即可


