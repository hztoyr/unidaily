import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, normalizeJournalPath, normalizeSettings } from "../src/settings.ts";

describe("normalizeJournalPath", () => {
	test("keeps a valid path", () => {
		assert.equal(normalizeJournalPath("Daily Notes.md"), "Daily Notes.md");
		assert.equal(normalizeJournalPath("Journal/2026.md"), "Journal/2026.md");
	});

	test("adds the .md extension", () => {
		assert.equal(normalizeJournalPath("Journal/Daily"), "Journal/Daily.md");
		assert.equal(normalizeJournalPath("Daily.MD"), "Daily.MD");
	});

	test("cleans slashes and spaces", () => {
		assert.equal(normalizeJournalPath("  /Journal\\\\Daily Notes.md/ "), "Journal/Daily Notes.md");
		assert.equal(normalizeJournalPath("a// b /c"), "a/b/c.md");
	});

	test("empty input falls back to the default", () => {
		assert.equal(normalizeJournalPath(""), DEFAULT_SETTINGS.journalPath);
		assert.equal(normalizeJournalPath(" / "), DEFAULT_SETTINGS.journalPath);
	});
});

describe("normalizeSettings", () => {
	test("nothing stored yields the defaults", () => {
		assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
		assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
		assert.deepEqual(normalizeSettings("junk"), DEFAULT_SETTINGS);
	});

	test("valid values are kept", () => {
		const stored = {
			journalPath: "Journal/Log.md",
			headingLevel: 2,
			dateFormat: "YYYY/MM/DD",
			recentTagCount: 0,
			frequentTagCount: 10,
			openCalendarOnStartup: false,
			jumpToTodayOnOpen: false,
			listMarkerOnNewDay: false,
		};
		assert.deepEqual(normalizeSettings(stored), stored);
	});

	test("missing fields fall back individually", () => {
		assert.deepEqual(normalizeSettings({ headingLevel: 4 }), { ...DEFAULT_SETTINGS, headingLevel: 4 });
	});

	test("out-of-range numbers are clamped and rounded", () => {
		const s = normalizeSettings({ headingLevel: 9, recentTagCount: -3, frequentTagCount: 7.6 });
		assert.equal(s.headingLevel, 6);
		assert.equal(s.recentTagCount, 0);
		assert.equal(s.frequentTagCount, 8);
		assert.equal(normalizeSettings({ frequentTagCount: 500 }).frequentTagCount, 20);
	});

	test("wrong types fall back to the defaults", () => {
		const s = normalizeSettings({
			journalPath: 42,
			headingLevel: "3",
			dateFormat: "  ",
			recentTagCount: NaN,
			openCalendarOnStartup: "false",
			jumpToTodayOnOpen: 1,
			listMarkerOnNewDay: "yes",
		});
		assert.deepEqual(s, DEFAULT_SETTINGS);
	});

	test("calendar on startup defaults to on", () => {
		assert.equal(normalizeSettings({}).openCalendarOnStartup, true);
		assert.equal(normalizeSettings({ openCalendarOnStartup: false }).openCalendarOnStartup, false);
	});

	test("jump to today on open defaults to on, also for settings saved by older versions", () => {
		assert.equal(normalizeSettings({}).jumpToTodayOnOpen, true);
		assert.equal(normalizeSettings({ openCalendarOnStartup: false }).jumpToTodayOnOpen, true);
		assert.equal(normalizeSettings({ jumpToTodayOnOpen: false }).jumpToTodayOnOpen, false);
	});

	test("list marker on a new day defaults to on, also for settings saved by older versions", () => {
		assert.equal(normalizeSettings({}).listMarkerOnNewDay, true);
		assert.equal(normalizeSettings({ jumpToTodayOnOpen: false }).listMarkerOnNewDay, true);
		assert.equal(normalizeSettings({ listMarkerOnNewDay: false }).listMarkerOnNewDay, false);
	});

	test("unknown fields are dropped", () => {
		assert.deepEqual(normalizeSettings({ legacy: true }), DEFAULT_SETTINGS);
	});
});
