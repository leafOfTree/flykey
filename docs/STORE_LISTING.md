# Chrome Web Store 发布清单

已发布条目：[Flykey](https://chromewebstore.google.com/detail/flykey/ajmlimcpgjabfaodkdgmpkiipjbhpbag)（扩展 ID：`ajmlimcpgjabfaodkdgmpkiipjbhpbag`）。后续版本应更新这个条目，不要创建新条目。

## 建议商店文案

短描述（132 字符以内）：

> Navigate pages, tabs, history, and bookmarks efficiently with Vim-style keyboard shortcuts.

单一用途说明：

> Flykey provides keyboard-first navigation for web pages and browser tabs. Its history search, link hints, scrolling, bookmarking, and tab commands all support that single navigation purpose.

权限理由：

- `history`：用户主动打开命令面板时搜索本地浏览历史。
- `bookmarks`：用户主动执行收藏命令时创建书签。
- `sessions`：恢复用户最近关闭的标签页。
- `favicon`：为本地历史搜索结果显示站点图标。
- `clipboardWrite`：复制当前页面 URL 或标题。
- `activeTab`：用户点击工具栏图标后，读取当前网站并打开该标签页中的命令面板。
- `storage`：仅在 Chrome 本地保存用户选择停用 Flykey 的网站域名。
- 主机范围 `<all_urls>`：在用户访问的普通网页上提供键盘导航。代码不注入 Chrome 内部页面。

数据使用披露建议如实勾选“Web history”和“Website content”，用途选择核心功能；声明数据不出售、不用于广告、不用于信用或借贷，并遵守 Chrome Web Store Limited Use 要求。

## 首次提交（已完成）

首次上架时已完成以下事项，后续发版只需确认没有变化：

- [x] 隐私政策发布在公开 HTTPS 地址，支持渠道为 [GitHub Issues](https://github.com/leafOfTree/flykey/issues)。
- [x] 在开发者控制台填写隐私政策 URL、权限理由和单一用途说明。
- [x] 上传 `store-assets/screenshot-command-1280x800.png` 和 `store-assets/promo-small-440x280.png`。
- [ ] （可选）如需争取首页推荐，制作 1400×560 marquee 图。

## 每次发版

1. 同步更新 `manifest.json`、根 `package.json`、`frontend/package.json` 的版本号，并在 `CHANGELOG.md` 记录变更。
2. 执行 `npm ci` 后运行 `npm run package`。
3. 解压 `release/flykey-<version>.zip`，确认根目录直接包含 `manifest.json`，且没有 source map、测试、开发配置或远程代码。
4. 在稳定版 Chrome 的 `chrome://extensions` 以“加载已解压”方式冒烟测试：README 中的快捷键、工具栏开关、历史搜索和权限流程。
5. 提交版本变更并打标签：`git tag v<version>`，推送时带上 `--tags`。
6. 在现有 Flykey 条目的“Package”页选择“Upload New Package”，上传 ZIP，并检查控制台的权限差异提示；新增权限时同步更新权限理由、隐私披露、README 和 `PRIVACY.md`。
7. 核对商店文案、截图及隐私声明，提交审核；审核通过后确认已发布版本号。
