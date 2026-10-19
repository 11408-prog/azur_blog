---
title: Arch Linux + Hyprland 配置操作留档
date: 2026-10-18 11:05:44
tags: [linux,arch,Hyprland]
categories: 学习
---

# Arch Linux + Hyprland 配置操作留档

## 1. 系统信息与环境基础

- **虚拟机软件**：VirtualBox 7.2.6
- **宿主机系统**：Windows (通过 SSH 远程连接并操作虚拟机)
- **Arch Linux 内核**：7.2.11-arch1-1
- **用户名**：`lyh`
- **主机名**：`archlinux`
- **桌面环境**：Hyprland (Wayland 协议) + Waybar + Kitty
- **网络模式**：VirtualBox NAT（配置端口转发 2223 -> 22）
- **当前分辨率**：1920x1080@60Hz (图形控制器 VBoxVGA)
- **虚拟机内存**：8GB (建议 4GB 以上，否则跑图形界面容易卡)

---

## 2. 基础系统安装避坑指南 (全程 UEFI 模式)

### 2.1 关键步骤
- **分区**：`/dev/sda1` (512M, EFI System), `/dev/sda2` (剩余空间, ext4)
- **挂载与安装**：
  ```bash
  mount /dev/sda2 /mnt
  mkdir -p /mnt/boot && mount /dev/sda1 /mnt/boot
  pacstrap -K /mnt base base-devel linux linux-firmware vim networkmanager grub efibootmgr
  ```
- **生成 fstab 与切入新系统**：
  ```bash
  genfstab -U /mnt >> /mnt/etc/fstab
  arch-chroot /mnt
  ```
- **设置时区、语言与用户**：
  ```bash
  ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
  hwclock --systohc
  echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && locale-gen
  echo "LANG=en_US.UTF-8" > /etc/locale.conf
  passwd  # 设置 root 密码
  useradd -m -G wheel -s /bin/bash lyh
  passwd lyh
  EDITOR=nano visudo  # 取消注释 %wheel ALL=(ALL:ALL) ALL
  systemctl enable NetworkManager
  ```
- **安装 GRUB**：
  ```bash
  grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=GRUB
  grub-mkconfig -o /boot/grub/grub.cfg
  ```

### 2.2 ⚠️ 注意事项
- 软件包名严格区分大小写：是 `networkmanager`（全小写），而不是 `NetworkManager`。
- VirtualBox 的 `xf86-video-vmware` 驱动已在 Arch 官方源移除，不要强行安装，直接装 `mesa` 即可。

---

## 3. SSH 远程连接 (宿主机 Windows -> 虚拟机 Arch)

这是解决 Wayland 虚拟机遇上剪贴板失效的最佳“逃课”方案。

### 3.1 VirtualBox 端口转发配置
- 设置 -> 网络 -> 网卡1 (NAT) -> 高级 -> 端口转发
- 添加规则：主机端口 `2223` -> 子系统端口 `22`

### 3.2 宿主机连接命令
```powershell
ssh lyh@127.0.0.1 -p 2223
```

### 3.3 SSH 下的 Wayland 环境变量修复 (核心难点)
在 SSH 会话中运行 `hyprctl` 或图形程序，必须临时导入环境变量：
```bash
export HYPRLAND_INSTANCE_SIGNATURE=$(systemctl --user show-environment | sed -n 's/^HYPRLAND_INSTANCE_SIGNATURE=//p')
export WAYLAND_DISPLAY=$(systemctl --user show-environment | sed -n 's/^WAYLAND_DISPLAY=//p')
```
*(可选：将这两行追加到 `~/.bashrc` 实现永久生效)*

---

## 4. 图形界面与 Hyprland 安装

### 4.1 VirtualBox 专属显示设置 (必做)
- **关闭虚拟机**，设置 -> 显示：
  - 图形控制器：**VBoxVGA**
  - 显存大小：**128 MB**
  - 取消勾选 3D 加速（若后续卡顿可尝试开启）
- 若黑屏，进入 TTY (`Ctrl + Alt + F2`)，执行 `Hyprland` 排查。

### 4.2 安装核心组件
```bash
sudo pacman -Syu --noconfirm
sudo pacman -S mesa virtualbox-guest-utils polkit hyprland kitty waybar wofi ttf-jetbrains-mono-nerd
sudo pacman -S hyprpolkitagent  # 解决认证代理问题
```

