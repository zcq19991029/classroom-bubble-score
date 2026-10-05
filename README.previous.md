# 课堂气泡赋分系统

面向教师课堂的气泡赋分、考勤、课程进度、成绩分析和历史记录系统。

## 在线使用

- Sites 线上版：<https://classroom-bubble-score.zcq991029.chatgpt.site>
- GitHub 源码：<https://github.com/zcq19991029/classroom-bubble-score>
- 当前发布版本：2026-10-06 01:57（Sites v22）

GitHub 用于源码和版本审计，Sites 用于线上运行；不要把 GitHub Pages 当作生产入口。

## 当前功能

- 教师账号登录、资料同步、管理员身份标识和管理员皇冠。
- 所有者管理员生成一次性邀请码：24 小时有效、每个邀请码只能使用一次，邀请码只保存哈希。
- 多班级云端保存，按教师账号隔离；支持刷新、换设备后读取云端数据。
- 气泡加分、撤销、搜索保护，搜索时只显示匹配学生，避免误给后续学生加分。
- 考勤支持已签到、未到原因、请假、迟到、旷课和自定义考勤原因。
- 课程按真实日期、单双周、星期和节次管理，支持连续节次合并。
- 成绩后台、操作日志、课程进度、JSON 备份导入导出和迁移审计。

## 数据架构

线上采用 Sites Worker + D1，绑定名为 `DB`。主要数据表：

- `teachers`：教师账号、工号、密码哈希、资料和管理员标识；
- `sessions`：登录会话；
- `workspaces`：班级、成绩、考勤、课程进度和操作记录；
- `invite_codes`：邀请码哈希、有效期和使用状态；
- `migration_audit`：数据迁移审计。

Supabase 文件仍保留作兼容/迁移参考，不是当前 Sites 线上权威数据源。

## 本地开发与发布

```text
node scripts/build-worker.mjs
```

Worker 修改后必须重新生成 `dist/server/index.js`，然后以同一完整 Git SHA 完成推送、归档、Sites 保存版本和部署。发布后要用缓存破坏参数检查实际 HTML、版本文件、Worker API、D1 读写和版本号。

项目内部维护入口：[skills/README.md](skills/README.md)。父目录共享规范位于 `..\\skills`。

## 安全说明

仓库不得提交真实学生名单、成绩备份、密码、会话令牌、API key、Sites token 或明文邀请码。正式数据以 D1 为准，浏览器缓存只作回退。
