import { Notice, Plugin, getAllTags, getLanguage, moment } from "obsidian";
import { CalendarView, VIEW_TYPE_CALENDAR } from "./calendar-view.ts";
import { CaptureModal } from "./capture-modal.ts";
import { createTranslator, type Translator } from "./i18n.ts";
import { buildHeading, formatEntry, type EntryKind } from "./journal.ts";
import { JournalPathError, appendEntry, fileNameOf, openJournal, readJournal } from "./journal-file.ts";
import { normalizeSettings, type UnidailySettings } from "./settings.ts";
import { UnidailySettingTab } from "./settings-tab.ts";
import { countTags, frequentTags, recentTags } from "./tags.ts";

export default class UnidailyPlugin extends Plugin {
	settings!: UnidailySettings;
	t!: Translator;

	async onload() {
		this.t = createTranslator(getLanguage());
		await this.loadSettings();
		const { t } = this;

		// No default hotkeys: users bind them under Settings → Hotkeys (FR-1).
		this.addCommand({
			id: "capture-note",
			name: t("command.captureNote"),
			callback: () => void this.openCapture("note"),
		});
		this.addCommand({
			id: "capture-task",
			name: t("command.captureTask"),
			callback: () => void this.openCapture("task"),
		});
		this.addCommand({
			id: "open-journal",
			name: t("command.openJournal"),
			callback: () => void this.run(() => openJournal(this.app, this.settings.journalPath)),
		});

		this.addCommand({
			id: "open-calendar",
			name: t("command.openCalendar"),
			callback: () => void this.activateCalendar(),
		});

		this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));
		this.addSettingTab(new UnidailySettingTab(this.app, this));

		// Put the calendar in the right sidebar unless the layout already has one (FR-15).
		this.app.workspace.onLayoutReady(() => {
			if (!this.settings.openCalendarOnStartup) return;
			if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0) {
				void this.app.workspace.getRightLeaf(false)?.setViewState({ type: VIEW_TYPE_CALENDAR });
			}
		});
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)) {
			if (leaf.view instanceof CalendarView) void leaf.view.refresh();
		}
	}

	/** Shows the calendar, recreating it in the right sidebar if it was closed. */
	private async activateCalendar(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
		}
		if (leaf) await workspace.revealLeaf(leaf);
	}

	private async openCapture(kind: EntryKind): Promise<void> {
		const { settings, t } = this;
		const content = await readJournal(this.app, settings.journalPath);
		const allTags = this.vaultTagsByUse();

		new CaptureModal(this.app, {
			t,
			commandName: t(kind === "task" ? "command.captureTask" : "command.captureNote"),
			fileName: fileNameOf(settings.journalPath),
			recentTags: recentTags(content, settings.recentTagCount),
			frequentTags: allTags.slice(0, settings.frequentTagCount),
			allTags,
			onSubmit: (text) => void this.write(kind, text),
		}).open();
	}

	/** Every tag in the vault, most used first (FR-4, FR-6). */
	private vaultTagsByUse(): string[] {
		const { vault, metadataCache } = this.app;
		const lists = vault.getMarkdownFiles().map((file) => {
			const cache = metadataCache.getFileCache(file);
			return (cache && getAllTags(cache)) ?? [];
		});
		return frequentTags(countTags(lists), Number.POSITIVE_INFINITY);
	}

	private async write(kind: EntryKind, text: string): Promise<void> {
		const { settings, t } = this;
		const file = fileNameOf(settings.journalPath);
		const heading = buildHeading(settings.headingLevel, moment().format(settings.dateFormat));
		try {
			await appendEntry(this.app, settings.journalPath, heading, settings.headingLevel, formatEntry(text, kind));
			new Notice(t("notice.saved", { file }));
		} catch (error) {
			console.error("Unidaily: failed to write entry", error);
			// Keep the notice until dismissed so the text can be recovered (FR-13).
			new Notice(t("notice.saveFailed", { file, error: this.describe(error), text }), 0);
		}
	}

	/** Runs a vault action and reports failures as a notice. */
	private async run(action: () => Promise<void>): Promise<void> {
		try {
			await action();
		} catch (error) {
			console.error("Unidaily:", error);
			new Notice(this.describe(error));
		}
	}

	private describe(error: unknown): string {
		if (error instanceof JournalPathError) return this.t("notice.pathIsFolder", { path: error.message });
		return error instanceof Error ? error.message : String(error);
	}
}
