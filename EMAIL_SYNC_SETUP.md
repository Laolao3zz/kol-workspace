# 邮件自动同步部署指南

## 架构

- **Cron 触发**：Vercel Cron Jobs（`vercel.json` 的 `crons` 字段）
- **执行环境**：Vercel Serverless Function（Node 18+，`api/sync-emails.mjs`）
- **核心逻辑**：`api/_lib/emailSync.mjs`，CLI 脚本和 Cron 路由共用
- **频率**：每天 UTC 01:00 / 北京时间 09:00（Hobby 计划上限是每天 1 次，Pro 才能更高频）

## 一次性配置

### 1. Vercel 环境变量

进入 Vercel Dashboard → 项目 → Settings → Environment Variables，添加：

| 变量名 | 必填 | 说明 |
|---|---|---|
| `EMAIL_USER` | 是 | IMAP 用户名（一般是邮箱地址）|
| `EMAIL_PASS` | 是 | IMAP 密码 / 授权码 |
| `IMAP_HOST` | 否 | 默认 `imap.qiye.aliyun.com` |
| `IMAP_PORT` | 否 | 默认 `993` |
| `EMAIL_INBOX_FOLDERS` | 否 | 默认 `INBOX`，多个用逗号分隔 |
| `EMAIL_SENT_FOLDERS` | 否 | 默认 `Sent Messages,INBOX.Sent,Sent,已发送,已发送邮件` |
| `EMAIL_SYNC_DAYS` | 否 | 每次回扫天数，默认 90 |
| `CRON_SECRET` | 强烈建议 | 任意长字符串，Vercel Cron 会自动带上 `Authorization: Bearer <secret>`。不配置则路由公开可调 |
| `VITE_SUPABASE_URL` | 已有 | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | 已有 | Supabase anon key |

> 三个 Environment 都要勾上：Production、Preview、Development。

### 2. 部署

`vercel.json` 的 `crons` 必须随主分支部署到 **Production** 才会被注册。push 到 main 触发部署后，Vercel Dashboard → Settings → Cron Jobs 应能看到 `/api/sync-emails` 这一条。

## 验证

### 手动 ping 一次

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/sync-emails
```

成功响应：

```json
{
  "ok": true,
  "durationMs": 12345,
  "stats": {
    "scanned": 50,
    "matched": 8,
    "synced": 8,
    "skippedDuplicate": 42,
    "skippedUnmatched": 0,
    "insertFailed": 0,
    "folders": [...]
  }
}
```

### 看 Cron 历史

Vercel Dashboard → 项目 → Cron Jobs → 点 `/api/sync-emails` 看每次执行的状态和日志。

## 修改频率

`vercel.json`：

```json
"crons": [
  { "path": "/api/sync-emails", "schedule": "0 1 * * *" }
]
```

`schedule` 是 UTC 时区的 5 段 cron。常用：

- `0 1 * * *` 每天 UTC 01:00（北京 09:00）— 当前值
- `0 */6 * * *` 每 6 小时一次（仅 Pro）
- `0 1,13 * * *` 每天 UTC 01:00 和 13:00（仅 Pro）

> Hobby 计划：每个项目最多 2 个 cron，频率最高每天 1 次。

## 安全注意

- `CRON_SECRET` 务必配置，否则路由是公开的，任何人都能触发同步消耗你的函数额度
- `EMAIL_PASS` 用 IMAP **授权码**而不是邮箱登录密码（阿里云邮箱在"客户端独立密码"里生成）
- 邮件 body 截断到 5000 字符存入 Supabase，避免单行过大

## 故障排查

| 现象 | 排查 |
|---|---|
| 401 Unauthorized | `CRON_SECRET` 没配或拼错 |
| 500 + "缺少环境变量" | 漏配 EMAIL_USER / EMAIL_PASS / SUPABASE 任一项 |
| 500 + IMAP 连接错误 | 邮箱服务商可能要求开"IMAP 协议"开关或客户端独立密码 |
| 同步成功但 synced=0 | KOL 邮箱大小写不匹配？脚本已统一 toLowerCase，但建表时如果有空格要清 |
| 函数 5 分钟超时 | 邮件量太大，调小 `EMAIL_SYNC_DAYS`，或升级 Pro 提高 maxDuration |

## 本地测试

仍可用 CLI：

```bash
npm run sync-emails
```

CLI 和 Cron 共享 `api/_lib/emailSync.mjs`，行为一致。
