# 快速部署脚本
param(
    [string]$message = "更新代码"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  📦 KOL 工作台 - 快速部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否有修改
$status = git status --porcelain
if ([string]::IsNullOrEmpty($status)) {
    Write-Host "⚠️  没有需要提交的修改" -ForegroundColor Yellow
    exit 0
}

Write-Host "📝 修改的文件：" -ForegroundColor Green
git status --short
Write-Host ""

# 添加所有修改
Write-Host "➕ 添加文件..." -ForegroundColor Green
git add .

# 提交
Write-Host "💾 提交修改..." -ForegroundColor Green
git commit -m $message

# 推送
Write-Host "🚀 推送到 GitHub..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ 推送成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Vercel 正在自动部署..." -ForegroundColor Cyan
    Write-Host "🔗 查看部署进度：https://vercel.com/dashboard" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⏱️  预计 1-2 分钟后部署完成" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ 推送失败！请检查错误信息" -ForegroundColor Red
    Write-Host ""
}
