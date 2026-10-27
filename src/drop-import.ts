/**
 * Asks to copy dropped files into the vault (FR-21). Obsidian normally copies
 * a dropped file, but some drops only give it a location (WeChat, Ctrl held),
 * and the note gets a `file:///` link that breaks on another computer. After
 * a drop, this looks for such new links and offers to copy those files into
 * the attachment folder and link to the copies instead. Desktop only.
 */

import { App, Editor, FileSystemAdapter, Notice, Platform, type MarkdownFileInfo } from "obsidian";
import { ConfirmModal } from "./confirm-modal.ts";
import {
	addedLinks,
	fileNameOfPath,
	fileUrlToPath,
	findFileLinks,
	relativeToVault,
	type FileLink,
} from "./external-links.ts";
import type { Translator } from "./i18n.ts";
import type { UnidailySettings } from "./settings.ts";

export interface DropHost {
	app: App;
	settings: UnidailySettings;
	t: Translator;
}

/** Obsidian inserts its link after the drop event; look again after these delays (ms). */
const CHECK_DELAYS = [50, 300, 1000];

/** Call from the `editor-drop` event. */
export function watchDrop(host: DropHost, editor: Editor, info: MarkdownFileInfo): void {
	if (!host.settings.askToCopyExternalFiles || !Platform.isDesktopApp) return;
	const before = findFileLinks(editor.getValue());
	const sourcePath = info.file?.path ?? "";
	let attempt = 0;
	const check = () => {
		const added = outsideVault(host.app, addedLinks(before, findFileLinks(editor.getValue())));
		if (added.length > 0) {
			askToCopy(host, editor, sourcePath, before, added);
		} else if (attempt < CHECK_DELAYS.length) {
			window.setTimeout(check, CHECK_DELAYS[attempt++]);
		}
	};
	window.setTimeout(check, CHECK_DELAYS[attempt++]);
}

/** Drops the links that point into the vault folder itself; those files are already synced. */
function outsideVault(app: App, links: FileLink[]): FileLink[] {
	const adapter = app.vault.adapter;
	const base = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
	return links.filter((link) => {
		const path = fileUrlToPath(link.url);
		return path !== null && relativeToVault(path, base) === null;
	});
}

function askToCopy(host: DropHost, editor: Editor, sourcePath: string, before: FileLink[], added: FileLink[]): void {
	const { t } = host;
	const names = added.map((link) => fileNameOfPath(fileUrlToPath(link.url) ?? link.url));
	new ConfirmModal(host.app, {
		title: t("drop.title"),
		message: t("drop.message", { files: names.join(t("drop.separator")) }),
		confirm: t("drop.copy"),
		cancel: t("drop.keepLink"),
		onConfirm: () => void copyIntoVault(host, editor, sourcePath, before),
	}).open();
}

/**
 * Copies each new outside file into the attachment folder and replaces its
 * link with a link to the copy, in the same style: a plain link stays a plain
 * link (a PDF doesn't turn into a preview), an embed stays an embed. The
 * links are looked up again, so text typed in the meantime is fine. A file
 * that can't be read keeps its link and gets a notice.
 */
async function copyIntoVault(host: DropHost, editor: Editor, sourcePath: string, before: FileLink[]): Promise<void> {
	const { app, t } = host;
	const copies = new Map<string, string>();
	for (const link of outsideVault(app, addedLinks(before, findFileLinks(editor.getValue())))) {
		if (copies.has(link.url)) continue;
		const path = fileUrlToPath(link.url);
		if (path === null) continue;
		const name = fileNameOfPath(path);
		try {
			const data = await FileSystemAdapter.readLocalFile(path);
			const target = await app.fileManager.getAvailablePathForAttachment(name, sourcePath);
			const file = await app.vault.createBinary(target, data);
			copies.set(link.url, app.fileManager.generateMarkdownLink(file, sourcePath));
		} catch (error) {
			console.error("Unidaily:", error);
			new Notice(t("drop.copyFailed", { file: name, error: error instanceof Error ? error.message : String(error) }));
		}
	}
	if (copies.size === 0) return;

	// Replace from the end so earlier offsets stay valid.
	const links = outsideVault(app, addedLinks(before, findFileLinks(editor.getValue())));
	for (const link of links.reverse()) {
		const copy = copies.get(link.url);
		if (copy === undefined) continue;
		const replacement = link.embed ? `!${copy}` : copy;
		editor.replaceRange(replacement, editor.offsetToPos(link.from), editor.offsetToPos(link.to));
	}
	new Notice(t("drop.copied", { count: String(copies.size) }));
}
