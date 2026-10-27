/**
 * Links to files outside the vault (FR-21). When a file is dropped in a way
 * that makes Obsidian link to it instead of copying it, e.g. from WeChat or
 * with Ctrl held, the note gets `[name](file:///C:/…)`. These helpers find
 * such links and turn their URLs into local paths. No Obsidian API here.
 */

/** A `file://` link in the note text; `from`/`to` are character offsets. */
export interface FileLink {
	from: number;
	to: number;
	url: string;
	/** Written as `![…](…)`, i.e. shown inside the note rather than as a link. */
	embed: boolean;
}

/** `[label](file://…)`, optionally embedded with `!`, or `<file://…>`. */
const FILE_LINK = /!?\[[^\]\n]*\]\((file:\/\/[^)\s]+)\)|<(file:\/\/[^>\s]+)>/gi;

export function findFileLinks(text: string): FileLink[] {
	const links: FileLink[] = [];
	for (const match of text.matchAll(FILE_LINK)) {
		const url = match[1] ?? match[2] ?? "";
		links.push({ from: match.index, to: match.index + match[0].length, url, embed: match[0].startsWith("!") });
	}
	return links;
}

/**
 * The links in `after` that were not in `before`. Links are matched by URL,
 * occurrence by occurrence, so dropping the same file twice counts once more.
 */
export function addedLinks(before: readonly FileLink[], after: readonly FileLink[]): FileLink[] {
	const seen = new Map<string, number>();
	for (const link of before) seen.set(link.url, (seen.get(link.url) ?? 0) + 1);
	const added: FileLink[] = [];
	for (const link of after) {
		const left = seen.get(link.url) ?? 0;
		if (left > 0) seen.set(link.url, left - 1);
		else added.push(link);
	}
	return added;
}

/**
 * Local path of a `file://` URL with forward slashes, or null if it isn't
 * one: `file:///C:/0/a%20b.pdf` → `C:/0/a b.pdf`, `file:///home/a.pdf` →
 * `/home/a.pdf`, `file://server/share/a.pdf` → `//server/share/a.pdf`.
 */
export function fileUrlToPath(url: string): string | null {
	if (!/^file:\/\//i.test(url)) return null;
	let rest = url.slice("file://".length);
	try {
		rest = decodeURIComponent(rest);
	} catch {
		return null;
	}
	if (rest === "") return null;
	if (/^\/[A-Za-z]:\//.test(rest)) return rest.slice(1);
	if (/^localhost\//i.test(rest)) return rest.slice("localhost".length);
	return rest.startsWith("/") ? rest : `//${rest}`;
}

/** Last part of a path, with either kind of slash. */
export function fileNameOfPath(path: string): string {
	return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Vault-relative path of `path` if it lies inside the vault folder `base`,
 * otherwise null. Comparison ignores the slash style, and letter case when
 * the vault is on a Windows drive.
 */
export function relativeToVault(path: string, base: string): string | null {
	const clean = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");
	const file = clean(path);
	const root = clean(base);
	if (root === "") return null;
	const windows = /^[A-Za-z]:/.test(root);
	const same = (a: string, b: string) => (windows ? a.toLowerCase() === b.toLowerCase() : a === b);
	const prefix = file.slice(0, root.length);
	if (!same(prefix, root) || file.charAt(root.length) !== "/") return null;
	const relative = file.slice(root.length + 1);
	return relative === "" ? null : relative;
}
