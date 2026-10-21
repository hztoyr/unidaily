import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
	applyTag,
	countTags,
	extractTags,
	filterTags,
	frequentTags,
	hasTag,
	recentTags,
	splitTags,
	tagQueryAt,
	toggleTag,
} from "../src/tags.ts";

const md = (...lines: string[]) => lines.join("\n") + "\n";

describe("extractTags", () => {
	test("finds tags in order, duplicates kept", () => {
		assert.deepEqual(extractTags("- 对齐接口 #工作 和 #读书 #工作"), ["#工作", "#读书", "#工作"]);
	});

	test("nested tags, digits, underscore and dash", () => {
		assert.deepEqual(extractTags("#work/meeting #y2026 #to_do #a-b"), ["#work/meeting", "#y2026", "#to_do", "#a-b"]);
	});

	test("purely numeric is not a tag", () => {
		assert.deepEqual(extractTags("issue #2026 fixed"), []);
	});

	test("must start the line or follow whitespace", () => {
		assert.deepEqual(extractTags("a#b https://x.com/#anchor #ok"), ["#ok"]);
	});

	test("headings are not tags", () => {
		assert.deepEqual(extractTags("### 2026-10-15 Thursday"), []);
		assert.deepEqual(extractTags("# Title"), []);
	});

	test("stops at punctuation, including full-width", () => {
		assert.deepEqual(extractTags("跑步了#跑步，很累 (#健身)"), []);
		assert.deepEqual(extractTags("今天 #跑步，很累。#健身!"), ["#跑步"]);
	});

	test("ignores inline code", () => {
		assert.deepEqual(extractTags("use `#not` but #yes"), ["#yes"]);
	});
});

describe("recentTags (FR-3)", () => {
	const journal = md(
		"### 2026-10-15 Thursday",
		"- 对齐接口 #工作",
		"- 晚上跑步 #跑步 #健身",
		"",
		"### 2026-10-12 Monday",
		"- 读完一本书 #读书 #工作",
		"- 想到一点 #想法",
	);

	test("first occurrence from the top wins, deduplicated", () => {
		assert.deepEqual(recentTags(journal, 10), ["#工作", "#跑步", "#健身", "#读书", "#想法"]);
	});

	test("respects the limit", () => {
		assert.deepEqual(recentTags(journal, 2), ["#工作", "#跑步"]);
	});

	test("limit 0 hides the row", () => {
		assert.deepEqual(recentTags(journal, 0), []);
	});

	test("case-insensitive dedupe keeps the first spelling", () => {
		assert.deepEqual(recentTags(md("- #Work", "- #work #WORK #home"), 10), ["#Work", "#home"]);
	});

	test("skips frontmatter and code blocks", () => {
		const content = md("---", "aliases: \"#fm\"", "---", "```", "#code", "```", "- #real");
		assert.deepEqual(recentTags(content, 10), ["#real"]);
	});

	test("empty journal", () => {
		assert.deepEqual(recentTags("", 6), []);
	});
});

describe("countTags / frequentTags (FR-4)", () => {
	test("counts uses across files", () => {
		const counts = countTags([["#a", "#b", "#a"], ["#b"], [], ["#a"]]);
		assert.deepEqual([...counts], [["#a", 3], ["#b", 2]]);
	});

	test("sorted by count, ties by name", () => {
		const counts = new Map([["#读书", 3], ["#工作", 9], ["#b", 3], ["#a", 3], ["#家里", 5]]);
		assert.deepEqual(frequentTags(counts, 10), ["#工作", "#家里", "#a", "#b", "#读书"]);
	});

	test("respects the limit; 0 hides the row", () => {
		const counts = new Map([["#a", 3], ["#b", 2], ["#c", 1]]);
		assert.deepEqual(frequentTags(counts, 2), ["#a", "#b"]);
		assert.deepEqual(frequentTags(counts, 0), []);
	});

	test("merges case variants under the most-used spelling", () => {
		const counts = new Map([["#work", 2], ["#Work", 5], ["#home", 6]]);
		assert.deepEqual(frequentTags(counts, 10), ["#Work", "#home"]);
	});

	test("adds a missing leading #", () => {
		assert.deepEqual(frequentTags(new Map([["tag", 1]]), 10), ["#tag"]);
	});
});

