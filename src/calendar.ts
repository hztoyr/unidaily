/**
 * Pure calendar math for the sidebar view. Months are 0-based like `Date`.
 */

export interface GridDay {
	year: number;
	/** 0-based month. */
	month: number;
	day: number;
	/** False for the leading and trailing days of the neighbouring months. */
	inMonth: boolean;
}

/**
 * Weeks of the month as rows of 7 days, starting on `firstDayOfWeek`
 * (0 = Sunday … 6 = Saturday). Only as many rows as needed (4–6).
 */
export function monthGrid(year: number, month: number, firstDayOfWeek: number): GridDay[][] {
	const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
	const offset = (firstWeekday - firstDayOfWeek + 7) % 7;
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

	const weeks: GridDay[][] = [];
	for (let i = 0; i < cells; i++) {
		const date = new Date(Date.UTC(year, month, 1 - offset + i));
		if (i % 7 === 0) weeks.push([]);
		weeks[weeks.length - 1]?.push({
			year: date.getUTCFullYear(),
			month: date.getUTCMonth(),
			day: date.getUTCDate(),
			inMonth: date.getUTCMonth() === month,
		});
	}
	return weeks;
}
