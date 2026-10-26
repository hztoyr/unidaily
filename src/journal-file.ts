/**
 * Vault side of the journal: locating, creating, reading, writing and opening
 * the journal file. The text transformations live in `journal.ts`.
 */

import { App, MarkdownView, TFile, moment, normalizePath } from "obsidian";
import { insertDayHeading, insertEntry, type DateCompare, type Position } from "./journal.ts";

/** Thrown when the configured journal path is taken by a folder. */
export class JournalPathError extends Error {}

/** Last path segment, e.g. `Journal/Daily Notes.md` → `Daily Notes.md`. */
export function fileNameOf(path: string): string {
	return path.split("/").pop() ?? path;
}

/** Current content of the journal, or "" when the file does not exist yet. */
export async function readJournal(app: App, path: string): Promise<string> {
	const file = app.vault.getFileByPath(normalizePath(path));
	return file ? app.vault.cachedRead(file) : "";
}

/** Returns the journal file, creating it and its parent folders if needed (FR-12). */
export async function ensureJournalFile(app: App, path: string): Promise<TFile> {
	const normalized = normalizePath(path);
	const existing = app.vault.getAbstractFileByPath(normalized);
	if (existing instanceof TFile) return existing;
	if (existing) throw new JournalPathError(normalized);

	const parts = normalized.split("/").slice(0, -1);
	for (let i = 1; i <= parts.length; i++) {
		const folder = parts.slice(0, i).join("/");
		const found = app.vault.getAbstractFileByPath(folder);
		if (!found) await app.vault.createFolder(folder);
		else if (found instanceof TFile) throw new JournalPathError(folder);
	}
	return app.vault.create(normalized, "");
}

/**
 * Writes one entry under today's heading (FR-10 – FR-13). `Vault.process`
 * applies the change atomically, so an open editor of the file stays in sync.
 */
export async function appendEntry(
	app: App,
	path: string,
	heading: string,
	level: number,
	entry: string,
	compare?: DateCompare,
): Promise<void> {
	const file = await ensureJournalFile(app, path);
	await app.vault.process(file, (data) => insertEntry(data, heading, level, entry, compare));
}

/**
 * Compares heading text with `target` by parsing it with the date format, in
 * the current locale and in English (headings written under an English UI).
 */
export function dateComparator(dateFormat: string, target: moment.Moment): DateCompare {
	const day = target.clone().startOf("day");
	const locales = [...new Set([moment.locale(), "en"])];
	return (text) => {
		for (const locale of locales) {
			const parsed = moment(text, dateFormat, locale, true);
			if (parsed.isValid()) return Math.sign(parsed.startOf("day").diff(day, "days"));
		}
		return null;
	};
}

/**
 * Adds a section for a day without a heading, in date order (calendar, FR-16);
 * the line under the heading holds `firstLine` (FR-20).
 */
export async function createDay(
	app: App,
	path: string,
	heading: string,
	level: number,
	compare: DateCompare,
	firstLine = "",
): Promise<void> {
	const file = await ensureJournalFile(app, path);
	await app.vault.process(file, (data) => insertDayHeading(data, heading, level, compare, firstLine).content);
}

/** Opens the journal (FR-17), reusing a tab that already shows it. */
export async function openJournal(app: App, path: string): Promise<void> {
	const file = await ensureJournalFile(app, path);
	const leaf = findJournalLeaf(app, file);
	if (leaf) {
		app.workspace.setActiveLeaf(leaf, { focus: true });
		await app.workspace.revealLeaf(leaf);
		return;
	}
	await app.workspace.getLeaf(false).openFile(file, { active: true });
}

/** Until this time, journal openings come from Unidaily itself (see `openedByUnidaily`). */
let ownOpenUntil = 0;

/**
 * True while (and shortly after) Unidaily itself opens the journal, e.g. from
 * the calendar. The "jump to today" handler (FR-19) ignores those openings.
 */
export function openedByUnidaily(): boolean {
	return Date.now() < ownOpenUntil;
}

/**
 * Opens the journal in editing mode and puts the cursor where `locate` says,
 * computed from the editor's current text (calendar FR-16, jump to today FR-19).
 * Right after a write the editor may lag behind the file, so `locate` is
 * retried for a moment until it finds its position.
 */
export async function openJournalAt(
	app: App,
	path: string,
	locate: (text: string) => Position | null,
): Promise<void> {
	ownOpenUntil = Date.now() + 2000;
	try {
		const file = await ensureJournalFile(app, path);
		const leaf = findJournalLeaf(app, file) ?? app.workspace.getLeaf(false);
		await leaf.openFile(file, { active: true, state: { mode: "source" } });
		await app.workspace.revealLeaf(leaf);

		const view = leaf.view;
		if (!(view instanceof MarkdownView)) return;
		let pos = locate(view.editor.getValue());
		for (let tries = 0; !pos && tries < 15; tries++) {
			await new Promise((resolve) => window.setTimeout(resolve, 100));
			pos = locate(view.editor.getValue());
		}
		if (!pos) return;
		view.editor.setCursor(pos);
		view.editor.scrollIntoView({ from: pos, to: pos }, true);
		view.editor.focus();
	} finally {
		ownOpenUntil = Date.now() + 1000;
	}
}

function findJournalLeaf(app: App, file: TFile) {
	return (
		app.workspace
			.getLeavesOfType("markdown")
			.find((l) => l.view instanceof MarkdownView && l.view.file?.path === file.path) ?? null
	);
}
