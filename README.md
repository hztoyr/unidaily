# Unidaily

Keep all your daily notes in **one file**. Press a hotkey, type a line, press Enter: it lands under today's date without opening the file. Recent and frequent tags are one click away, and a sidebar calendar takes you to any day.

**English** · [中文说明](#中文说明)

## Contents

- [Why one file](#why-one-file)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Capturing entries](#capturing-entries)
- [Tags](#tags)
- [Calendar](#calendar)
- [Settings](#settings)
- [Moving from QuickAdd + Single File Daily Notes](#moving-from-quickadd--single-file-daily-notes)
- [FAQ](#faq)

## Why one file

The usual daily-notes setup creates a new file every day. If you only write a sentence or two, and not every day, you end up with a folder full of tiny files. Unidaily keeps everything in a single Markdown file with one heading per day, newest day on top:

```markdown
### 2026-10-15 Thursday
- Aligned the API fields with the backend #work
- [ ] Send the expense report
- Ran 5 km in the evening #running

### 2026-10-12 Monday
- Finished reading a book, the ending was so-so #reading
```

The journal is an ordinary note: you can edit, search and link it as usual, and if you ever remove the plugin your notes stay exactly as they are.

## Installation

**From Obsidian**
1. Open **Settings → Community plugins** and turn off Restricted mode if it's on.
2. Select **Browse**, search for **Unidaily**, then **Install** and **Enable**.

**Manually**
1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/hztoyr/unidaily/releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/unidaily/`.
3. Restart Obsidian and enable **Unidaily** under **Settings → Community plugins**.

Requires Obsidian 1.8.7 or later. Works on desktop and mobile.

## Getting started

1. **Pick your journal file.** By default it's `Daily Notes.md` in the vault root. You can change it under **Settings → Unidaily**. The file and its folder are created the first time you write an entry.
2. **Hotkeys.** **Alt+J** opens *Capture note* and **Alt+T** opens *Capture task*. If they clash with keys you already use, change them under **Settings → Hotkeys** (search for "Unidaily").
3. **Write your first entry.** Press Alt+J, type a line and press Enter.

You can also run every command from the command palette (`Ctrl/Cmd + P`):

| Command | Default hotkey | What it does |
|---|---|---|
| Capture note | Alt+J | Opens the capture window and writes `- text` |
| Capture task | Alt+T | Opens the capture window and writes `- [ ] text` |
| Open calendar | — | Shows the sidebar calendar |
| Open journal file | — | Opens the journal file (creates it if missing) |

## Capturing entries

- The switch at the top shows whether the entry will be a **Note** or a **Task**. Click the other side, or press Alt+J / Alt+T while the window is open, to change it; what you've typed is kept.
- Long text wraps onto several lines and the text box grows with it (up to six lines, then it scrolls). It is still saved as one line in the journal.
- **Enter** saves the entry and closes the window. **Esc** closes it without saving.
- Empty text isn't saved; the window stays open.
- The entry goes under today's heading, after the entries you already wrote today.
- If today's heading doesn't exist yet, it's created at the top of the file (below the frontmatter, if the file has any), with a blank line before the previous day.
- The note you're working in is never touched, and the journal file isn't opened.
- A short notice confirms where the entry was saved. If saving fails, the notice stays on screen and includes your text so nothing is lost.

## Tags

The capture window shows two rows of tags under the text box:

- **Recent**: tags you used most recently in the journal, newest first.
- **Frequent**: the most used tags across your whole vault.

Click a tag to add it to the end of your text, followed by a space so you can keep typing; click it again to remove it. Tags already in your text are highlighted, and inside the text box they are coloured the same way as tags in your notes. If you have no tags yet, the window shows a hint instead.

Type `#` to get suggestions from every tag in your vault. Keep typing to filter the list, then press Enter or click a suggestion to complete it. While the list is open, Enter picks a tag instead of saving, and Esc closes the list first.

## Calendar

The calendar sits in the right sidebar and shows one month at a time.

- Use the arrows to move between months, and **This month** to jump back.
- Today is highlighted. Days that have entries are marked with a dot.
- Click a day with entries to open the journal with the cursor at the end of that day, ready to keep writing. If the journal is already open in a tab, that tab is reused.
- Click a day without entries to create it: after you confirm, the day's heading is added in date order (not just at the top), the line under it starts with `- ` and the cursor is placed after it, ready to type (this can be turned off in the settings). Cancel leaves the file untouched. Future days can be created too, for plans or tasks.
- The first day of the week follows Obsidian's language setting.

Below the month there are two buttons, **Note** and **Task**, that open the capture window. They are handy on your phone, where there are no hotkeys.

If you close the calendar, run **Open calendar** to bring it back.

## Settings

| Setting | Default | Description |
|---|---|---|
| Current version | — | Shows the installed version of Unidaily |
| Journal file | `Daily Notes.md` | Path of the journal, relative to the vault root |
| Date heading level | `###` | Heading level used for each day (1–6) |
| Date format | `YYYY-MM-DD dddd` | [Moment.js format](https://momentjs.com/docs/#/displaying/format/) for the date heading; a preview of today's heading is shown |
| Recent tags | 6 | Number of recent tags shown; 0 hides the row |
| Frequent tags | 6 | Number of frequent tags shown; 0 hides the row |
| Open calendar on startup | On | Adds the calendar to the right sidebar when Obsidian starts and it isn't open |
| Jump to today when opening the journal | On | When the journal is newly opened (from a bookmark, the file list, a widget…), the cursor goes to the end of today; if today has no entries yet, you're asked once a day whether to create it |
| Start a new day with a list item | On | When you create a day (from the calendar or when opening the journal), the line under the new date heading starts with `- `, ready to type. When off, the line is left empty |
| Conflicting plugins | — | Lists plugins that are turned on and create a separate file for each day (the core *Daily notes* plugin, Calendar, Periodic Notes, Journals), each with a **Turn off** button that asks before doing anything |

If one of those plugins is on when Obsidian starts, Unidaily shows a short notice once. They are only turned off when you confirm.

Weekday and month names follow Obsidian's interface language. In Obsidian 1.13 and later, these settings can also be found through the settings search.

> **Changing the heading level or date format** doesn't rewrite headings that already exist. Days whose headings no longer match the new format won't be found by the calendar, and a new heading will be created for today.

## Moving from QuickAdd + Single File Daily Notes

If you used QuickAdd's Capture together with Single File Daily Notes, your journal already uses the format Unidaily expects (`### YYYY-MM-DD dddd` headings with list items). No conversion is needed:

1. Install and enable Unidaily, and set **Journal file** to your existing file.
2. Disable QuickAdd's capture and Single File Daily Notes if you no longer need them.
3. Remove the old QuickAdd hotkeys under **Settings → Hotkeys** if they still use Alt+J / Alt+T, or give *Capture note* and *Capture task* the keys you used before.

## FAQ

**Can I edit or delete entries?**
Yes. Open the journal file (**Open journal file**) and edit it like any other note. The capture window only adds new entries.

**Does Unidaily go online or collect data?**
No. It makes no network requests and collects nothing. It only reads and writes your journal file, and reads the tag index Obsidian already keeps for your vault.

**Why does the calendar show no dot on a day I wrote about?**
The calendar looks for headings that match your current heading level and date format exactly. If you changed either setting, older headings won't match. Headings written with English weekday names are still found when Obsidian is set to another language.

**Can I put the journal in a folder?**
Yes. Set **Journal file** to something like `Journal/Daily Notes.md`. Missing folders are created automatically.

**Does it work on mobile?**
Yes, capturing and the calendar both work on Obsidian mobile.

**Can I open today's journal from my phone's home screen?**
Yes. Bookmark the journal file in Obsidian, then add Obsidian's bookmark widget to your home screen (iOS 18 or later). Opening the journal from the widget jumps to today, or asks whether to create today if it has no entries yet. Don't use the widget's "Open daily note" action: it belongs to the core *Daily notes* plugin and creates a separate file for each day.

## License

[MIT](LICENSE)

---

## 中文说明

**[English](#unidaily)** · 中文

Unidaily 把所有日记集中在**一个文件**里。按下快捷键，输入一句话，回车，内容就会写到今天的日期下面，不用打开文件。最近用过的标签和常用标签点一下就能加上，侧边栏日历可以跳到任意一天。

### 为什么用一个文件

常见的日记方式是每天新建一个文件。如果你一次只写一两句，也不是每天都写，最后就会攒下一大堆零碎的小文件。Unidaily 把所有内容放在一个 Markdown 文件里，每天一个日期标题，最新的一天在最上面：

```markdown
### 2026-10-15 Thursday
- 和后端对齐接口字段 #工作
- [ ] 给财务发报销单
- 晚上跑了 5 公里 #跑步

### 2026-10-12 Monday
- 读完一本书，结尾一般 #读书
```

日记文件就是一篇普通笔记，可以照常编辑、搜索、链接。以后就算卸载插件，笔记也原样保留。

### 安装

**在 Obsidian 中安装**
1. 打开 **设置 → 第三方插件**，如果开着"安全模式"，先把它关掉。
2. 点 **浏览**，搜索 **Unidaily**，点 **安装**，再点 **启用**。

**手动安装**
1. 从 [最新版本](https://github.com/hztoyr/unidaily/releases/latest) 下载 `main.js`、`manifest.json`、`styles.css`。
2. 放到 `<你的库>/.obsidian/plugins/unidaily/` 文件夹里。
3. 重启 Obsidian，在 **设置 → 第三方插件** 中启用 **Unidaily**。

需要 Obsidian 1.8.7 或更高版本，桌面端和移动端都能用。

### 开始使用

1. **选择日记文件**：默认是库根目录下的 `Daily Notes.md`，可以在 **设置 → Unidaily** 中修改。第一次写入时，文件和所在文件夹会自动创建。
2. **快捷键**：**Alt+J** 打开"记一笔"，**Alt+T** 打开"记待办"。如果和你已有的快捷键冲突，可以在 **设置 → 快捷键** 中搜索 "Unidaily" 修改。
3. **写第一条记录**：按 Alt+J，输入一句话，回车。

所有命令也可以在命令面板（`Ctrl/Cmd + P`）中执行：

| 命令 | 默认快捷键 | 作用 |
|---|---|---|
| 记一笔 | Alt+J | 打开记录窗口，写入 `- 内容` |
| 记待办 | Alt+T | 打开记录窗口，写入 `- [ ] 内容` |
| 打开日历 | — | 显示侧边栏日历 |
| 打开日记文件 | — | 打开日记文件（不存在时自动创建） |

### 记录

- 窗口顶部的切换按钮显示这条记录是 **记一笔** 还是 **记待办**。点另一边，或者在窗口打开时按 Alt+J / Alt+T，就能切换，已经输入的内容不会丢失。
- 内容较长时会自动换行，输入框随之变高（最多约 6 行，再多就在框内滚动）。写进日记时仍然是一行。
- **回车** 保存并关闭窗口，**Esc** 不保存直接关闭。
- 内容为空时不会保存，窗口保持打开。
- 记录会写到今天的日期标题下面，排在今天已有记录的后面。
- 如果今天的标题还不存在，会在文件最上面新建（文件有 frontmatter 时放在它下面），并和前一天之间空一行。
- 不会改动你正在编辑的笔记，也不会打开日记文件。
- 保存后会短暂提示记到了哪个文件。如果保存失败，提示会一直显示，并附上你输入的内容，不会丢失。

### 标签

记录窗口的输入框下方有两行标签：

- **最近**：日记里最近用过的标签，越新的越靠前。
- **常用**：整个库里使用次数最多的标签。

点一下标签，就把它加到内容末尾，后面自动跟一个空格，可以直接接着输入；再点一下就移除。已经在内容里的标签会高亮显示；输入框里的标签也会像笔记中的标签一样带颜色。如果还没有任何标签，会显示一行提示。

输入 `#` 会弹出库中所有标签的候选列表，继续输入可以筛选，回车或点击即可补全。候选列表打开时，回车用来选择标签而不是保存，Esc 会先关闭列表。

### 日历

日历在右侧边栏，一次显示一个月。

- 用左右箭头切换月份，点 **回到本月** 回到当前月份。
- 今天会高亮显示，有记录的日期下方有一个小圆点。
- 点击有记录的日期，会打开日记文件，光标停在当天内容的末尾，可以直接接着写；如果日记文件已经在某个标签页打开，会直接切换过去。
- 点击没有记录的日期，会询问是否新建。确认后，这一天的标题会按日期顺序插入（不是一律放在最上面），标题下面一行自动写好 `- `，光标停在它后面，可以直接输入（可以在设置里关掉）；点取消则不修改文件。未来的日期也可以新建，方便提前写计划或待办。
- 每周从星期几开始，跟随 Obsidian 的语言设置。

月历下方有 **记一笔** 和 **记待办** 两个按钮，点击即可打开记录窗口，手机上没有快捷键时尤其方便。

如果关掉了日历，执行 **打开日历** 命令就能重新打开。

### 设置

| 设置项 | 默认值 | 说明 |
|---|---|---|
| 当前版本 | — | 显示已安装的 Unidaily 版本 |
| 日记文件路径 | `Daily Notes.md` | 日记文件的位置，相对于库根目录 |
| 日期标题级别 | `###` | 每天的日期标题使用的标题级别（1–6） |
| 日期格式 | `YYYY-MM-DD dddd` | 日期标题的 [Moment.js 格式](https://momentjs.com/docs/#/displaying/format/)，设置页会显示今天标题的预览 |
| 最近标签显示数量 | 6 | 显示多少个最近标签，0 表示不显示这一行 |
| 常用标签显示数量 | 6 | 显示多少个常用标签，0 表示不显示这一行 |
| 启动时自动打开日历 | 开 | Obsidian 启动时，如果日历没有打开，就把它放到右侧边栏 |
| 打开日记文件时跳到今天 | 开 | 新打开日记文件时（从书签、文件列表、小组件等），光标跳到今天内容的末尾；今天还没有记录时，每天询问一次是否新建 |
| 新建日期后自动加列表符号 | 开 | 新建某一天后（在日历上或打开日记文件时），日期标题下面一行自动写好 `- `，可以直接输入；关闭后这一行留空 |
| 冲突检查 | — | 列出已启用、会为每一天生成单独文件的插件（Obsidian 自带的"日记"、Calendar、Periodic Notes、Journals），每个旁边有 **关闭** 按钮，点了会先确认 |

Obsidian 启动时，如果发现这些插件中有开着的，会提示一次；只有你确认后才会关闭。

星期和月份的名称跟随 Obsidian 的界面语言。在 Obsidian 1.13 及以上版本中，这些设置项也能在设置窗口的搜索框里搜到。

> **修改日期标题级别或日期格式后**，已有的标题不会自动转换。和新格式对不上的日期，日历会找不到，今天也会新建一个标题。

### 从 QuickAdd + Single File Daily Notes 迁移

如果你之前用 QuickAdd 的 Capture 配合 Single File Daily Notes，你的日记文件已经是 Unidaily 使用的格式（`### YYYY-MM-DD dddd` 标题加列表），不需要任何转换：

1. 安装并启用 Unidaily，把 **日记文件路径** 设为原来的文件。
2. 如果不再需要，停用 QuickAdd 的 Capture 和 Single File Daily Notes。
3. 如果 QuickAdd 的旧快捷键还占着 Alt+J / Alt+T，在 **设置 → 快捷键** 中删掉；或者把你原来用的按键改绑到 **记一笔** 和 **记待办**。

### 常见问题

**可以修改或删除已有的记录吗？**
可以。执行 **打开日记文件**，像编辑普通笔记一样修改即可。记录窗口只负责添加新记录。

**插件会联网或收集数据吗？**
不会。插件不发起任何网络请求，也不收集任何数据。它只读写你的日记文件，并读取 Obsidian 本身就维护的库内标签索引。

**为什么我写过记录的日子，日历上没有小圆点？**
日历只认和当前"日期标题级别"、"日期格式"完全一致的标题。如果你改过这两项设置，旧标题就对不上了。另外，用英文星期名写的标题，在 Obsidian 切换成其他语言后仍然能找到。

**日记文件可以放在文件夹里吗？**
可以。把 **日记文件路径** 设为类似 `日记/Daily Notes.md` 的路径即可，不存在的文件夹会自动创建。

**手机上能用吗？**
能。记录和日历在 Obsidian 移动端上都可以正常使用。

**能从手机桌面直接打开今天的日记吗？**
能。在 Obsidian 里把日记文件加入书签，再把 Obsidian 的书签小组件添加到手机桌面（需要 iOS 18 或更高版本）。从小组件打开日记时，会跳到今天；今天还没有记录时，会询问是否新建。不要用小组件里的"打开今日日记"（Open daily note），它属于 Obsidian 自带的"日记"插件，会为每一天生成单独的文件。

### 许可证

[MIT](LICENSE)
