/**
 * Plugins that create a separate note for each day, which works against
 * Unidaily's single journal file (FR-18). This module only decides which of
 * them are enabled; reading and changing plugin state lives in
 * `plugin-control.ts`.
 */

export type PluginKind = "core" | "community";

export interface KnownConflict {
	id: string;
	kind: PluginKind;
	/** Shown when the plugin's own name can't be read. */
	fallbackName: string;
}

/** Plugins known to create one file per day. */
export const KNOWN_CONFLICTS: readonly KnownConflict[] = [
	{ id: "daily-notes", kind: "core", fallbackName: "Daily notes" },
	{ id: "calendar", kind: "community", fallbackName: "Calendar" },
	{ id: "periodic-notes", kind: "community", fallbackName: "Periodic Notes" },
	{ id: "journals", kind: "community", fallbackName: "Journals" },
];

/** Read-only view of other plugins. `null` means the state could not be read. */
export interface PluginState {
	isEnabled(kind: PluginKind, id: string): boolean | null;
	nameOf(kind: PluginKind, id: string): string | null;
}

export interface DetectedConflict {
	id: string;
	kind: PluginKind;
	name: string;
}

export interface ConflictReport {
	/** Conflicting plugins that are currently enabled. */
	conflicts: DetectedConflict[];
	/** True when at least one plugin's state could not be read. */
	unknown: boolean;
}

export function findConflicts(state: PluginState, known: readonly KnownConflict[] = KNOWN_CONFLICTS): ConflictReport {
	const conflicts: DetectedConflict[] = [];
	let unknown = false;
	for (const { id, kind, fallbackName } of known) {
		const enabled = state.isEnabled(kind, id);
		if (enabled === null) unknown = true;
		else if (enabled) conflicts.push({ id, kind, name: state.nameOf(kind, id) ?? fallbackName });
	}
	return { conflicts, unknown };
}
