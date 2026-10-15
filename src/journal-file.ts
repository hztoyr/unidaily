/**
 * Vault side of the journal: locating, creating, reading, writing and opening
 * the journal file. The text transformations live in `journal.ts`.
 */

import { App, MarkdownView, TFile, normalizePath } from "obsidian";
import { insertEntry } from "./journal.ts";

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
): Promise<void> {
	const file = await ensureJournalFile(app, path);
	await app.vault.process(file, (data) => insertEntry(data, heading, level, entry));
}

/**
 * Opens the journal (FR-17), reusing a tab that already shows it. With `line`,
 * scrolls to that 0-based line (used by the calendar, FR-16).
 */
export async function openJournal(app: App, path: string, line?: number): Promise<void> {
	const file = await ensureJournalFile(app, path);
	const eState = line === undefined ? undefined : { line };

	const leaf = app.workspace
		.getLeavesOfType("markdown")
		.find((l) => l.view instanceof MarkdownView && l.view.file?.path === file.path);

	if (leaf) {
		app.workspace.setActiveLeaf(leaf, { focus: true });
		await app.workspace.revealLeaf(leaf);
		if (eState) leaf.view.setEphemeralState(eState);
		return;
	}
	await app.workspace.getLeaf(false).openFile(file, { active: true, eState });
}
