# KOL 工作台 - 项目记忆

## 📍 项目信息

- **项目名称**：KOL Workspace（KOL 工作台）
- **本地路径**：`C:\Users\Administrator\Documents\GitHub\kol-workspace`
- **GitHub 仓库**：`https://github.com/Laolao3zz/kol-workspace`
- **部署平台**：Vercel（GitHub 自动部署，推送到 main 即自动部署）
- **数据库**：Supabase

---

## 🛠 技术栈

- React 18 + TypeScript + Vite
- Tailwind CSS
- Supabase（数据库 + 认证）
- @tanstack/react-table
- imapflow + mailparser（邮件同步）

---

## 📂 关键目录结构

```
src/
├── App.tsx                    # 主入口（已用 useKolData hook 简化）
├── types.ts                   # 全局类型定义
├── lib/supabase.ts           # Supabase 客户端
├── components/
│   ├── KolTable.tsx          # KOL 资源池视图
│   ├── KolDrawer.tsx         # KOL 详情抽屉（核心交互）
│   ├── ShipmentBoard.tsx     # 寄样进度看板
│   ├── AddInvitationModal.tsx
│   ├── AddShipmentModal.tsx
│   └── ...
├── services/                  # 数据库服务层（已加重试 + 验证）
│   ├── kolService.ts
│   ├── invitationService.ts
│   ├── shipmentService.ts
│   └── collaborationService.ts
├── hooks/
│   └── useKolData.ts         # 统一数据管理 hook（自定义）
└── utils/
    ├── kolStatus.ts          # KOL 状态推导逻辑
    ├── logger.ts             # 错误日志系统（自定义）
    └── retry.ts              # 自动重试机制（自定义）
```

---

## 🎯 核心业务逻辑

### KOL 状态流转

```
未首触 → 已邀约 → 待寄出 → 运输中 → 内容跟进 → 合作完成
                ↓                ↓
            拒绝合作         异常（暂停/异常）
            我方拒绝
```

### 邀约 → 寄样 自动化

**触发条件**（在 `KolDrawer.tsx` 的 `shouldCreateShipmentFromInvitation`）：
- `reply_result` = "同意合作"
- `decision` = "继续推进"

**自动行为**：
1. 自动创建一条"待寄出"的 shipment 记录
2. 更新 KOL status 为"待寄出"
3. 避免重复创建（检查同产品的待寄出记录）

### 状态推导优先级（`utils/kolStatus.ts`）

1. 寄样记录（最高优先级）
2. 合作记录
3. 邀约记录
4. 默认"未首触"

---

## 🔧 已完成的优化（v2.0.0）

### 1. 错误处理系统
- `utils/logger.ts` - 统一日志，记录 100 条错误历史
- `utils/retry.ts` - 自动重试（指数退避，最多 3 次）

### 2. 数据管理重构
- `hooks/useKolData.ts` - 集中管理 kols/invitations/shipments/collaborations
- 乐观更新（UI 立即响应，失败回滚）
- App.tsx 从 240 行缩减到 95 行

### 3. Service 层增强
- 所有 service 文件加入 retry + 验证 + 错误日志
- 数据验证规则（如：运输中必须有快递单号）

### 4. KolDrawer 增强
- 寄样保存前前端验证
- 详细 console.log 调试日志
- 修复邀约删除后状态不更新的问题

---

## ⚠️ 已知问题 & 待办

### 🟢 已修复
- ✅ 保存失败率高 → 加了重试机制
- ✅ 邀约删除后状态不更新 → 修复了刷新逻辑
- ✅ TypeScript 编译错误（retryOperation 类型）

### 🟡 待确认（需要用户测试反馈）
- ❓ 邀约选"已同意"后是否正确生成寄样记录（代码逻辑已正确，待实测）
- ❓ 新增寄样记录失败的具体场景（已加调试日志和前端验证）

### 🔴 长期优化建议（见 OPTIMIZATION_PLAN.md）
- 引入 React Query
- 清理数据库 Schema（移除 KOL 表的冗余字段：sample_product, sample_date, tracking_number, shipping_details, status）
- 简化 deriveKolStatus 推导逻辑
- 添加单元测试

---

## 💻 常用命令

```bash
# 开发
npm run dev                    # 启动开发服务器（http://localhost:5173）
npm run build                  # 构建生产版本

# 部署（推送即自动部署）
git add .
git commit -m "描述"
git push origin main

# 数据维护
npm run health-check           # 数据库健康检查
npm run health-fix             # 自动修复常见问题
npm run sync-emails            # 同步邮件
npm run repair:collaborations  # 修复错误分类的合作记录
```

---

## 🌍 环境变量（`.env.local`）

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 邮件同步（仅本地脚本用）
IMAP_HOST=
EMAIL_USER=
EMAIL_PASS=
```

---

## 📊 数据库表结构

- `kols` - KOL 主表
- `invitations` - 邀约记录（reply_result + decision 决定流转）
- `shipments` - 寄样记录（status + progress_status 双重状态）
- `collaborations` - 合作记录（发布数据）
- `emails` - 邮件记录

详见 `supabase-schema.sql`

---

## 🎨 UI 风格

- 主色调：blue/purple 渐变
- 状态徽章颜色映射在 `KolDrawer.tsx` 的 `statusLabel` 函数
- 卡片风格：圆角 + 阴影 + 左边色条

---

## 📝 提交习惯

- 提交信息用中文，格式：`类型：简短描述`
- 类型：新增 / 修复 / 优化 / 重构 / 文档 / 样式
- 重大改动用多行描述详细列出改动点

---

## 🔗 相关文档

- `OPTIMIZATION_PLAN.md` - 完整优化方案
- `README_OPTIMIZATION.md` - 优化说明
- `QUICK_START.md` - 快速开始
- `DEPLOYMENT_GUIDE.md` - 部署指南
- `BUGFIX_ANALYSIS.md` - Bug 分析报告

---

## 💡 给未来的 Claude

1. **直接在这个目录工作**，不要去 `C:\Users\Administrator\WorkBuddy\` 那边
2. **修改后直接 commit + push**，Vercel 自动部署
3. **遇到问题先看浏览器 console**，logger.ts 会输出详细日志
4. **状态推导是核心**，修改 `utils/kolStatus.ts` 要慎重
5. **service 层都用 retryOperation 包装**，新增数据库操作要保持这个模式
6. **邀约 → 寄样自动化在 KolDrawer.tsx**，不在 service 层
