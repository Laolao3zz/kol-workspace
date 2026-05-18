#!/bin/bash

# 快速部署脚本
MESSAGE=${1:-"更新代码"}

echo ""
echo "========================================"
echo "  📦 KOL 工作台 - 快速部署"
echo "========================================"
echo ""

# 检查是否有修改
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  没有需要提交的修改"
    exit 0
fi

echo "📝 修改的文件："
git status --short
echo ""

# 添加所有修改
echo "➕ 添加文件..."
git add .

# 提交
echo "💾 提交修改..."
git commit -m "$MESSAGE"

# 推送
echo "🚀 推送到 GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  ✅ 推送成功！"
    echo "========================================"
    echo ""
    echo "📊 Vercel 正在自动部署..."
    echo "🔗 查看部署进度：https://vercel.com/dashboard"
    echo ""
    echo "⏱️  预计 1-2 分钟后部署完成"
    echo ""
else
    echo ""
    echo "❌ 推送失败！请检查错误信息"
    echo ""
fi
