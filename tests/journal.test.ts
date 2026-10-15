import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
	buildHeading,
	findHeadingLine,
	indexHeadings,
	formatEntry,
	frontmatterEnd,
	insertEntry,
	listHeadings,
} from "../src/journal.ts";

const TODAY = "### 2026-10-15 Thursday";

/** Joins lines with LF and a final newline, mirroring a normal Markdown file. */
const md = (...lines: string[]) => lines.join("\n") + "\n";

describe("buildHeading", () => {
	test("uses the requested level", () => {
		assert.equal(buildHeading(3, "2026-10-15 Thursday"), TODAY);
		assert.equal(buildHeading(1, "x"), "# x");
		assert.equal(buildHeading(6, "x"), "###### x");
	});
});

describe("formatEntry", () => {
	test("note and task prefixes", () => {
		assert.equal(formatEntry("跑了 5 公里 #跑步", "note"), "- 跑了 5 公里 #跑步");
		assert.equal(formatEntry("发报销单", "task"), "- [ ] 发报销单");
	});

	test("trims and collapses line breaks into one line", () => {
		assert.equal(formatEntry("  line one\r\n\n  line two  ", "note"), "- line one line two");
	});
});

describe("frontmatterEnd", () => {
	test("no frontmatter", () => {
		assert.equal(frontmatterEnd(["### a", "- b"]), 0);
	});

	test("closed frontmatter", () => {
		assert.equal(frontmatterEnd(["---", "tags: x", "---", "### a"]), 3);
	});

	test("unclosed frontmatter is treated as body", () => {
		assert.equal(frontmatterEnd(["---", "tags: x", "### a"]), 0);
	});
});

