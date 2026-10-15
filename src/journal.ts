/**
 * Pure text operations on the journal file.
 *
 * Nothing here touches the vault or Obsidian runtime APIs, so the logic can be
 * unit-tested with plain Node. Date formatting (moment) is done by the caller,
 * which passes in the finished heading text.
 */

export type EntryKind = "note" | "task";

export interface HeadingInfo {
	/** 0-based line number in the file. */
	line: number;
	/** Number of leading `#` characters (1–6). */
	level: number;
	/** Heading text without the `#` markers, trailing whitespace trimmed. */
	text: string;
}

const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/** Builds a heading line, e.g. `buildHeading(3, "2026-10-15 Thursday")` → `### 2026-10-15 Thursday`. */
export function buildHeading(level: number, text: string): string {
	return `${"#".repeat(level)} ${text}`;
}

/** Turns user input into a single list line. Line breaks are collapsed into spaces. */
export function formatEntry(text: string, kind: EntryKind): string {
	const body = text.replace(/\s*[\r\n]+\s*/g, " ").trim();
	return kind === "task" ? `- [ ] ${body}` : `- ${body}`;
}

/**
 * Returns the line index where the body starts, i.e. the line after the closing
 * `---` of a leading frontmatter block, or 0 when there is no frontmatter.
 */
export function frontmatterEnd(lines: readonly string[]): number {
	if (lines[0]?.trimEnd() !== "---") return 0;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i]?.trimEnd() === "---") return i + 1;
	}
	return 0;
}

/** Lists all headings in the body, skipping frontmatter and fenced code blocks. */
export function listHeadings(content: string): HeadingInfo[] {
	return scanHeadings(splitLines(content).lines);
}

/**
 * Maps heading text to its line for headings of exactly `level`; the first
 * occurrence wins. Used by the calendar to find days with entries.
 */
export function indexHeadings(content: string, level: number): Map<string, number> {
	const index = new Map<string, number>();
	for (const h of listHeadings(content)) {
		if (h.level === level && !index.has(h.text)) index.set(h.text, h.line);
	}
	return index;
}

/** Line number of the heading whose full line equals `heading`, or -1. */
export function findHeadingLine(content: string, heading: string): number {
	const target = heading.trimEnd();
	const { lines } = splitLines(content);
	const found = scanHeadings(lines).find((h) => lines[h.line]?.trimEnd() === target);
	return found ? found.line : -1;
}

/**
 * Inserts `entry` under the heading line `heading` (level `level`).
 *
 * - Heading exists: the entry goes at the end of that day's section, before the
 *   next heading of the same or higher level, skipping trailing blank lines.
 * - Heading missing: a new section is created at the top of the body (after
 *   frontmatter), separated from the existing content by one blank line.
 *
 * Line endings (LF / CRLF) and the presence of a final newline are preserved.
 */
export function insertEntry(content: string, heading: string, level: number, entry: string): string {
	const { lines, eol, trailingNewline } = splitLines(content);
	const headings = scanHeadings(lines);
	const target = heading.trimEnd();
	const today = headings.find((h) => lines[h.line]?.trimEnd() === target);

	if (today) {
		const next = headings.find((h) => h.line > today.line && h.level <= level);
		let insertAt = next ? next.line : lines.length;
		while (insertAt - 1 > today.line && lines[insertAt - 1]?.trim() === "") insertAt--;
		lines.splice(insertAt, 0, entry);
	} else {
		const bodyStart = frontmatterEnd(lines);
		let restStart = bodyStart;
		while (restStart < lines.length && lines[restStart]?.trim() === "") restStart++;
		const rest = lines.slice(restStart);
		const section = rest.length > 0 ? [target, entry, ""] : [target, entry];
		lines.splice(bodyStart, lines.length - bodyStart, ...section, ...rest);
	}

	return lines.join(eol) + (trailingNewline ? eol : "");
}

interface SplitResult {
	lines: string[];
	eol: string;
	trailingNewline: boolean;
}

function splitLines(content: string): SplitResult {
	const eol = content.includes("\r\n") ? "\r\n" : "\n";
	// An empty or whitespace-only file gets a final newline once written to.
	const trailingNewline = content.trim() === "" || /\r?\n$/.test(content);
	const body = content.trim() === "" ? "" : content.replace(/\r?\n$/, "");
	const lines = body === "" ? [] : body.split(/\r?\n/);
	return { lines, eol, trailingNewline };
}

/** Yields `[index, line]` for body lines outside frontmatter and fenced code blocks. */
export function* proseLines(lines: readonly string[]): Generator<[number, string]> {
	let fence: string | null = null;
	for (let i = frontmatterEnd(lines); i < lines.length; i++) {
		const line = lines[i] ?? "";
		const fenceMatch = FENCE_RE.exec(line);
		if (fenceMatch) {
			const marker = fenceMatch[1] ?? "";
			if (fence === null) {
				fence = marker;
			} else if (marker[0] === fence[0] && marker.length >= fence.length) {
				fence = null;
			}
			continue;
		}
		if (fence === null) yield [i, line];
	}
}

function scanHeadings(lines: readonly string[]): HeadingInfo[] {
	const result: HeadingInfo[] = [];
	for (const [i, line] of proseLines(lines)) {
		const m = HEADING_RE.exec(line);
		if (m) result.push({ line: i, level: (m[1] ?? "").length, text: (m[2] ?? "").trimEnd() });
	}
	return result;
}
