# 🌸 加油毕业工作台

> 实验 · 专利 · 就业 · 论文，一站式工作台
> 轻可爱 · 莫兰迪色 · 圆角 · PWA 可安装到手机桌面 · Markdown 本地存储 + 可选 Supabase 云同步

## ✨ 特性

- **📱 桌面 + 安卓双端**：纯前端 PWA，浏览器打开即可，电脑和手机同一份代码
- **🏠 可添加到桌面**：安卓 Chrome → 菜单 → "添加到主屏幕"，像原生 App 一样使用
- **💾 数据本地优先**：所有记录以 Markdown 格式导出，可一键导出到本地文件夹
- **☁️ 可选云同步**：内置 Supabase 集成，手机和电脑实时同步
- **🎨 莫兰迪色系**：柔和低饱和度，圆角 + 思源圆体 + 轻量动效
- **📅 全局日历**：任意年月切换，模块专属彩色圆环，多模块同一天自动叠加多色

## 🗂 模块结构

```
🔬 实验进度
   ├ 锡球实验（有色 / 无色）
   ├ 锡膏实验（有色 / 无色）
   └ 原料标签档案
📜 专利进度
   ├ 专利资料库（AI 解析创新点）
   ├ 创新点记录
   └ 我的专利进度（时间线）
💼 就业进度
   ├ 学习（柱状图统计）
   ├ 相关公司（省份切换）
   ├ 我的简历（文件上传）
   └ 招聘会（月历日程）
📄 论文进度（时间线）
```

## 🚀 启动方式

### 方式 A：直接打开（最简单）

双击 `index.html` 即可在浏览器打开。

### 方式 B：本地服务器（推荐 PWA / 同步功能）

```bash
# 进入项目目录
cd graduation-workbench

# 任意一种
python -m http.server 8080
# 或
npx serve -p 8080
```

浏览器打开 `http://localhost:8080`。

### 方式 C：手机访问

电脑和手机连同一个 Wi-Fi，电脑查看本机 IP（如 `192.168.1.10`），手机浏览器访问 `http://192.168.1.10:8080`。

**添加到桌面**：安卓 Chrome → 右上角菜单 → "添加到主屏幕" → 桌面会出现"加油毕业工作台"图标，点击像 App 一样启动。

## ☁️ Supabase 云同步（可选）

> Supabase 免费额度：500MB 数据库 + 1GB 流量 + 50,000 月活，完全够个人使用

### 1. 创建 Supabase 项目

1. 打开 https://supabase.com 注册
2. 新建一个项目（地区选离你最近的）
3. 进入项目 → Settings → API，复制：
   - **Project URL**（形如 `https://xxxxx.supabase.co`）
   - **anon public key**（一长串 JWT）

### 2. 建表

进入项目 → SQL Editor → 新建查询，复制 `app.js` 中 `SUPABASE_SQL` 的全部内容执行。

（或打开工作台 → 设置 → Supabase 同步，弹窗中也有完整 SQL 可复制）

### 3. 配置

打开工作台 → 左下角「设置 · Supabase 同步」→ 填入 URL 与 Key → 测试连接 → 保存。

之后点击右上角 ⟳ 即可一键全量同步（推 + 拉）。

## 💾 本地 Markdown 导出

左下角「📥 导出全部 Markdown」：
- Chrome / Edge：会弹出"选择文件夹"对话框，可直接保存为文件夹结构（每个模块一个子目录）
- 其他浏览器：会下载单个 `.md` 文件，包含全部记录

每条记录都以标准 Markdown 格式保存，含 YAML 风格的元信息头。

## 🧰 技术栈

- 纯静态 HTML / CSS / 原生 JavaScript（无构建步骤）
- 哈希路由（hash-based router）
- localStorage 缓存 + Markdown 导出
- Service Worker 离线 PWA
- @supabase/supabase-js（CDN 懒加载）
- Google Fonts：Nunito / Quicksand / ZCOOL KuaiLe / Noto Sans SC

## 📁 目录结构

```
graduation-workbench/
├── index.html              # 入口
├── manifest.json           # PWA 清单
├── sw.js                   # Service Worker
├── css/
│   └── style.css           # 主题 & 布局
├── js/
│   ├── app.js              # 主入口
│   ├── router.js           # 路由
│   ├── storage.js          # 本地存储 & Markdown
│   ├── supabase-sync.js    # 云端同步
│   ├── calendar.js         # 日历组件
│   ├── ui.js               # UI 工具
│   └── modules/
│       ├── home.js
│       ├── experiment.js
│       ├── patent.js
│       ├── employment.js
│       └── paper.js
└── icons/
    ├── icon.svg
    ├── icon-192.png
    └── icon-512.png
```

## 📝 数据示例

```markdown
# 锡球有色实验 #2026-08-01

- **模块**: exp-tinball-color
- **日期**: 2026-08-01
- **标签**: 溶剂、松香
- **创建时间**: 2026-08-01T09:21:00Z
- **更新时间**: 2026-08-01T18:30:00Z

---

## 今日实验构想
尝试松香基活性剂复配方案 A，添加 0.3% 有机胺缓蚀剂。

## 实验结果
焊点光泽度良好，铺展率 82%。

## 原因分析
缓蚀剂有效抑制了高温氧化。

## 明日安排
继续调整活性剂比例到 0.35%。
```

---

加油毕业 🌸
