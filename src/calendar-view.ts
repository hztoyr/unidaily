import { ItemView, Notice, TAbstractFile, WorkspaceLeaf, moment, setIcon } from "obsidian";
import { monthGrid, type GridDay } from "./calendar.ts";
import { ConfirmModal } from "./confirm-modal.ts";
import type { Translator } from "./i18n.ts";
import { buildHeading, findHeadingLine, indexHeadings, sectionEnd } from "./journal.ts";
import { createDay, dateComparator, openJournalAt, readJournal } from "./journal-file.ts";
import type { UnidailySettings } from "./settings.ts";

export const VIEW_TYPE_CALENDAR = "unidaily-calendar";

/** What the calendar needs from the plugin. */
export interface CalendarHost {
	settings: UnidailySettings;
	t: Translator;
}

/**
 * Sidebar month calendar (FR-15, FR-16, OPT-1). Days that have a date heading
 * in the journal get a dot. Clicking such a day opens the journal with the
 * cursor at the end of that day's content; clicking any other day asks
 * whether to create it.
 */
export class CalendarView extends ItemView {
	private readonly host: CalendarHost;
	/** First day of the displayed month. */
	private month = moment().startOf("month");
	private today = moment().format("YYYY-MM-DD");
	private renderId = 0;

	constructor(leaf: WorkspaceLeaf, host: CalendarHost) {
		super(leaf);
		this.host = host;
	}

	getViewType(): string {
		return VIEW_TYPE_CALENDAR;
	}

	getDisplayText(): string {
		return this.host.t("calendar.title");
	}

	getIcon(): string {
		return "calendar-days";
	}

	async onOpen(): Promise<void> {
		const isJournal = (file: TAbstractFile) => file.path === this.host.settings.journalPath;
		const refreshIf = (file: TAbstractFile, oldPath?: string) => {
			if (isJournal(file) || oldPath === this.host.settings.journalPath) void this.refresh();
		};
		this.registerEvent(this.app.vault.on("modify", (file) => refreshIf(file)));
		this.registerEvent(this.app.vault.on("create", (file) => refreshIf(file)));
		this.registerEvent(this.app.vault.on("delete", (file) => refreshIf(file)));
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => refreshIf(file, oldPath)));

		// Move the "today" highlight after midnight.
		this.registerInterval(
			window.setInterval(() => {
				if (moment().format("YYYY-MM-DD") !== this.today) void this.refresh();
			}, 60_000),
		);

		await this.refresh();
	}

	/** Re-reads the journal and redraws. Safe to call often; stale renders are dropped. */
	async refresh(): Promise<void> {
		const id = ++this.renderId;
		const { settings } = this.host;
		const content = await readJournal(this.app, settings.journalPath);
		if (id !== this.renderId) return;
		this.today = moment().format("YYYY-MM-DD");
		this.draw(indexHeadings(content, settings.headingLevel));
	}

	private showMonth(month: moment.Moment): void {
		this.month = month.clone().startOf("month");
		void this.refresh();
	}

	private draw(headings: Map<string, number>): void {
		const { t } = this.host;
		const root = this.contentEl;
		root.empty();
		root.addClass("unidaily-calendar");

		const nav = root.createDiv({ cls: "unidaily-calendar-nav" });
		nav.createDiv({ cls: "unidaily-calendar-title", text: this.month.format(t("calendar.monthFormat")) });
		const buttons = nav.createDiv({ cls: "unidaily-calendar-buttons" });
		this.navButton(buttons, "chevron-left", t("calendar.prevMonth"), () =>
			this.showMonth(this.month.clone().subtract(1, "month")),
		);
		buttons
			.createEl("button", { cls: "unidaily-calendar-today", text: t("calendar.thisMonth") })
			.addEventListener("click", () => this.showMonth(moment()));
		this.navButton(buttons, "chevron-right", t("calendar.nextMonth"), () =>
			this.showMonth(this.month.clone().add(1, "month")),
		);

		const grid = root.createDiv({ cls: "unidaily-calendar-grid" });
		for (const name of moment.weekdaysMin(true)) {
			grid.createDiv({ cls: "unidaily-calendar-weekday", text: name });
		}

		const firstDay = moment.localeData().firstDayOfWeek();
		for (const week of monthGrid(this.month.year(), this.month.month(), firstDay)) {
			for (const day of week) this.dayCell(grid, day, headings);
		}
	}

	private navButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const button = parent.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
		setIcon(button, icon);
		button.addEventListener("click", onClick);
	}

	private dayCell(grid: HTMLElement, day: GridDay, headings: Map<string, number>): void {
		const date = moment([day.year, day.month, day.day]);
		const headingText = this.lookup(date, headings);
		const cell = grid.createEl("button", { cls: "unidaily-calendar-day", text: String(day.day) });
		if (!day.inMonth) cell.addClass("is-outside");
		if (date.format("YYYY-MM-DD") === this.today) cell.addClass("is-today");
		if (headingText !== undefined) {
			cell.addClass("has-entry");
			cell.createDiv({ cls: "unidaily-calendar-dot" });
		}
		cell.addEventListener("click", () => {
			if (headingText !== undefined) void this.run(() => this.openDayEnd(headingText));
			else this.confirmCreate(date);
		});
	}

	/**
	 * Finds the heading text of a date in the journal. Besides the current
	 * locale, the English spelling is tried so headings written under an
	 * English UI still match.
	 */
	private lookup(date: moment.Moment, headings: Map<string, number>): string | undefined {
		const { dateFormat } = this.host.settings;
		const local = date.format(dateFormat).trimEnd();
		if (headings.has(local)) return local;
		const english = date.clone().locale("en").format(dateFormat).trimEnd();
		return headings.has(english) ? english : undefined;
	}

	/** Opens the journal with the cursor at the end of that day's content. */
	private async openDayEnd(headingText: string): Promise<void> {
		const { journalPath, headingLevel } = this.host.settings;
		const heading = buildHeading(headingLevel, headingText);
		await openJournalAt(this.app, journalPath, (text) => {
			const line = findHeadingLine(text, heading);
			return line < 0 ? null : sectionEnd(text, line, headingLevel);
		});
	}

	/** Asks before creating a day that has no heading yet. */
	private confirmCreate(date: moment.Moment): void {
		const { t } = this.host;
		new ConfirmModal(this.app, {
			title: t("calendar.createTitle"),
			message: t("calendar.createMessage", { date: date.format(t("calendar.dateDisplay")) }),
			confirm: t("calendar.create"),
			cancel: t("modal.cancel"),
			onConfirm: () => void this.run(() => this.createAndOpen(date)),
		}).open();
	}

	/** Adds the day's heading in date order and puts the cursor on the empty line under it. */
	private async createAndOpen(date: moment.Moment): Promise<void> {
		const { journalPath, headingLevel, dateFormat } = this.host.settings;
		const heading = buildHeading(headingLevel, date.format(dateFormat));
		await createDay(this.app, journalPath, heading, headingLevel, dateComparator(dateFormat, date));
		await openJournalAt(this.app, journalPath, (text) => {
			const line = findHeadingLine(text, heading);
			return line < 0 ? null : { line: line + 1, ch: 0 };
		});
	}

	private async run(action: () => Promise<void>): Promise<void> {
		try {
			await action();
		} catch (error) {
			console.error("Unidaily:", error);
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}

