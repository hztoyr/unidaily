import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, getAllTags, getLanguage, moment } from "obsidian";
import { CalendarView, VIEW_TYPE_CALENDAR } from "./calendar-view.ts";
import { CaptureModal } from "./capture-modal.ts";
import { findConflicts } from "./conflicts.ts";
import { confirmCreateDay, findDayInText, openDayEnd, runReporting } from "./day-actions.ts";
import { watchDrop } from "./drop-import.ts";
import { pluginState } from "./plugin-control.ts";
import { createTranslator, type Translator } from "./i18n.ts";
import { buildHeading, formatEntry, type EntryKind } from "./journal.ts";
import {
	JournalPathError,
	appendEntry,
	dateComparator,
	fileNameOf,
	openJournal,
	openedByUnidaily,
	readJournal,
} from "./journal-file.ts";
import { normalizeSettings, type UnidailySettings } from "./settings.ts";
import { UnidailySettingTab } from "./settings-tab.ts";
import { countTags, frequentTags, recentTags } from "./tags.ts";

export default class UnidailyPlugin extends Plugin {
	settings!: UnidailySettings;
	t!: Translator;
	/** File each tab showed last, to tell a new opening of the journal from switching back to its tab. */
	private lastFileOfLeaf = new WeakMap<WorkspaceLeaf, string | null>();
	/** Day (YYYY-MM-DD) on which we already asked to create today, so we ask only once a day. */
	private askedToCreate: string | null = null;

	async onload() {
		this.t = createTranslator(getLanguage());
		await this.loadSettings();
		const { t } = this;

		// Default hotkeys Alt+J / Alt+T (FR-1); users can change them under Settings → Hotkeys.
		this.addCommand({
			id: "capture-note",
			name: t("command.captureNote"),
			hotkeys: [{ modifiers: ["Alt"], key: "J" }],
			callback: () => this.openCapture("note"),
		});
		this.addCommand({
			id: "capture-task",
			name: t("command.captureTask"),
			hotkeys: [{ modifiers: ["Alt"], key: "T" }],
			callback: () => this.openCapture("task"),
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

		// Once all plugins are loaded, warn once if a plugin that creates one file per day is on (FR-18).
		this.app.workspace.onLayoutReady(() => this.warnAboutConflicts());

		// Jump to today when the journal is opened, e.g. from a bookmark widget on the phone (FR-19).
		this.registerEvent(this.app.workspace.on("file-open", (file) => this.onFileOpen(file)));

		// Offer to copy files that a drop only linked to outside the vault (FR-21).
		this.registerEvent(this.app.workspace.on("editor-drop", (_evt, editor, info) => watchDrop(this, editor, info)));
	}

	/**
	 * Reacts only when the journal is newly opened in a tab: not when switching
	 * back to a tab that already shows it, and not when Unidaily itself opened
	 * it (the calendar jumps to the clicked day instead).
	 */
	private onFileOpen(file: TFile | null): void {
		const leaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
		if (!leaf) return;
		const previous = this.lastFileOfLeaf.get(leaf);
		this.lastFileOfLeaf.set(leaf, file?.path ?? null);

		if (!this.settings.jumpToTodayOnOpen || !file || file.path !== this.settings.journalPath) return;
		if (previous === file.path || openedByUnidaily()) return;
		void runReporting(() => this.jumpToToday());
	}

	/** Cursor to the end of today; if today has no heading yet, ask once a day whether to create it. */
	private async jumpToToday(): Promise<void> {
		const today = moment();
		const content = await readJournal(this.app, this.settings.journalPath);
		const headingText = findDayInText(content, this.settings, today);
		if (headingText !== undefined) {
			await openDayEnd(this, headingText);
			return;
		}
		const key = today.format("YYYY-MM-DD");
		if (this.askedToCreate === key) return;
		this.askedToCreate = key;
		confirmCreateDay(this, today);
	}

	private warnAboutConflicts(): void {
		const { conflicts } = findConflicts(pluginState(this.app));
		if (conflicts.length === 0) return;
		const names = conflicts
			.map((c) => (c.id === "daily-notes" ? this.t("conflict.dailyNotes") : c.name))
			.join(", ");
		new Notice(this.t("notice.conflicts", { names }), 15_000);
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

	/** Opens the capture window (commands, hotkeys and the calendar buttons). */
	openCapture(kind: EntryKind): void {
		void runReporting(() => this.showCapture(kind));
	}

	private async showCapture(kind: EntryKind): Promise<void> {
		const { settings, t } = this;
		const content = await readJournal(this.app, settings.journalPath);
		const allTags = this.vaultTagsByUse();

		new CaptureModal(this.app, {
			t,
			kind,
			fileName: fileNameOf(settings.journalPath),
			recentTags: recentTags(content, settings.recentTagCount),
			frequentTags: allTags.slice(0, settings.frequentTagCount),
			allTags,
			onSubmit: (text, chosen) => void this.write(chosen, text),
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
		const now = moment();
		const heading = buildHeading(settings.headingLevel, now.format(settings.dateFormat));
		// A missing heading for today goes in date order, below any days created ahead of time.
		const compare = dateComparator(settings.dateFormat, now);
		try {
			await appendEntry(this.app, settings.journalPath, heading, settings.headingLevel, formatEntry(text, kind), compare);
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
