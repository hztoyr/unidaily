import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createTranslator, resolveLocale } from "../src/i18n.ts";

describe("resolveLocale", () => {
	test("Chinese variants map to zh", () => {
		assert.equal(resolveLocale("zh"), "zh");
		assert.equal(resolveLocale("zh-TW"), "zh");
	});

	test("everything else falls back to en", () => {
		assert.equal(resolveLocale("en"), "en");
		assert.equal(resolveLocale("ja"), "en");
		assert.equal(resolveLocale(""), "en");
	});
});

describe("createTranslator", () => {
	test("picks the table by language", () => {
		assert.equal(createTranslator("en")("command.captureNote"), "Capture note");
		assert.equal(createTranslator("zh")("command.captureNote"), "记一笔");
		assert.equal(createTranslator("fr")("command.captureTask"), "Capture task");
	});

	test("fills placeholders", () => {
		const t = createTranslator("zh");
		assert.equal(t("notice.saved", { file: "Daily Notes.md" }), "已记录到 Daily Notes.md");
		assert.equal(
			t("modal.title", { command: t("command.captureNote"), file: "Daily Notes.md" }),
			"记一笔 → Daily Notes.md",
		);
	});

	test("leaves unknown placeholders untouched", () => {
		assert.equal(createTranslator("en")("notice.saved", {}), "Saved to {file}");
	});

	test("does not re-expand placeholders found inside values", () => {
		assert.equal(createTranslator("en")("notice.saved", { file: "{error}.md" }), "Saved to {error}.md");
	});
});