describe("insertEntry: today's heading missing (FR-11, FR-12)", () => {
	test("empty file", () => {
		assert.equal(insertEntry("", TODAY, 3, "- a"), md(TODAY, "- a"));
	});

	test("whitespace-only file", () => {
		assert.equal(insertEntry("\n\n  \n", TODAY, 3, "- a"), md(TODAY, "- a"));
	});

	test("new section goes on top, one blank line above the older day", () => {
		const before = md("### 2026-10-12 Monday", "- old");
		const after = md(TODAY, "- a", "", "### 2026-10-12 Monday", "- old");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("extra blank lines at the top collapse to exactly one", () => {
		const before = md("", "", "### 2026-10-12 Monday", "- old");
		const after = md(TODAY, "- a", "", "### 2026-10-12 Monday", "- old");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("inserted after frontmatter", () => {
		const before = md("---", "cssclass: journal", "---", "### 2026-10-12 Monday", "- old");
		const after = md("---", "cssclass: journal", "---", TODAY, "- a", "", "### 2026-10-12 Monday", "- old");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("frontmatter only", () => {
		const before = md("---", "a: 1", "---");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), md("---", "a: 1", "---", TODAY, "- a"));
	});

	test("same date at another level does not count", () => {
		const before = md("#### 2026-10-15 Thursday", "- other");
		const after = md(TODAY, "- a", "", "#### 2026-10-15 Thursday", "- other");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("heading inside a code block does not count", () => {
		const before = md("```", TODAY, "```");
		const after = md(TODAY, "- a", "", "```", TODAY, "```");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});
});

describe("insertEntry: today's heading exists (FR-10)", () => {
	test("appends after the last entry, before the blank line and next day", () => {
		const before = md(TODAY, "- first", "", "### 2026-10-12 Monday", "- old");
		const after = md(TODAY, "- first", "- second", "", "### 2026-10-12 Monday", "- old");
		assert.equal(insertEntry(before, TODAY, 3, "- second"), after);
	});

	test("several entries keep writing order", () => {
		let content = "";
		content = insertEntry(content, TODAY, 3, "- 1");
		content = insertEntry(content, TODAY, 3, "- [ ] 2");
		content = insertEntry(content, TODAY, 3, "- 3");
		assert.equal(content, md(TODAY, "- 1", "- [ ] 2", "- 3"));
	});

	test("section at end of file with trailing blank lines", () => {
		const before = md(TODAY, "- first", "", "");
		const after = md(TODAY, "- first", "- second", "", "");
		assert.equal(insertEntry(before, TODAY, 3, "- second"), after);
	});

	test("empty section directly followed by another heading", () => {
		const before = md(TODAY, "### 2026-10-12 Monday", "- old");
		const after = md(TODAY, "- a", "### 2026-10-12 Monday", "- old");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("deeper sub-headings stay inside the day", () => {
		const before = md(TODAY, "- first", "#### 会议", "- notes", "", "### 2026-10-12 Monday");
		const after = md(TODAY, "- first", "#### 会议", "- notes", "- a", "", "### 2026-10-12 Monday");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("a higher-level heading ends the day", () => {
		const before = md(TODAY, "- first", "## 2025", "- old");
		const after = md(TODAY, "- first", "- a", "## 2025", "- old");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("heading line with trailing spaces still matches", () => {
		const before = md(`${TODAY}  `, "- first");
		const after = md(`${TODAY}  `, "- first", "- a");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("today is not the top section", () => {
		const before = md("### 2026-10-16 Friday", "- x", "", TODAY, "- first", "", "### 2026-10-12 Monday");
		const after = md("### 2026-10-16 Friday", "- x", "", TODAY, "- first", "- a", "", "### 2026-10-12 Monday");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("heading-like line inside a code block does not end the day", () => {
		const before = md(TODAY, "- first", "```md", "### not a heading", "```", "", "### 2026-10-12 Monday");
		const after = md(TODAY, "- first", "```md", "### not a heading", "```", "- a", "", "### 2026-10-12 Monday");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});
});

describe("insertEntry: line endings", () => {
	test("CRLF is preserved", () => {
		const before = [TODAY, "- first", "", "### 2026-10-12 Monday", ""].join("\r\n");
		const after = [TODAY, "- first", "- a", "", "### 2026-10-12 Monday", ""].join("\r\n");
		assert.equal(insertEntry(before, TODAY, 3, "- a"), after);
	});

	test("missing final newline stays missing", () => {
		assert.equal(insertEntry(`${TODAY}\n- first`, TODAY, 3, "- a"), `${TODAY}\n- first\n- a`);
	});
});

describe("listHeadings / findHeadingLine (calendar lookup)", () => {
	const content = md(
		"---",
		"title: x",
		"---",
		TODAY,
		"- a",
		"#tag is not a heading",
		"",
		"```",
		"### 2026-01-01 Thursday",
		"```",
		"### 2026-10-12 Monday",
	);

	test("lists headings outside frontmatter and code blocks", () => {
		assert.deepEqual(listHeadings(content), [
			{ line: 3, level: 3, text: "2026-10-15 Thursday" },
			{ line: 10, level: 3, text: "2026-10-12 Monday" },
		]);
	});

	test("finds a heading by full line", () => {
		assert.equal(findHeadingLine(content, "### 2026-10-12 Monday"), 10);
		assert.equal(findHeadingLine(content, "### 2026-01-01 Thursday"), -1);
		assert.equal(findHeadingLine(content, "#### 2026-10-12 Monday"), -1);
	});
});

describe("indexHeadings (calendar dots)", () => {
	test("maps heading text to line for the given level only", () => {
		const content = md(TODAY, "- a", "#### 2026-10-14 Wednesday", "", "### 2026-10-12 Monday", "### 2026-10-12 Monday");
		assert.deepEqual(
			[...indexHeadings(content, 3)],
			[
				["2026-10-15 Thursday", 0],
				["2026-10-12 Monday", 4],
			],
		);
	});

	test("empty journal", () => {
		assert.equal(indexHeadings("", 3).size, 0);
	});
});