describe("hasTag / toggleTag (FR-5)", () => {
	test("whole-tag matching, case-insensitive", () => {
		assert.equal(hasTag("开会 #工作", "#工作"), true);
		assert.equal(hasTag("开会 #Work", "#work"), true);
		assert.equal(hasTag("开会 #工作/会议", "#工作"), false);
		assert.equal(hasTag("开会 #工作区", "#工作"), false);
		assert.equal(hasTag("开会#工作", "#工作"), false);
		assert.equal(hasTag("开会 #工作，下午", "#工作"), true);
	});

	test("appends with one space before and one after, ready to keep typing", () => {
		assert.equal(toggleTag("开会", "#工作"), "开会 #工作 ");
		assert.equal(toggleTag("开会   ", "#工作"), "开会 #工作 ");
		assert.equal(toggleTag("", "#工作"), "#工作 ");
	});

	test("several clicks in a row keep single spaces", () => {
		let text = "";
		text = toggleTag(text, "#a");
		text = toggleTag(text, "#b");
		text = toggleTag(text, "#c");
		assert.equal(text, "#a #b #c ");
	});

	test("removes and tidies spacing, leaving one trailing space", () => {
		assert.equal(toggleTag("开会 #工作", "#工作"), "开会 ");
		assert.equal(toggleTag("#工作 开会", "#工作"), "开会 ");
		assert.equal(toggleTag("早上 #工作 开会 #读书", "#工作"), "早上 开会 #读书 ");
		assert.equal(toggleTag("#工作 a #工作", "#工作"), "a ");
		assert.equal(toggleTag("开会 #工作 ", "#工作"), "开会 ");
	});

	test("removing the only tag leaves an empty box", () => {
		assert.equal(toggleTag("#工作 ", "#工作"), "");
	});

	test("does not touch longer tags when removing", () => {
		assert.equal(toggleTag("#工作 #工作/会议", "#工作"), "#工作/会议 ");
	});

	test("toggling twice restores the text (plus the trailing space)", () => {
		assert.equal(toggleTag(toggleTag("开会", "#a.b+c"), "#a.b+c"), "开会 ");
	});
});

describe("tagQueryAt / filterTags / applyTag (FR-6)", () => {
	test("detects a partial tag before the caret", () => {
		assert.deepEqual(tagQueryAt("开会 #工", 5), { start: 3, end: 5, query: "工" });
		assert.deepEqual(tagQueryAt("#", 1), { start: 0, end: 1, query: "" });
	});

	test("includes tag characters after the caret", () => {
		// caret between "#wo" and "rk"
		assert.deepEqual(tagQueryAt("a #work b", 5), { start: 2, end: 7, query: "wo" });
	});

	test("no query outside a tag", () => {
		assert.equal(tagQueryAt("开会", 2), null);
		assert.equal(tagQueryAt("a#b", 3), null);
		assert.equal(tagQueryAt("#work done", 10), null);
		assert.equal(tagQueryAt("#work ", 6), null);
	});

	test("filters case-insensitively, prefix matches first, order kept", () => {
		const tags = ["#Work/meeting", "#homework", "#work", "#读书"];
		assert.deepEqual(filterTags(tags, "wo"), ["#Work/meeting", "#work", "#homework"]);
		assert.deepEqual(filterTags(tags, ""), tags);
		assert.deepEqual(filterTags(tags, "xyz"), []);
	});

	test("replaces the partial tag and adds one space", () => {
		const text = "开会 #工";
		const q = tagQueryAt(text, 5);
		assert.ok(q);
		assert.deepEqual(applyTag(text, q, "#工作"), { text: "开会 #工作 ", caret: 7 });
	});

	test("replaces in the middle without doubling spaces", () => {
		const text = "a #wo b";
		const q = tagQueryAt(text, 5);
		assert.ok(q);
		assert.deepEqual(applyTag(text, q, "#work"), { text: "a #work b", caret: 8 });
	});

	test("caret inside a tag replaces the whole tag", () => {
		const text = "a #wxyz";
		const q = tagQueryAt(text, 4);
		assert.ok(q);
		assert.deepEqual(applyTag(text, q, "#work"), { text: "a #work ", caret: 8 });
	});
});

describe("splitTags (coloured tags in the input, FR-2)", () => {
	const join = (text: string) => splitTags(text).map((p) => p.text).join("");

	test("plain text and tags, in order", () => {
		assert.deepEqual(splitTags("开会 #工作 下午 #Party/党费 "), [
			{ text: "开会 ", tag: false },
			{ text: "#工作", tag: true },
			{ text: " 下午 ", tag: false },
			{ text: "#Party/党费", tag: true },
			{ text: " ", tag: false },
		]);
	});

	test("tag at the very start and end", () => {
		assert.deepEqual(splitTags("#a x #b"), [
			{ text: "#a", tag: true },
			{ text: " x ", tag: false },
			{ text: "#b", tag: true },
		]);
	});

	test("not tags: numbers only, glued to text, inside inline code", () => {
		assert.deepEqual(splitTags("issue #2026 a#b `#code` ok"), [{ text: "issue #2026 a#b `#code` ok", tag: false }]);
	});

	test("punctuation ends a tag", () => {
		assert.deepEqual(splitTags("#跑步，很累"), [
			{ text: "#跑步", tag: true },
			{ text: "，很累", tag: false },
		]);
	});

	test("joining the parts gives back the text exactly", () => {
		for (const text of ["", "   ", "#a  #b ", "x #XYLRBC/V2_4_0-2 y", "#", "a # b"]) assert.equal(join(text), text);
	});

	test("empty text gives no parts", () => {
		assert.deepEqual(splitTags(""), []);
	});
});
