import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { monthGrid, type GridDay } from "../src/calendar.ts";

const key = (d: GridDay | undefined) => (d ? `${d.year}-${d.month + 1}-${d.day}` : "none");

describe("monthGrid", () => {
	test("October 2026, weeks start on Sunday", () => {
		const weeks = monthGrid(2026, 9, 0);
		assert.equal(weeks.length, 5);
		assert.ok(weeks.every((w) => w.length === 7));
		assert.equal(key(weeks[0]?.[0]), "2026-9-27");
		assert.equal(key(weeks[0]?.[4]), "2026-10-1");
		assert.equal(key(weeks[4]?.[6]), "2026-10-31");
	});

	test("October 2026, weeks start on Monday", () => {
		const weeks = monthGrid(2026, 9, 1);
		assert.equal(key(weeks[0]?.[0]), "2026-9-28");
		assert.equal(key(weeks[0]?.[3]), "2026-10-1");
		assert.equal(key(weeks.at(-1)?.at(-1)), "2026-11-1");
	});

	test("marks days of neighbouring months", () => {
		const days = monthGrid(2026, 9, 0).flat();
		assert.equal(days.filter((d) => d.inMonth).length, 31);
		assert.equal(days[0]?.inMonth, false);
		assert.equal(days[4]?.inMonth, true);
	});

	test("four rows when the month fits exactly (February 2026)", () => {
		assert.equal(monthGrid(2026, 1, 0).length, 4);
	});

	test("six rows when needed (August 2026)", () => {
		assert.equal(monthGrid(2026, 7, 0).length, 6);
	});

	test("crosses the year boundary", () => {
		const weeks = monthGrid(2027, 0, 1);
		assert.equal(key(weeks[0]?.[0]), "2026-12-28");
	});

	test("leap year February", () => {
		const days = monthGrid(2028, 1, 0).flat().filter((d) => d.inMonth);
		assert.equal(days.length, 29);
	});
});
