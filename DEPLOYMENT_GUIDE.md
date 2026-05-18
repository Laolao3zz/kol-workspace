# 🚀 部署和更新指南

## 当前部署方式：GitHub + Vercel

你目前使用的是 **GitHub → Vercel** 自动部署流程，这是最佳实践！

---

## 📦 推送更新的完整流程

### 方式一：命令行推送（推荐）

```bash
# 1. 查看修改的文件
git status

# 2. 添加所有修改的文件
git add .

# 或者只添加特定文件
git add src/services/kolService.ts
git add src/hooks/useKolData.ts

# 3. 提交修改（写清楚改了什么）
git commit -m "优化：添加错误处理和自动重试机制"

# 4. 推送到 GitHub
git push origin main

# 5. Vercel 会自动检测到推送并开始部署
# 访问 https://vercel.com/dashboard 查看部署进度
```

### 方式二：使用 VS Code 图形界面

1. **查看修改**
   - 点击左侧 "Source Control" 图标（或按 `Ctrl+Shift+G`）
   - 查看所有修改的文件

2. **暂存文件**
   - 点击文件旁边的 `+` 号暂存单个文件
   - 或点击顶部的 `+` 暂存所有文件

3. **提交**
   - 在顶部输入框输入提交信息
   - 点击 `✓` 提交

4. **推送**
   - 点击 `...` 菜单
   - 选择 `Push`

---

## 🎯 快速推送脚本

创建一个快速推送脚本，简化操作：

### Windows (PowerShell)

创建文件 `deploy.ps1`：

```powershell
# 快速部署脚本
param(
    [string]$message = "更新代码"
)

Write-Host "📦 开始部署..." -ForegroundColor Green

# 添加所有修改
git add .

# 提交
git commit -m $message

# 推送
git push origin main

Write-Host "✅ 推送完成！Vercel 正在自动部署..." -ForegroundColor Green
Write-Host "🔗 访问 https://vercel.com/dashboard 查看部署进度" -ForegroundColor Cyan
```

使用方法：
```powershell
# 使用默认提交信息
.\deploy.ps1

# 自定义提交信息
.\deploy.ps1 -message "修复邀约删除后状态不更新的问题"
```

### macOS/Linux (Bash)

创建文件 `deploy.sh`：

```bash
#!/bin/bash

# 快速部署脚本
MESSAGE=${1:-"更新代码"}

echo "📦 开始部署..."

# 添加所有修改
git add .

# 提交
git commit -m "$MESSAGE"

# 推送
git push origin main

echo "✅ 推送完成！Vercel 正在自动部署..."
echo "🔗 访问 https://vercel.com/dashboard 查看部署进度"
```

使用方法：
```bash
# 添加执行权限（首次）
chmod +x deploy.sh

# 使用默认提交信息
./deploy.sh

# 自定义提交信息
./deploy.sh "修复邀约删除后状态不更新的问题"
```

---

## 📝 提交信息规范

好的提交信息让你更容易追踪修改历史：

```bash
# 格式：类型：简短描述

# 新功能
git commit -m "新增：错误日志系统"

# 修复 bug
git commit -m "修复：邀约删除后状态不更新"

# 优化改进
git commit -m "优化：添加自动重试机制，提升保存成功率"

# 重构代码
git commit -m "重构：简化 App.tsx，减少 60% 代码"

# 文档更新
git commit -m "文档：添加部署和更新指南"

# 样式调整
git commit -m "样式：统一按钮颜色和圆角"
```

---

## 🔄 Vercel 自动部署流程

### 1. 推送到 GitHub
```bash
git push origin main
```

### 2. Vercel 自动检测
- Vercel 监听 GitHub 仓库的 push 事件
- 自动触发构建流程

### 3. 构建过程
```
1. 拉取最新代码
2. 安装依赖 (npm install)
3. 运行构建 (npm run build)
4. 部署到 CDN
```

### 4. 部署完成
- 生成预览链接
- 自动更新生产环境
- 发送部署通知（如果配置了）

### 查看部署状态
访问：https://vercel.com/dashboard
- 查看部署历史
- 查看构建日志
- 回滚到之前的版本

---

## ⚡ 更快的工作流程

### 使用 Git 别名

在 `~/.gitconfig` 中添加：

