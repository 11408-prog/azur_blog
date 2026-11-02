# 图片迁移：旧站 source/img → blog-v2/public/img
# 用 PowerShell 完成，因为 Node v25 在本机中文路径下 fs.cpSync 复制子目录会报 EIO。
$ErrorActionPreference = 'Stop'

$Src = 'C:\Users\ASUS\Desktop\blog\source\img'
$Dst = 'C:\Users\ASUS\Desktop\博客迁移\blog-v2\public\img'

if (-not (Test-Path -LiteralPath $Src)) {
    Write-Error "源图片目录不存在: $Src"
    exit 1
}

# 清空目标（幂等）
if (Test-Path -LiteralPath $Dst) {
    Get-ChildItem -LiteralPath $Dst -Force | Remove-Item -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $Dst -Force | Out-Null
}

Copy-Item -LiteralPath $Src -Destination $Dst -Recurse -Force
# Copy-Item 复制目录时会多套一层 img，拍平
$nested = Join-Path $Dst 'img'
if (Test-Path -LiteralPath $nested) {
    Get-ChildItem -LiteralPath $nested -Force | Move-Item -Destination $Dst -Force
    Remove-Item -LiteralPath $nested -Recurse -Force
}

$count = (Get-ChildItem -LiteralPath $Dst -Recurse -File).Count
Write-Host "图片迁移完成: $count 个文件 -> $Dst"