### 4.3 解决分辨率异常 (分辨率只有 920x910 问题)
- 查找真实显示器名称：`hyprctl monitors` (发现名称是 `VGA-1` 而不是 `Virtual-1`)
- 修改配置文件 `~/.config/hypr/hyprland.conf`：
  ```ini
  monitor = VGA-1, 1920x1080@60, 0x0, 1
  ```
- 重新加载配置：`hyprctl reload`

---

## 5. 桌面美化与体验优化

### 5.1 Hyprland 基础快捷键配置
追加至 `~/.config/hypr/hyprland.conf`：
```ini
$mod = SUPER
exec-once = waybar
exec-once = kitty
exec-once = /usr/lib/hyprpolkitagent/hyprpolkitagent

bind = $mod, Q, killactive,
bind = $mod, Return, exec, kitty
bind = $mod, D, exec, wofi --show drun
bind = $mod, F, fullscreen,
bind = $mod, M, exit,
bind = $mod, left, movefocus, l
bind = $mod, right, movefocus, r
bind = $mod, up, movefocus, u
bind = $mod, down, movefocus, d
```
*(注：若 VirtualBox 捕获 Win 键，可将 `$mod` 改为 `ALT`)*

### 5.2 壁纸设置 (`awww` 替代方案)
- Arch 官方源中叫 `awww`，不要和 `swww` 混淆。
```bash
sudo pacman -S awww
mkdir -p ~/.cache/awww  # 解决 WARN 缓存目录丢失警告
awww-daemon &
sleep 1
awww img ~/Pictures/wallpapers/file.jpg --transition-type wipe --transition-fps 60
```
- **开机自启配置**：
  ```ini
  exec-once = awww-daemon
  exec-once = sleep 2 && awww img ~/Pictures/wallpapers/file.jpg
  ```

### 5.3 Kitty 终端透明化与字体
修改 `~/.config/kitty/kitty.conf`：
```conf
font_family JetBrainsMono Nerd Font
font_size 12
background_opacity 0.85
background_blur 20
foreground #e5e9f0
```

### 5.4 Waybar 极简/粉彩风格 (对应浅色壁纸)
写入 `~/.config/waybar/style.css`：
```css
window#waybar {
    background: rgba(255, 255, 255, 0.7);
    color: #4c566a;
    border-bottom: 2px solid rgba(138, 180, 248, 0.4);
}
#workspaces button.active {
    color: #5e81ac;
    border-bottom: 2px solid #5e81ac;
}
#clock { color: #b48ead; font-weight: bold; }
/* 其他模块配合背景色调整... */
```
重启 Waybar：`killall waybar && waybar &`

---

## 6.常用操作

1.使用ssh连接虚拟机:在终端输入`ssh lyh@127.0.0.1 -p 2223`

## 7. 常见问题与避坑记录 (踩坑大全)

1. **`polkit.service` 无法 enable**：提示是静态单元，对于 Hyprland，安装并自启 `hyprpolkitagent` 即可。
2. **`reflector` 更换国内源后大面积 404**：手动 `sed` 拼接 `mirrorlist` 时容易因为转义字符 `$` 导致语法错误。推荐直接下载清华源官方配置：
   `sudo curl -o /etc/pacman.d/mirrorlist "https://mirrors.tuna.tsinghua.edu.cn/help/archlinux/mirrorlist.txt"`
3. **Hyprland 配置文件语法报错**：`=` 两边**必须留有空格**，例如 `monitor = VGA-1, 1920x1080@60, 0x0, 1`。一旦报错，Hyprland 会顶栏红字警告并忽略后续配置。
4. **SSH 下无法执行图形程序**：报 `no DISPLAY environment variable specified`。必须按照 3.3 节的步骤导入环境变量。
5. **剪贴板互通问题**：VirtualBox 的增强功能对 Wayland 剪贴板支持极差，折腾 `clipboard-sync` 编译容易失败。**终极解法**：直接在宿主机 (Windows) 通过 SSH 控制，鼠标右键即可粘贴，快速且优雅。

---

## 8. 后续待办 (TODO)

- [ ] 配置 Fcitx5 中文输入法。
- [ ] 安装浏览器 (`firefox`) 与文件管理器 (`dolphin`)。
- [ ] 使用 `matugen` 或 `pywal` 从壁纸自动提取颜色，动态生成主题。
- [ ] 配置 `hyprlock` (锁屏) 和 `hypridle` (挂机自动锁屏)。
- [ ] 学习使用 `yay` 安装 AUR 软件。