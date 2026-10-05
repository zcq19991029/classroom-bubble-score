# 课堂气泡赋分系统（Classroom Bubble Score）

## 1. 项目概览

课堂气泡赋分系统是面向高职/中职教师课堂现场的可视化教学管理工具。它把学生表现记录为可交互气泡，并把加分、撤销、考勤、课程进度、成绩分析和操作历史集中到同一个教师工作区，解决纸质表格记录慢、搜索学生容易误加分、跨设备无法继续使用和历史记录难以追溯的问题。

目标用户是需要在课堂上快速记录表现、课后核对考勤与成绩的教师；管理员还可以通过一次性邀请码控制小范围教师注册。

## 2. 在线入口与源码

- Sites 线上版：[classroom-bubble-score.zcq991029.chatgpt.site](https://classroom-bubble-score.zcq991029.chatgpt.site)
- GitHub 源码：[zcq19991029/classroom-bubble-score](https://github.com/zcq19991029/classroom-bubble-score)
- Sites 当前发布：v23；源码最近文档提交：`c14b4f2`。

GitHub 负责源码、提交和发布审计；Sites Worker 负责线上页面、API 和 D1 数据。GitHub Pages 不是当前生产入口。

## 3. 主要发展阶段

1. **本地/公开演示阶段**：`index.html` 提供无需账号的本地浏览器演示，数据主要在 localStorage，适合体验气泡和基础评分。
2. **教师云端阶段**：增加 `cloud.html`、教师登录、多班级、云端工作区和 Supabase 兼容链路。
3. **Sites D1 迁移阶段（2026-09-28 至 09-30）**：建立 Worker/D1 持久化、账号会话、工号登录、迁移审计，并恢复为 Worker 入口，避免误发布成公开静态演示页。
4. **邀请码注册阶段（2026-10-05）**：移除对邮件注册的依赖，改为所有者管理员生成 24 小时一次性邀请码；邀请码只存哈希。
5. **界面与文档维护阶段（2026-10-06）**：修复管理员皇冠和版本号布局，重建项目文档，Sites 发布版本推进到 v23。

## 4. 当前已实现功能

### 课堂与评分

- 学生气泡展示、点击加分、双击撤销最近一次加分、拖动与碰撞动画。
- 按姓名、完整学号或学号后两位搜索；搜索时只显示匹配学生，降低误给隐藏学生加分的风险。
- 加分/减分、重力感应开关、当前课次选择和本节/学期视图。
- 操作日志保留学生、课次、变动值、来源和变动后总分。

### 考勤与课程

- 已签到、未到原因、请假、迟到、旷课和自定义考勤原因。
- 支持批量确认、清空某节记录、编辑个人记录；请假等状态需要确认保存并刷新回读。
- 课程可按真实日期、单双周、星期和节次配置，连续节次可以合并为一次考勤。
- 课程进度以实际课次为准，支持导入或手动调整，避免把周次直接当作授课次数。

### 账号、数据与管理

- 教师账号登录、会话 Cookie、密码哈希、工号登录和教师资料同步。
- 所有者管理员标识、管理员皇冠和一次性邀请码生成入口。
- 邀请码有效期 24 小时、每个只能使用一次、普通教师不能生成，D1 仅保存邀请码哈希。
- 多班级按教师账号隔离，支持刷新和换设备读取同一云端工作区。
- JSON 备份导入/导出、迁移前快照和 `migration_audit` 审计。
- 成绩后台、课程进度、综合排名和操作记录。

## 5. 技术栈与运行环境

- 前端：原生 HTML、CSS、JavaScript；`cloud.html` 是云端教师入口，`index.html` 是本地/公开演示入口。
- 服务端：Cloudflare Worker 风格 ESM；源代码为 `worker/index.js`。
- 数据库：Sites 绑定的 Cloudflare D1，绑定名 `DB`。
- 认证：Worker 自建教师表、PBKDF2 密码哈希、哈希会话 Cookie；Supabase 登录仅作为历史兼容/迁移路径。
- 构建：Windows PowerShell、Node.js，运行 `node scripts/build-worker.mjs` 生成 `dist/server/index.js`。
- 资源：XLSX 解析库 `xlsx.full.min.js`、校徽背景和 `assets/` 展示资源。

## 6. 目录结构与关键入口

```text
classroom-bubble-score/
├─ cloud.html                 Sites 教师云端页面
├─ d1-cloud.js                D1 前端 API 桥接、登录、资料、邀请码和工作区同步
├─ index.html                 本地/公开演示版
├─ worker/index.js             Worker 路由、认证、邀请码、D1 读写和静态资源服务
├─ scripts/build-worker.mjs    将前端资源嵌入 Worker，生成 dist/server/index.js
├─ dist/server/index.js        当前 Sites Worker 发布产物
├─ .openai/hosting.json        Sites project_id 与 D1 绑定配置
├─ drizzle/                    D1/Drizzle 建表迁移
├─ migration/                  迁移说明与备份校验记录
├─ skills/README.md            项目专属维护入口
├─ README.md                   长期项目档案
├─ 项目交接.md                 当前阶段交接信息
├─ 一键启动课堂加分系统.cmd   打开线上 Sites 地址
├─ version.json                页面版本标记
├─ assets/                     README 与展示资源
└─ supabase-*.js/sql           历史兼容/迁移资料，不代表当前权威数据源
```

## 7. 本地启动、构建、测试与部署

### 打开线上版本

双击 `一键启动课堂加分系统.cmd`，或直接打开 Sites 地址。

### 构建 Worker

```powershell
node scripts/build-worker.mjs
```

构建后必须检查 `dist/server/index.js` 已更新；不能只修改 `worker/index.js` 就发布。

### 基础检查

```powershell
git diff --check
git status --short
```

涉及前端脚本时，还应做 JavaScript 语法检查和实际浏览器回归。涉及数据时先只读检查 `/api/health`、D1 表和工作区汇总。

### Sites 发布顺序

构建 Worker → 推送完整源码提交 → 用同一 SHA 生成归档 → `save_site_version` → 核对返回的 `source.commit_sha` → `deploy_site_version` → 用缓存破坏参数检查线上 HTML、版本文件、Worker API 和 D1 读写。

## 8. 已完成的发布记录

仓库提交历史确认了以下阶段：

- `43b5f2e`：切换课堂云端持久化到 Sites D1；
- `8f3ca66`：完成 D1 切换和发布版本；
- `fcfd070`：恢复 Sites Worker 入口；
- `d823a3f`、`9db2721`：加入一次性邀请码注册 Worker；
- `40b0e45`：修复完整版本号显示；
- `c878c95`：修复管理员皇冠布局；
- `764f759`：更新仓库 README；
- `c14b4f2`：新增项目交接文档。

Sites v21、v22、v23 的发布状态在本次整理前已由 Sites 返回成功；具体版本内容以 Git SHA 和 Sites 保存版本为准。

## 9. 已验证与未验证

### 已验证

- GitHub `origin/main` 已包含最近文档提交 `c14b4f2`。
- Sites Worker 能构建，发布流程能返回成功状态。
- 线上 `version.json` 曾核对到 `2026-10-06 01:57 / 20261006-0157`。
- D1 Worker 路由、邀请码规则、资料 API、工作区读写和迁移审计代码存在。
- 版本号显示和管理员皇冠相关修复已进入发布产物。

### 尚未从当前文件完整验证

- 没有在本次文档重建中使用真实教师账号重新走完登录、注册、邀请码重复使用和资料保存全流程。
- 没有在本次文档重建中重新核对 D1 线上实际表行数、所有班级学生数和历史日志数量。
- 真实平板重力感应、不同浏览器缓存和全部考勤组合尚未逐项复测。
- 当前仓库中历史归档 tar.gz 的每个版本与线上版本的精确对应关系，无法仅凭文件名完全确认。

## 10. 依赖、限制与后续方向

外部依赖包括 Sites、Cloudflare D1、GitHub 源码仓库和浏览器运行环境；旧 Supabase 配置只用于兼容/迁移，是否彻底移除需另行确认数据安全和回滚方案。

后续可继续完善：管理员用户管理和邀请码撤销、D1 管理查询页、完整自动化浏览器回归、真实设备考勤测试、数据导出校验报告，以及将历史归档与 Sites 版本建立明确映射。

本 README 只记录从当前文件和 Git 历史确认的事实；无法确认的历史均已明确标注。
