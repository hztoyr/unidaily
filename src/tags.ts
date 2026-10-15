/**
 * Pure tag logic: extracting tags from text, computing the "recent" and
 * "frequent" rows of the capture modal, and toggling a tag in the input.
 *
 * Tags are returned with their leading `#`. Matching is case-insensitive, as in
 * Obsidian, and the first-seen (recent) or most-used (frequent) spelling wins.
 */

import { proseLines } from "./journal.ts";

/** Characters allowed inside a tag name (letters, marks, digits, `_`, `-`, `/`). */
const TAG_CHAR = String.raw`[\p{L}\p{M}\p{N}_\-/]`;
const TAG_RE = new RegExp(String.raw`(?<=^|\s)#(${TAG_CHAR}+)`, "gu");
const INLINE_CODE_RE = /`[^`]*`/g;

/** Tags in a piece of text, in order of appearance (duplicates kept). */
export function extractTags(text: string): string[] {
	const result: string[] = [];
	for (const m of text.replace(INLINE_CODE_RE, " ").matchAll(TAG_RE)) {
		const name = m[1] ?? "";
		// A tag needs at least one non-digit character: `#2026` is not a tag.
		if (/\D/.test(name)) result.push(`#${name}`);
	}
	return result;
}

/**
 * Recent tags (FR-3): scans the journal from top to bottom (newest day first)
 * and keeps each tag's first occurrence. Frontmatter and code blocks are skipped.
 */
export function recentTags(content: string, limit: number): string[] {
	if (limit <= 0) return [];
	const seen = new Set<string>();
	const result: string[] = [];
	for (const [, line] of proseLines(content.split(/\r?\n/))) {
		for (const tag of extractTags(line)) {
			const key = tag.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			result.push(tag);
			if (result.length >= limit) return result;
		}
	}
	return result;
}

/** Counts tag uses across files, e.g. from `getAllTags(cache)` of every Markdown file. */
export function countTags(tagLists: Iterable<readonly string[]>): Map<string, number> {
	const counts = new Map<string, number>();
	for (const list of tagLists) {
		for (const tag of list) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	return counts;
}

/**
 * Frequent tags (FR-4): sorted by use count, most used first; ties by name.
 * Spellings that differ only in case are merged and shown in their most-used form.
 */
export function frequentTags(counts: ReadonlyMap<string, number>, limit: number): string[] {
	if (limit <= 0) return [];
	const merged = new Map<string, { total: number; best: string; bestCount: number }>();
	for (const [raw, count] of counts) {
		const tag = raw.startsWith("#") ? raw : `#${raw}`;
		const key = tag.toLowerCase();
		const entry = merged.get(key);
		if (!entry) {
			merged.set(key, { total: count, best: tag, bestCount: count });
		} else {
			entry.total += count;
			if (count > entry.bestCount) {
				entry.best = tag;
				entry.bestCount = count;
			}
		}
	}
	return [...merged.values()]
		.sort((a, b) => b.total - a.total || compareNames(a.best, b.best))
		.slice(0, limit)
		.map((e) => e.best);
}

/** Whether `text` contains `tag` as a whole tag (so `#work/meeting` does not contain `#work`). */
export function hasTag(text: string, tag: string): boolean {
	return wholeTagRe(tag).test(text);
}

/**
 * Click on a tag chip (FR-5): appends the tag when absent (separated by one
 * space), otherwise removes every occurrence and tidies the spacing.
 */
export function toggleTag(text: string, tag: string): string {
	if (hasTag(text, tag)) {
		return text.replace(wholeTagRe(tag, "g"), "").replace(/[ \t]{2,}/g, " ").trim();
	}
	const base = text.trimEnd();
	return base === "" ? tag : `${base} ${tag}`;
}

/** A partial `#tag` around the caret that the completion list should complete (FR-6). */
export interface TagQuery {
	/** Index of the `#`. */
	start: number;
	/** End of the partial tag, including tag characters right after the caret. */
	end: number;
	/** Text typed after the `#`, up to the caret. */
	query: string;
}

const QUERY_BEFORE_RE = new RegExp(String.raw`(?<=^|\s)#(${TAG_CHAR}*)$`, "u");
const TAG_CHARS_AFTER_RE = new RegExp(String.raw`^${TAG_CHAR}*`, "u");

/** Returns the tag being typed at `caret`, or null when the caret is not inside one. */
export function tagQueryAt(text: string, caret: number): TagQuery | null {
	const m = QUERY_BEFORE_RE.exec(text.slice(0, caret));
	if (!m) return null;
	const query = m[1] ?? "";
	const after = TAG_CHARS_AFTER_RE.exec(text.slice(caret))?.[0] ?? "";
	return { start: caret - query.length - 1, end: caret + after.length, query };
}

/**
 * Completion candidates for `query`, case-insensitive. Prefix matches come
 * first, then other substring matches; within each group the input order
 * (most used first) is kept.
 */
export function filterTags(tags: readonly string[], query: string): string[] {
	const q = query.toLowerCase();
	const prefix: string[] = [];
	const inner: string[] = [];
	for (const tag of tags) {
		const name = tag.slice(1).toLowerCase();
		if (name.startsWith(q)) prefix.push(tag);
		else if (name.includes(q)) inner.push(tag);
	}
	return [...prefix, ...inner];
}

/** Replaces the partial tag with `tag` plus one space; returns the new text and caret. */
export function applyTag(text: string, at: TagQuery, tag: string): { text: string; caret: number } {
	const rest = text.slice(at.end);
	const next = text.slice(0, at.start) + tag + (rest.startsWith(" ") ? "" : " ") + rest;
	return { text: next, caret: at.start + tag.length + 1 };
}

function wholeTagRe(tag: string, flags = ""): RegExp {
	const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(String.raw`(?<=^|\s)${escaped}(?!${TAG_CHAR})`, `iu${flags}`);
}

function compareNames(a: string, b: string): number {
	const la = a.toLowerCase();
	const lb = b.toLowerCase();
	return la < lb ? -1 : la > lb ? 1 : 0;
}
