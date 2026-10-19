/**
 * Pure text operations on the journal file.
 *
 * Nothing here touches the vault or Obsidian runtime APIs, so the logic can be
 * unit-tested with plain Node. Date formatting (moment) is done by the caller,
 * which passes in the finished heading text.
 */

export type EntryKind = "note" | "task";

/**
 * Compares a heading's text with the target day: a positive number when the
 * heading's day is newer, negative when older, 0 for the same day, and null
 * when the text is not a date in the configured format.
 */
export type DateCompare = (headingText: string) => number | null;

/** A position in the file: 0-based line and character. */
export interface Position {
	line: number;
	ch: number;
}

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
 * Where the content of the day under `headingLine` ends: the end of its last
 * non-blank line, or the end of the heading itself when the day is empty.
 * The calendar puts the cursor here so the user can keep writing.
 */
export function sectionEnd(content: string, headingLine: number, level: number): Position {
	const { lines } = splitLines(content);
	const next = scanHeadings(lines).find((h) => h.line > headingLine && h.level <= level);
	let last = (next ? next.line : lines.length) - 1;
	while (last > headingLine && lines[last]?.trim() === "") last--;
	return { line: last, ch: (lines[last] ?? "").length };
}

/**
 * Inserts `entry` under the heading line `heading` (level `level`).
 *
 * - Heading exists: the entry goes at the end of that day's section, before the
 *   next heading of the same or higher level, skipping trailing blank lines.
 * - Heading missing: a new section is created, separated from its neighbours
 *   by one blank line. With `compare` it goes in date order (newest first);
 *   without it, at the top of the body (after frontmatter).
 *
 * Line endings (LF / CRLF) and the presence of a final newline are preserved.
 */
export function insertEntry(
	content: string,
	heading: string,
	level: number,
	entry: string,
	compare?: DateCompare,
): string {
	const { lines, eol, trailingNewline } = splitLines(content);
	const headings = scanHeadings(lines);
	const target = heading.trimEnd();
	const day = headings.find((h) => lines[h.line]?.trimEnd() === target);

	if (day) {
		const next = headings.find((h) => h.line > day.line && h.level <= level);
		let insertAt = next ? next.line : lines.length;
		while (insertAt - 1 > day.line && lines[insertAt - 1]?.trim() === "") insertAt--;
		lines.splice(insertAt, 0, entry);
	} else {
		const writeLine = addDaySection(lines, target, level, compare);
		lines[writeLine] = entry;
	}

	return lines.join(eol) + (trailingNewline ? eol : "");
}

/**
 * Adds an empty section for a day that has no heading yet, in date order
 * (newest first), and returns the new content plus the line right under the
 * new heading, where the user can start writing. If the heading already
 * exists, the content is returned unchanged.
 */
export function insertDayHeading(
	content: string,
	heading: string,
	level: number,
	compare: DateCompare,
): { content: string; line: number } {
	const { lines, eol, trailingNewline } = splitLines(content);
	const target = heading.trimEnd();
	const existing = scanHeadings(lines).find((h) => lines[h.line]?.trimEnd() === target);
	if (existing) return { content, line: existing.line + 1 };
	const line = addDaySection(lines, target, level, compare);
	return { content: lines.join(eol) + (trailingNewline ? eol : ""), line };
}

/**
 * Splices `[heading, ""]` (plus blank separators) into `lines` and returns
 * the index of the empty line under the heading.
 *
 * - No dated headings (or no `compare`): at the top of the body.
 * - Otherwise before the first dated heading that is older than the target,
 *   or at the end of the file when every dated heading is newer.
 */
function addDaySection(lines: string[], heading: string, level: number, compare?: DateCompare): number {
	const bodyStart = frontmatterEnd(lines);
	const dated = compare
		? scanHeadings(lines).filter((h) => h.level === level && compare(h.text) !== null)
		: [];

	if (dated.length === 0) {
		let restStart = bodyStart;
		while (restStart < lines.length && lines[restStart]?.trim() === "") restStart++;
		const rest = lines.slice(restStart);
		const section = rest.length > 0 ? [heading, "", ""] : [heading, ""];
		lines.splice(bodyStart, lines.length - bodyStart, ...section, ...rest);
		return bodyStart + 1;
	}

	const older = dated.find((h) => (compare?.(h.text) ?? 0) < 0);
	if (older) {
		const at = older.line;
		const needsGap = at > bodyStart && lines[at - 1]?.trim() !== "";
		const section = needsGap ? ["", heading, "", ""] : [heading, "", ""];
		lines.splice(at, 0, ...section);
		return at + section.indexOf(heading) + 1;
	}

	while (lines.length > bodyStart && lines[lines.length - 1]?.trim() === "") lines.pop();
	if (lines.length > bodyStart) lines.push("");
	lines.push(heading, "");
	return lines.length - 1;
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
