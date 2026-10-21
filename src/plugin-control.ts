/**
 * Reads and turns off other plugins (FR-18).
 *
 * Obsidian's public API has no way to do this, so this file uses the
 * undocumented `app.internalPlugins` and `app.plugins` objects. This is the
 * only place in Unidaily that does (an agreed exception to NFR-4). Every access
 * is guarded: if Obsidian changes these objects, detection reports "unknown"
 * and turning off reports failure, without throwing.
 */

import type { App } from "obsidian";
import type { PluginKind, PluginState } from "./conflicts.ts";

interface InternalPlugin {
	enabled?: unknown;
	disable?: (save?: boolean) => unknown;
}

interface InternalApp {
	internalPlugins?: {
		getPluginById?: (id: string) => InternalPlugin | null | undefined;
	};
	plugins?: {
		enabledPlugins?: Set<string>;
		manifests?: Record<string, { name?: unknown } | undefined>;
		disablePluginAndSave?: (id: string) => Promise<unknown>;
	};
}

function internals(app: App): InternalApp {
	return app as unknown as InternalApp;
}

export function pluginState(app: App): PluginState {
	const { internalPlugins, plugins } = internals(app);
	return {
		isEnabled(kind: PluginKind, id: string): boolean | null {
			try {
				if (kind === "core") {
					if (typeof internalPlugins?.getPluginById !== "function") return null;
					const plugin = internalPlugins.getPluginById(id);
					if (!plugin) return false;
					return typeof plugin.enabled === "boolean" ? plugin.enabled : null;
				}
				const enabled = plugins?.enabledPlugins;
				return enabled instanceof Set ? enabled.has(id) : null;
			} catch {
				return null;
			}
		},
		nameOf(kind: PluginKind, id: string): string | null {
			if (kind !== "community") return null;
			const name = plugins?.manifests?.[id]?.name;
			return typeof name === "string" && name !== "" ? name : null;
		},
	};
}

/** Turns a plugin off and saves that choice. Returns false if it couldn't. */
export async function disablePlugin(app: App, kind: PluginKind, id: string): Promise<boolean> {
	const { internalPlugins, plugins } = internals(app);
	try {
		if (kind === "core") {
			const plugin = internalPlugins?.getPluginById?.(id);
			if (!plugin || typeof plugin.disable !== "function") return false;
			await plugin.disable(true);
		} else {
			if (typeof plugins?.disablePluginAndSave !== "function") return false;
			await plugins.disablePluginAndSave(id);
		}
	} catch (error) {
		console.error("Unidaily: could not turn off plugin", id, error);
		return false;
	}
	return pluginState(app).isEnabled(kind, id) === false;
}
