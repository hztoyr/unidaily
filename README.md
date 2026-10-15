# Unidaily

Keep all your daily notes in **one file**. Capture a line with a hotkey without leaving the note you're in, add tags with a click, and jump to any day from a sidebar calendar.

[中文说明](#中文说明)

## Why

Most daily-note setups create one file per day. If you only write a sentence or two, and not every day, that leaves you with lots of tiny files. Unidaily keeps everything in a single Markdown file with one heading per day, newest day on top:

```markdown
### 2026-10-15 Thursday
- Aligned the API fields with the backend #work
- [ ] Send the expense report
- Ran 5 km in the evening #running

### 2026-10-12 Monday
- Finished reading a book, the ending was so-so #reading
```

## Features

- **Capture window.** Run *Capture note* or *Capture task*, type a line and press Enter. It goes under today's heading in the journal file. The note you're editing is not touched, and no file is opened.
- **Tag suggestions.** The capture window shows the tags you used **recently** in the journal and the tags used **most** across your vault. Click a tag to add it, click again to remove it. Type `#` to get completion for any tag in the vault.
- **Sidebar calendar.** A month view in the right sidebar. Days that have entries are marked with a dot; click one to jump to its heading.
- **Plain Markdown.** The journal is an ordinary note: edit, search and link it as usual. Uninstalling the plugin leaves your notes exactly as they are.
- **Desktop and mobile.** Works on both. No network access and no data collection.
- **English and Chinese UI**, following Obsidian's interface language.

## Usage

### Commands

| Command | What it does |
|---|---|
| Capture note | Opens the capture window and writes `- text` |
| Capture task | Opens the capture window and writes `- [ ] text` |
| Open calendar | Shows the sidebar calendar if you closed it |
| Open journal file | Opens the journal file (creates it if missing) |

Unidaily sets no default hotkeys. Assign your own under **Settings → Hotkeys** (search for "Unidaily").

### Capture window

- **Enter** saves, **Esc** cancels. While the `#` completion list is open, Enter picks the highlighted tag.
- Empty input is not saved.
- If today's heading doesn't exist yet, it is created at the top of the file (after the frontmatter, if any). Entries of the same day are kept in the order you wrote them.
- If the journal file doesn't exist, it is created together with its folder.

### Calendar

- Clicking a day with entries opens the journal at that day's heading, reusing the tab if the journal is already open.
- Clicking a day without entries only shows a notice. The file is never changed.
- The first day of the week follows Obsidian's language setting.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Journal file | `Daily Notes.md` | Path relative to the vault root |
| Date heading level | `###` | 1–6 |
| Date format | `YYYY-MM-DD dddd` | [Moment.js format](https://momentjs.com/docs/#/displaying/format/); a live preview is shown |
| Recent tags | 6 | 0 hides the row |
| Frequent tags | 6 | 0 hides the row |

Weekday and month names follow Obsidian's interface language. Changing the heading level or date format does **not** rewrite existing headings; days whose headings no longer match the format won't be found by the calendar. Headings written with English weekday names are still found when the interface is in another language.

## Coming from QuickAdd + Single File Daily Notes

If you used QuickAdd's Capture together with Single File Daily Notes, your journal already has the format Unidaily uses (`### YYYY-MM-DD dddd` headings with list items). No conversion is needed:

1. Install and enable Unidaily, and set **Journal file** to your existing file.
2. Disable QuickAdd's capture choice and Single File Daily Notes if you no longer need them.
3. Bind your old hotkeys to *Capture note* and *Capture task*.

## Installation

**From Obsidian:** Settings → Community plugins → Browse, search for "Unidaily", install and enable.

**Manually:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/hztoyr/unidaily/releases/latest) and put them in `<your vault>/.obsidian/plugins/unidaily/`. Then reload Obsidian and enable Unidaily under Community plugins.

## Development

Requires Node.js 22.18 or later (the tests rely on Node's built-in TypeScript support).

```bash
npm install
npm run dev     # rebuild main.js on every change
npm run build   # type-check and build for release
npm test        # unit tests (node --test)
npm run lint    # ESLint with the official Obsidian rules
```

To try a build, copy `main.js`, `manifest.json` and `styles.css` into a test vault's `.obsidian/plugins/unidaily/` and toggle the plugin off and on.

## License

[MIT](LICENSE)

---

## 中文说明

Unidaily 把所有日记集中在**一个文件**里，每天一个日期标题，最新的一天在最上面。

- **记录窗口**：执行"记一笔"或"记待办"，输入一句话后回车，内容会写到日记文件中今天的标题下，不打开、不切换文件。
- **标签**：窗口里显示日记中**最近**用过的标签和整个库中**最常用**的标签，点击添加，再点一次移除；输入 `#` 可以补全库中已有的标签。
- **侧边栏日历**：有记录的日期下方显示小圆点，点击跳转到当天的标题；没有记录的日期只会提示，不会修改文件。
- 支持桌面端和移动端，不联网，不收集任何数据。界面语言跟随 Obsidian，支持中文和英文。

插件不设默认快捷键，请在"设置 → 快捷键"中搜索 "Unidaily" 自行绑定。

**从 QuickAdd + Single File Daily Notes 迁移**：两者生成的日记文件格式与 Unidaily 一致，无需转换。启用 Unidaily 后，把"日记文件路径"设为原来的文件，停用原来的两个插件，再把原来的快捷键绑定到"记一笔"和"记待办"即可。
