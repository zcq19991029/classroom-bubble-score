# 课堂气泡赋分系统｜项目维护入口

这是课堂教师用的气泡赋分、考勤、课程进度与历史记录系统。线上版本由 Sites Worker 提供，数据绑定 D1 `DB`；GitHub 只保存源码和发布审计。

## 共享规范

- [课堂气泡系统维护](../../skills/classroom-bubble-maintainer/SKILL.md)
- [Sites 应用维护](../../skills/sites-app-maintainer/SKILL.md)

## 当前架构

- Sites 地址：<https://classroom-bubble-score.zcq991029.chatgpt.site>
- Worker + D1 绑定：`DB`
- Supabase：仅兼容/迁移用途，不能作为当前线上权威来源。
- 用户数据按教师账号隔离；浏览器缓存只作回退，不代替云端保存。

## 账号与邀请码

- 只有所有者管理员可以生成邀请码；普通教师没有生成权限。
- 邀请码 24 小时有效，每个只能使用一次；D1 只保存哈希，不保存明文。
- 姓名、头像文字、工号通过 Worker API 保存；工号必须唯一；管理员标识来自 `teachers` 记录。

## D1 表用途

`teachers`（账号/工号/密码哈希/管理员与资料）、`sessions`（会话）、`workspaces`（班级/成绩/考勤/课程进度/操作记录）、`invite_codes`（邀请码状态）、`migration_audit`（迁移审计）。

## 发布前验收

1. 先检查 D1 健康状态、当前班级汇总和迁移审计。
2. 修改 Worker 后必须构建 `dist/server/index.js`。
3. 按共享 Sites skill 用同一完整 SHA 完成构建、推送、归档、`save_site_version`、SHA 核对、`deploy_site_version`。
4. 用缓存破坏参数核对线上 HTML、版本文件、登录/邀请码 API、D1 读写和实际版本号。

## 已知风险与验收顺序

- 旧 `dist/server/index.js` 会让线上仍显示旧版本；构建产物与源码必须同 SHA。
- 错误的 `static.directory=dist` 可能把站点变成公开演示页；必须验证 Worker 根路由和登录入口。
- 旧浏览器缓存不能证明部署失败；用新版本参数和实际 API 响应复核。
- 考勤只有在已签到、未到原因、请假/早退、确认保存和刷新回读都通过后才算完成。
- 不在此入口或仓库写入密码、API key、Sites token 或明文邀请码。
