import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { KNOWN_CONFLICTS, findConflicts, type PluginKind, type PluginState } from "../src/conflicts.ts";

/** Fake plugin state: ids listed are enabled; `broken` makes a kind unreadable. */
function fakeState(
	enabled: { core?: string[]; community?: string[] },
	names: Record<string, string> = {},
	broken: PluginKind[] = [],
): PluginState {
	return {
		isEnabled: (kind, id) => (broken.includes(kind) ? null : (enabled[kind] ?? []).includes(id)),
		nameOf: (kind, id) => (kind === "community" ? (names[id] ?? null) : null),
	};
}

describe("findConflicts (FR-18)", () => {
	test("nothing enabled", () => {
		assert.deepEqual(findConflicts(fakeState({})), { conflicts: [], unknown: false });
	});

	test("core Daily notes enabled", () => {
		assert.deepEqual(findConflicts(fakeState({ core: ["daily-notes"] })), {
			conflicts: [{ id: "daily-notes", kind: "core", name: "Daily notes" }],
			unknown: false,
		});
	});

	test("community plugins use their own names, falling back to the known name", () => {
		const report = findConflicts(fakeState({ community: ["calendar", "periodic-notes"] }, { calendar: "Calendar Plus" }));
		assert.deepEqual(report.conflicts, [
			{ id: "calendar", kind: "community", name: "Calendar Plus" },
			{ id: "periodic-notes", kind: "community", name: "Periodic Notes" },
		]);
	});

	test("plugins not on the list are ignored", () => {
		assert.deepEqual(findConflicts(fakeState({ community: ["dataview", "unidaily"] })).conflicts, []);
	});

	test("an unreadable plugin state is reported as unknown, not as a conflict", () => {
		const report = findConflicts(fakeState({ core: ["daily-notes"] }, {}, ["community"]));
		assert.equal(report.unknown, true);
		assert.deepEqual(report.conflicts, [{ id: "daily-notes", kind: "core", name: "Daily notes" }]);
	});

	test("the list covers core Daily notes and the usual daily-note plugins", () => {
		assert.deepEqual(
			KNOWN_CONFLICTS.map((c) => `${c.kind}:${c.id}`),
			["core:daily-notes", "community:calendar", "community:periodic-notes", "community:journals"],
		);
	});
});
