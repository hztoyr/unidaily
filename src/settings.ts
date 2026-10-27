/**
 * Settings model: defaults and validation of the data loaded from `data.json`.
 * The settings page itself lives in `settings-tab.ts`.
 */

export interface UnidailySettings {
	/** Vault-relative path of the journal file. */
	journalPath: string;
	/** Markdown heading level of the date headings (1–6). */
	headingLevel: number;
	/** Moment.js format of the date heading text. */
	dateFormat: string;
	/** Number of recent tags in the capture modal; 0 hides the row. */
	recentTagCount: number;
	/** Number of frequent tags in the capture modal; 0 hides the row. */
	frequentTagCount: number;
	/** Add the calendar to the right sidebar on startup when it isn't open. */
	openCalendarOnStartup: boolean;
	/** When the journal is newly opened, jump to today or offer to create it (FR-19). */
	jumpToTodayOnOpen: boolean;
	/** Start the line under a newly created day heading with `- ` (FR-20). */
	listMarkerOnNewDay: boolean;
	/** After a drop that links to a file outside the vault, ask to copy it in (FR-21). */
	askToCopyExternalFiles: boolean;
}

export const DEFAULT_SETTINGS: Readonly<UnidailySettings> = {
	journalPath: "Daily Notes.md",
	headingLevel: 3,
	dateFormat: "YYYY-MM-DD dddd",
	recentTagCount: 6,
	frequentTagCount: 6,
	openCalendarOnStartup: true,
	jumpToTodayOnOpen: true,
	listMarkerOnNewDay: true,
	askToCopyExternalFiles: true,
};

export const MAX_TAG_COUNT = 20;

/**
 * Normalizes a user-entered journal path: forward slashes, no leading or
 * duplicate slashes, `.md` extension. Empty input falls back to the default.
 */
export function normalizeJournalPath(input: string): string {
	const path = input
		.trim()
		.replace(/\\/g, "/")
		.split("/")
		.map((part) => part.trim())
		.filter((part) => part !== "")
		.join("/");
	if (path === "") return DEFAULT_SETTINGS.journalPath;
	return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

/** Builds valid settings from whatever was stored, falling back to defaults per field. */
export function normalizeSettings(raw: unknown): UnidailySettings {
	const data = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
	return {
		journalPath:
			typeof data.journalPath === "string"
				? normalizeJournalPath(data.journalPath)
				: DEFAULT_SETTINGS.journalPath,
		headingLevel: intInRange(data.headingLevel, 1, 6, DEFAULT_SETTINGS.headingLevel),
		dateFormat:
			typeof data.dateFormat === "string" && data.dateFormat.trim() !== ""
				? data.dateFormat.trim()
				: DEFAULT_SETTINGS.dateFormat,
		recentTagCount: intInRange(data.recentTagCount, 0, MAX_TAG_COUNT, DEFAULT_SETTINGS.recentTagCount),
		frequentTagCount: intInRange(data.frequentTagCount, 0, MAX_TAG_COUNT, DEFAULT_SETTINGS.frequentTagCount),
		openCalendarOnStartup:
			typeof data.openCalendarOnStartup === "boolean"
				? data.openCalendarOnStartup
				: DEFAULT_SETTINGS.openCalendarOnStartup,
		jumpToTodayOnOpen:
			typeof data.jumpToTodayOnOpen === "boolean" ? data.jumpToTodayOnOpen : DEFAULT_SETTINGS.jumpToTodayOnOpen,
		listMarkerOnNewDay:
			typeof data.listMarkerOnNewDay === "boolean" ? data.listMarkerOnNewDay : DEFAULT_SETTINGS.listMarkerOnNewDay,
		askToCopyExternalFiles:
			typeof data.askToCopyExternalFiles === "boolean"
				? data.askToCopyExternalFiles
				: DEFAULT_SETTINGS.askToCopyExternalFiles,
	};
}

function intInRange(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}
