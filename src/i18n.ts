/**
 * UI strings in English and Chinese. The language follows Obsidian's interface
 * language; anything other than Chinese falls back to English.
 *
 * Placeholders like `{file}` are filled from the `vars` argument of the translator.
 */

const en = {
	// Commands
	"command.captureNote": "Capture note",
	"command.captureTask": "Capture task",
	"command.openCalendar": "Open calendar",
	"command.openJournal": "Open journal file",

	// Capture modal
	"modal.title": "{command} → {file}",
	"modal.placeholder": "Write something…",
	"modal.recent": "Recent",
	"modal.frequent": "Frequent",
	"modal.tagHint": "Type #tag in the text to add a tag",
	"modal.cancel": "Cancel",
	"modal.submit": "Save",

	// Notices
	"notice.saved": "Saved to {file}",
	"notice.saveFailed": "Could not save to {file}: {error}\nYour text: {text}",
	"notice.noEntry": "No entries on this day",
	"notice.pathIsFolder": "{path} is a folder, not a file. Change the journal file path in settings.",

	// Calendar
	"calendar.title": "Unidaily calendar",
	"calendar.monthFormat": "MMMM YYYY",
	"calendar.prevMonth": "Previous month",
	"calendar.thisMonth": "This month",
	"calendar.nextMonth": "Next month",

	// Settings
	"settings.journalPath.name": "Journal file",
	"settings.journalPath.desc": "Path of the file that holds all entries, relative to the vault root.",
	"settings.headingLevel.name": "Date heading level",
	"settings.headingLevel.desc": "Markdown heading level used for each day.",
	"settings.dateFormat.name": "Date format",
	"settings.dateFormat.desc": "Moment.js format for the date heading.",
	"settings.dateFormat.preview": "Today's heading: {heading}",
	"settings.formatWarning":
		"Existing headings are not converted when the heading level or date format changes. Days whose headings no longer match will not be found by the calendar.",
	"settings.recentCount.name": "Recent tags",
	"settings.recentCount.desc": "Number of recently used tags shown in the capture window. 0 hides the row.",
	"settings.frequentCount.name": "Frequent tags",
	"settings.frequentCount.desc": "Number of most used tags in the vault shown in the capture window. 0 hides the row.",
} as const;

export type StringKey = keyof typeof en;

const zh: Record<StringKey, string> = {
	"command.captureNote": "记一笔",
	"command.captureTask": "记待办",
	"command.openCalendar": "打开日历",
	"command.openJournal": "打开日记文件",

	"modal.title": "{command} → {file}",
	"modal.placeholder": "输入内容…",
	"modal.recent": "最近",
	"modal.frequent": "常用",
	"modal.tagHint": "在内容中输入 #标签 即可添加标签",
	"modal.cancel": "取消",
	"modal.submit": "确定",

	"notice.saved": "已记录到 {file}",
	"notice.saveFailed": "写入 {file} 失败：{error}\n你输入的内容：{text}",
	"notice.noEntry": "这一天没有记录",
	"notice.pathIsFolder": "{path} 是文件夹而不是文件，请在设置中修改日记文件路径。",

	"calendar.title": "Unidaily 日历",
	"calendar.monthFormat": "YYYY年M月",
	"calendar.prevMonth": "上个月",
	"calendar.thisMonth": "回到本月",
	"calendar.nextMonth": "下个月",

	"settings.journalPath.name": "日记文件路径",
	"settings.journalPath.desc": "存放所有记录的文件，相对于库根目录。",
	"settings.headingLevel.name": "日期标题级别",
	"settings.headingLevel.desc": "每天的日期标题使用的 Markdown 标题级别。",
	"settings.dateFormat.name": "日期格式",
	"settings.dateFormat.desc": "日期标题使用的 moment.js 格式。",
	"settings.dateFormat.preview": "今天的标题：{heading}",
	"settings.formatWarning":
		"修改日期标题级别或日期格式后，已有的日期标题不会自动转换。与新格式不一致的日期，日历将找不到。",
	"settings.recentCount.name": "最近标签显示数量",
	"settings.recentCount.desc": "记录窗口中显示的最近用过的标签数量。0 表示不显示该行。",
	"settings.frequentCount.name": "常用标签显示数量",
	"settings.frequentCount.desc": "记录窗口中显示的库中最常用的标签数量。0 表示不显示该行。",
};

export type Locale = "en" | "zh";
export type Translator = (key: StringKey, vars?: Record<string, string | number>) => string;

const TABLES: Record<Locale, Record<StringKey, string>> = { en, zh };

/** Maps an Obsidian language code (`getLanguage()`) to a supported locale. */
export function resolveLocale(language: string): Locale {
	return language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/** Creates a translator for an Obsidian language code. Unknown placeholders are left as is. */
export function createTranslator(language: string): Translator {
	const table = TABLES[resolveLocale(language)];
	return (key, vars) => {
		const template = table[key];
		if (!vars) return template;
		return template.replace(/\{(\w+)\}/g, (match, name: string) =>
			name in vars ? String(vars[name]) : match,
		);
	};
}
