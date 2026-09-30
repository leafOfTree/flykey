# Chrome Web Store 发布清单

已发布条目：[Flykey](https://chromewebstore.google.com/detail/flykey/ajmlimcpgjabfaodkdgmpkiipjbhpbag)（扩展 ID：`ajmlimcpgjabfaodkdgmpkiipjbhpbag`）。后续版本应更新这个条目，不要创建新条目。

## 建议商店文案

短描述（132 字符以内，取自 `manifest.json` 的 `description`）：

> 用 Vim 风格快捷键高效浏览网页、切换标签页、搜索历史记录和添加书签。

商店条目的默认语言设为“中文（简体）”。

详细描述（直接粘贴到商店“Description”，纯文本）：

```text
Flykey 把浏览器交给键盘。用简短的 Vim 风格快捷键滚动网页、打开链接、搜索历史记录和管理标签页，全程无需鼠标。

【链接提示】
按 f，页面上每个链接和按钮都会出现短标签，输入标签即可打开。提示只出现在真正可见的元素上，滚动容器里的链接也能准确定位。

【命令面板】
按 o 打开命令面板，边输入边筛选最近访问的网页，匹配文字高亮显示，回车即可打开。输入前缀可以直接搜索指定网站：h 搜索 GitHub，y 搜索 YouTube，s 搜索 Stack Overflow，w 搜索 Wikipedia，c 搜索 GitCode。

【页面导航】
• j / k 向下 / 向上滚动，按住可连续滚动
• gg / G 跳到页面顶部 / 底部
• w / e 后退 / 前进
• [ / ] 上一页 / 下一页
• gh / gu 回到网站根路径 / 上一级路径
• i 聚焦第一个可见输入框

【标签页与工具】
• t 新建标签页，d 关闭当前标签页，u 恢复最近关闭的标签页
• h / l 切换到上一个 / 下一个标签页，gx 关闭其他非固定标签页
• b 收藏当前页面，y / Y 复制页面 URL / 标题
• s 朗读选中文字或当前可见正文，再按一次结束
• ? 打开内置快捷键与使用帮助

【不打扰正常使用】
在输入框中打字时，Flykey 会自动让出按键，按 Esc 回到普通模式。点击工具栏图标可以按网站启用或停用；按 ; 可临时暂停当前页面，刷新后恢复。界面运行在隔离的 Shadow DOM 中，不影响网页原有样式。

【隐私优先】
没有分析统计，没有广告，不需要账号。历史记录只在本机内存中筛选，不会发送到任何服务器；网站开关设置仅保存在 Chrome 本地。

开源地址：https://github.com/leafOfTree/flykey
```

## 商店图片

均位于 `store-assets/`：

| 用途 | 文件 |
| --- | --- |
| 截图 1（链接提示） | `screenshot-1-link-hints.png` |
| 截图 2（命令面板） | `screenshot-2-command-palette.png` |
| 截图 3（网站开关） | `screenshot-3-site-toggle.png` |
| 截图 4（快捷键帮助） | `screenshot-4-help.png` |
| 小型宣传图 440×280 | `promo-small-440x280.png` |
| 顶部宣传图 1400×560 | `promo-marquee-1400x560.png` |

截图为 1280×800，标题和演示网站均为中文，使用真实构建的内容脚本、工具栏弹窗和帮助页渲染，演示网站为虚构内容。

单一用途说明：

> Flykey provides keyboard-first navigation for web pages and browser tabs. Its history search, link hints, scrolling, bookmarking, and tab commands all support that single navigation purpose.

权限理由（提交审核用英文，逐项粘贴到“Privacy”页对应字段）：

- `history`: Used only when the user opens the command palette, to search their local browsing history. Results are filtered in memory on the device and are never stored or transmitted.
- `bookmarks`: Used only when the user presses the bookmark shortcut, to add the current page to their bookmarks.
- `sessions`: Used only when the user presses the restore shortcut, to reopen their most recently closed tab.
- `favicon`: Used to display site icons next to the user's local history search results.
- `clipboardWrite`: Used only when the user presses the copy shortcut, to copy the current page's URL or title to the clipboard.
- `activeTab`: Used when the user clicks the toolbar icon, to read the current site's hostname for the per-site on/off switch and to open the command palette in that tab.
- `storage`: Used to save, locally in Chrome, the list of website hostnames where the user has turned Flykey off. This list is never transmitted.
- Host permission `<all_urls>`: Flykey's single purpose is keyboard navigation on the web pages the user visits, so its content script must run on ordinary web pages to handle scrolling, link hints and other shortcuts. It does not run on Chrome internal pages, and it does not collect or transmit page content.
- Remote code: No. All code is bundled in the extension package; nothing is loaded or evaluated from remote sources.

数据使用披露建议如实勾选“Web history”和“Website content”，用途选择核心功能；声明数据不出售、不用于广告、不用于信用或借贷，并遵守 Chrome Web Store Limited Use 要求。

## 首次提交（已完成）

首次上架时已完成以下事项，后续发版只需确认没有变化：

- [x] 隐私政策发布在公开 HTTPS 地址，支持渠道为 [GitHub Issues](https://github.com/leafOfTree/flykey/issues)。
- [x] 在开发者控制台填写隐私政策 URL、权限理由和单一用途说明。
- [x] 上传 `store-assets/screenshot-command-1280x800.png` 和 `store-assets/promo-small-440x280.png`。
- [ ] 上传 4 张新截图和 1400×560 顶部宣传图（见“商店图片”）。

## 每次发版

1. 同步更新 `manifest.json`、根 `package.json`、`frontend/package.json` 的版本号，并在 `CHANGELOG.md` 记录变更。
2. 执行 `npm ci` 后运行 `npm run package`。
3. 解压 `release/flykey-<version>.zip`，确认根目录直接包含 `manifest.json`，且没有 source map、测试、开发配置或远程代码。
4. 在稳定版 Chrome 的 `chrome://extensions` 以“加载已解压”方式冒烟测试：README 中的快捷键、工具栏开关、历史搜索和权限流程。
5. 提交版本变更并打标签：`git tag v<version>`，推送时带上 `--tags`。
6. 在现有 Flykey 条目的“Package”页选择“Upload New Package”，上传 ZIP，并检查控制台的权限差异提示；新增权限时同步更新权限理由、隐私披露、README 和 `PRIVACY.md`。
7. 核对商店文案、截图及隐私声明，提交审核；审核通过后确认已发布版本号。
