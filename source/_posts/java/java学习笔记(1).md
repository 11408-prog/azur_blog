---
title: java学习笔记(1)
date: 2026-10-07 15:31:10
tags: [java]
categories: 学习
---

# 2026.10.7
## 为什么java程序在运行的时候会生成一个.class文件

因为 Java 程序不是直接由操作系统执行的，而是由 JVM 执行的，而 JVM 只认 .class 字节码文件，不直接执行 .java 源代码。

## 为什么public static void main(String[] args)这一行不能把String[] args删掉

因为 String[] args 不是给你用的，是给 JVM 启动器用的。
JVM 启动 Java 程序时，必须找到一个固定签名的入口方法。

## 如果一个类被声明为 public（公共类），那么文件名必须和类名完全一致，连大小写都要一样。

## 什么是IDEA

一个专门运行java程序的软件