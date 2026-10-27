import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
	addedLinks,
	fileNameOfPath,
	fileUrlToPath,
	findFileLinks,
	relativeToVault,
} from "../src/external-links.ts";

// All paths below are made up. Folder names start with a digit so the
// privacy scan before publishing doesn't take them for real local paths.
const PDF = "file:///C:/0/docs/a%20b.pdf";

describe("findFileLinks (FR-21)", () => {
	test("a Markdown link to a file outside the vault", () => {
		const text = `- see [a b.pdf](${PDF}) here`;
		const [link] = findFileLinks(text);
		assert.equal(link?.url, PDF);
		assert.equal(text.slice(link?.from, link?.to), `[a b.pdf](${PDF})`);
	});

	test("embeds and angle-bracket links are found too", () => {
		const text = `![x](file:///C:/0/x.png)\n<file:///C:/0/y.txt>`;
		assert.deepEqual(
			findFileLinks(text).map((l) => [l.url, text.slice(l.from, l.to)]),
			[
				["file:///C:/0/x.png", "![x](file:///C:/0/x.png)"],
				["file:///C:/0/y.txt", "<file:///C:/0/y.txt>"],
			],
		);
	});

	test("remembers whether the link is shown inside the note", () => {
		const text = `[a](file:///C:/0/a.pdf) ![b](file:///C:/0/b.png) <file:///C:/0/c.txt>`;
		assert.deepEqual(
			findFileLinks(text).map((l) => l.embed),
			[false, true, false],
		);
	});

	test("other links, wikilinks and plain text are ignored", () => {
		const text = "[app](obsidian://open?file=a) [rel](0/a.pdf) [[a.pdf]] ![[b.png]] file:///C:/0/bare.pdf";
		assert.deepEqual(findFileLinks(text), []);
	});

	test("labels in other scripts are fine", () => {
		const url = "file:///C:/0/%E6%B5%8B%E8%AF%95%E6%A1%88%E4%BE%8B.pdf";
		assert.equal(findFileLinks(`[测试案例.pdf](${url})`)[0]?.url, url);
	});
});

describe("addedLinks", () => {
	const link = (url: string, from = 0) => ({ from, to: from + 1, url, embed: false });

	test("only the new link is returned", () => {
		const before = [link("file:///C:/0/a.pdf")];
		const after = [link("file:///C:/0/a.pdf"), link("file:///C:/0/b.pdf", 10)];
		assert.deepEqual(addedLinks(before, after), [link("file:///C:/0/b.pdf", 10)]);
	});

	test("the same file dropped again counts as new", () => {
		const before = [link("file:///C:/0/a.pdf")];
		const after = [link("file:///C:/0/a.pdf"), link("file:///C:/0/a.pdf", 10)];
		assert.deepEqual(addedLinks(before, after), [link("file:///C:/0/a.pdf", 10)]);
	});

	test("nothing new", () => {
		const links = [link("file:///C:/0/a.pdf")];
		assert.deepEqual(addedLinks(links, links), []);
		assert.deepEqual(addedLinks([], []), []);
	});
});

describe("fileUrlToPath", () => {
	test("Windows drive, with escaped characters", () => {
		assert.equal(fileUrlToPath(PDF), "C:/0/docs/a b.pdf");
		assert.equal(fileUrlToPath("file:///C:/%E6%B5%8B%E8%AF%95.pdf"), "C:/测试.pdf");
	});

	test("macOS / Linux", () => {
		assert.equal(fileUrlToPath("file:///Volumes/0/a.pdf"), "/Volumes/0/a.pdf");
		assert.equal(fileUrlToPath("file://localhost/home/a.pdf"), "/home/a.pdf");
	});

	test("network share", () => {
		assert.equal(fileUrlToPath("file://server/share/a.pdf"), "//server/share/a.pdf");
	});

	test("not a file URL, or broken", () => {
		assert.equal(fileUrlToPath("obsidian://open?file=a.pdf"), null);
		assert.equal(fileUrlToPath("0/a.pdf"), null);
		assert.equal(fileUrlToPath("file://"), null);
		assert.equal(fileUrlToPath("file:///C:/%E6%B5.pdf"), null);
	});
});

describe("fileNameOfPath", () => {
	test("either kind of slash", () => {
		assert.equal(fileNameOfPath("C:/0/docs/a b.pdf"), "a b.pdf");
		assert.equal(fileNameOfPath("C:\\0\\docs\\a.pdf"), "a.pdf");
		assert.equal(fileNameOfPath("a.pdf"), "a.pdf");
	});
});

describe("relativeToVault", () => {
	test("inside the vault", () => {
		assert.equal(relativeToVault("D:/0/Notes/files/a.pdf", "D:\\0\\Notes"), "files/a.pdf");
		assert.equal(relativeToVault("d:/0/notes/a.pdf", "D:\\0\\Notes\\"), "a.pdf");
		assert.equal(relativeToVault("/home/0/Notes/a.pdf", "/home/0/Notes"), "a.pdf");
	});

	test("outside the vault", () => {
		assert.equal(relativeToVault("C:/0/docs/a.pdf", "D:\\0\\Notes"), null);
		assert.equal(relativeToVault("D:/0/Notes2/a.pdf", "D:\\0\\Notes"), null);
		assert.equal(relativeToVault("/home/0/notes/a.pdf", "/home/0/Notes"), null);
		assert.equal(relativeToVault("D:/0/Notes", "D:\\0\\Notes"), null);
		assert.equal(relativeToVault("D:/0/Notes/a.pdf", ""), null);
	});
});