```ini
[alias]
    # 快速提交并推送
    deploy = "!f() { git add . && git commit -m \"$1\" && git push origin main; }; f"
    
    # 查看状态
    st = status
    
    # 查看日志
    lg = log --oneline --graph --decorate
    
    # 撤销最后一次提交（保留修改）
    undo = reset --soft HEAD~1
```

使用方法：
```bash
# 快速部署
git deploy "修复邀约删除问题"

# 查看状态
git st

# 查看提交历史
git lg

# 撤销最后一次提交
git undo
```

---

## 🎨 VS Code 推荐扩展

安装这些扩展让 Git 操作更方便：

1. **GitLens** - 查看代码修改历史
2. **Git Graph** - 可视化 Git 历史
3. **GitHub Pull Requests** - 管理 PR

---

## 🔧 常见问题

### Q1: 推送失败怎么办？

```bash
# 先拉取最新代码
git pull origin main

# 如果有冲突，解决冲突后再推送
git push origin main
```

### Q2: 想撤销刚才的提交？

```bash
# 撤销最后一次提交（保留修改）
git reset --soft HEAD~1

# 撤销最后一次提交（丢弃修改）
git reset --hard HEAD~1
```

### Q3: 只想推送部分文件？

```bash
# 只添加特定文件
git add src/services/kolService.ts
git add src/hooks/useKolData.ts

# 提交并推送
git commit -m "优化 service 层"
git push origin main
```

### Q4: Vercel 部署失败？

1. 访问 Vercel Dashboard 查看错误日志
2. 常见原因：
   - 构建错误（TypeScript 类型错误）
   - 环境变量未配置
   - 依赖安装失败

3. 解决方法：
   - 本地运行 `npm run build` 检查是否有错误
   - 在 Vercel 中配置环境变量
   - 检查 `package.json` 依赖版本

### Q5: 如何回滚到之前的版本？

在 Vercel Dashboard：
1. 进入项目
2. 点击 "Deployments"
3. 找到之前的成功部署
4. 点击 "Promote to Production"

---

## 📊 推荐的工作流程

### 日常开发

```bash
# 1. 开始工作前，拉取最新代码
git pull origin main

# 2. 开发和测试
npm run dev

# 3. 完成后，查看修改
git status

# 4. 提交并推送
git add .
git commit -m "描述你的修改"
git push origin main

# 5. 在 Vercel 查看部署状态
# https://vercel.com/dashboard
```

### 重大更新

```bash
# 1. 创建新分支
git checkout -b feature/new-feature

# 2. 开发和测试
npm run dev

# 3. 提交到分支
git add .
git commit -m "新功能：XXX"
git push origin feature/new-feature

# 4. 在 GitHub 创建 Pull Request
# 5. 审查后合并到 main
# 6. Vercel 自动部署
```

---

## 🎯 本次优化的推送

针对本次优化，推荐这样推送：

```bash
# 1. 查看所有修改
git status

# 2. 添加所有新文件和修改
git add .

# 3. 提交（包含详细说明）
git commit -m "优化：修复保存失败和逻辑混乱问题

- 添加错误日志系统和自动重试机制
- 创建统一的数据管理 Hook (useKolData)
- 简化 App.tsx，减少 60% 代码
- 修复邀约删除后状态不更新的问题
- 添加数据验证和乐观更新
- 创建部署和健康检查脚本
- 更新文档和使用指南"

# 4. 推送到 GitHub
git push origin main

# 5. 访问 Vercel 查看部署
# https://vercel.com/dashboard
```

---

## 📱 移动端快速推送

如果你在手机上修改代码（使用 GitHub 网页版）：

1. 在 GitHub 网页上直接编辑文件
2. 填写提交信息
3. 点击 "Commit changes"
4. Vercel 自动部署

---

## 🔐 安全提示

### 不要提交敏感信息

确保 `.gitignore` 包含：

```
# 环境变量
.env
.env.local
.env.production

# 依赖
node_modules/

# 构建产物
dist/
build/

# 日志
*.log

# 系统文件
.DS_Store
Thumbs.db
```

### 检查是否泄露敏感信息

```bash
# 查看即将提交的内容
git diff --cached

# 如果不小心提交了敏感信息
git reset HEAD <file>
```

---

## 📚 相关资源

- [Git 官方文档](https://git-scm.com/doc)
- [Vercel 文档](https://vercel.com/docs)
- [GitHub 文档](https://docs.github.com)

---

**总结**：使用 `git add . && git commit -m "描述" && git push origin main` 就能快速推送更新，Vercel 会自动部署！
