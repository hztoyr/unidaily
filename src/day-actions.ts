/**
 * Opening a day in the journal: put the cursor at the end of an existing day,
 * or ask before creating a missing one. Shared by the calendar (FR-16) and
 * "jump to today when the journal is opened" (FR-19).
 */

import { App, Notice, moment } from "obsidian";
import { ConfirmModal } from "./confirm-modal.ts";
import type { Translator } from "./i18n.ts";
import { buildHeading, findHeadingLine, indexHeadings, sectionEnd } from "./journal.ts";
import { createDay, dateComparator, openJournalAt } from "./journal-file.ts";
import type { UnidailySettings } from "./settings.ts";

export interface DayHost {
	app: App;
	settings: UnidailySettings;
	t: Translator;
}

/**
 * The heading text of `date` in the journal, or undefined. Besides the
 * current locale, the English spelling is tried so headings written under an
 * English UI still match.
 */
export function findDayHeading(
	headings: ReadonlyMap<string, number>,
	settings: UnidailySettings,
	date: moment.Moment,
): string | undefined {
	const local = date.format(settings.dateFormat).trimEnd();
	if (headings.has(local)) return local;
	const english = date.clone().locale("en").format(settings.dateFormat).trimEnd();
	return headings.has(english) ? english : undefined;
}

/** Same as `findDayHeading`, reading the headings from the journal text. */
export function findDayInText(text: string, settings: UnidailySettings, date: moment.Moment): string | undefined {
	return findDayHeading(indexHeadings(text, settings.headingLevel), settings, date);
}

/** Opens the journal with the cursor at the end of that day's content. */
export async function openDayEnd(host: DayHost, headingText: string): Promise<void> {
	const { journalPath, headingLevel } = host.settings;
	const heading = buildHeading(headingLevel, headingText);
	await openJournalAt(host.app, journalPath, (text) => {
		const line = findHeadingLine(text, heading);
		return line < 0 ? null : sectionEnd(text, line, headingLevel);
	});
}

/** Asks before creating a day that has no heading yet; on confirm, creates it and opens it. */
export function confirmCreateDay(host: DayHost, date: moment.Moment): void {
	const { t } = host;
	new ConfirmModal(host.app, {
		title: t("calendar.createTitle"),
		message: t("calendar.createMessage", { date: date.format(t("calendar.dateDisplay")) }),
		confirm: t("calendar.create"),
		cancel: t("modal.cancel"),
		onConfirm: () => void runReporting(() => createAndOpenDay(host, date)),
	}).open();
}

/** Adds the day's heading in date order and puts the cursor on the empty line under it. */
async function createAndOpenDay(host: DayHost, date: moment.Moment): Promise<void> {
	const { journalPath, headingLevel, dateFormat } = host.settings;
	const heading = buildHeading(headingLevel, date.format(dateFormat));
	await createDay(host.app, journalPath, heading, headingLevel, dateComparator(dateFormat, date));
	await openJournalAt(host.app, journalPath, (text) => {
		const line = findHeadingLine(text, heading);
		return line < 0 ? null : { line: line + 1, ch: 0 };
	});
}

/** Runs an action and shows a notice instead of failing silently. */
export async function runReporting(action: () => Promise<void>): Promise<void> {
	try {
		await action();
	} catch (error) {
		console.error("Unidaily:", error);
		new Notice(error instanceof Error ? error.message : String(error));
	}
}
