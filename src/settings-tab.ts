import { App, Notice, Plugin, PluginSettingTab, Setting, moment, type SettingDefinitionItem } from "obsidian";
import { ConfirmModal } from "./confirm-modal.ts";
import { findConflicts, type DetectedConflict } from "./conflicts.ts";
import type { Translator } from "./i18n.ts";
import { buildHeading } from "./journal.ts";
import { disablePlugin, pluginState } from "./plugin-control.ts";
import {
	DEFAULT_SETTINGS,
	MAX_TAG_COUNT,
	normalizeJournalPath,
	type UnidailySettings,
} from "./settings.ts";

/** What the settings page needs from the plugin. */
export interface SettingsHost extends Plugin {
	settings: UnidailySettings;
	t: Translator;
	saveSettings(): Promise<void>;
}

/** One row of the settings page: name and description (also used for search) plus its control. */
interface SettingRow {
	name: string;
	desc: string;
	render: (setting: Setting) => void;
}

/**
 * Settings page. The rows are defined once and rendered two ways:
 * declaratively through `getSettingDefinitions()` on Obsidian 1.13+, which
 * makes them findable in the settings search, and through `display()` on
 * older versions.
 */
export class UnidailySettingTab extends PluginSettingTab {
	private readonly host: SettingsHost;
	private previewEl: HTMLElement | null = null;

	constructor(app: App, host: SettingsHost) {
		super(app, host);
		this.host = host;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.rows().map(({ name, desc, render }) => ({ name, desc, render: (setting) => render(setting) }));
	}

	/** Fallback for Obsidian versions before 1.13, which don't call `getSettingDefinitions()`. */
	display(): void {
		this.containerEl.empty();
		for (const { name, desc, render } of this.rows()) {
			render(new Setting(this.containerEl).setName(name).setDesc(desc));
		}
	}

	private rows(): SettingRow[] {
		const { settings, t } = this.host;
		const save = () => this.host.saveSettings();

		return [
			{
				// Read from manifest.json, so it always matches the installed build.
				name: t("settings.version.name"),
				desc: this.host.manifest.version,
				render: () => {},
			},
			{
				name: t("settings.journalPath.name"),
				desc: t("settings.journalPath.desc"),
				render: (setting) => {
					setting.addText((text) =>
						text
							.setPlaceholder(DEFAULT_SETTINGS.journalPath)
							.setValue(settings.journalPath)
							.onChange(async (value) => {
								settings.journalPath = normalizeJournalPath(value);
								await save();
							}),
					);
				},
			},
			{
				name: t("settings.headingLevel.name"),
				desc: t("settings.headingLevel.desc"),
				render: (setting) => {
					setting.addDropdown((dropdown) => {
						for (let level = 1; level <= 6; level++) {
							dropdown.addOption(String(level), "#".repeat(level));
						}
						dropdown.setValue(String(settings.headingLevel)).onChange(async (value) => {
							settings.headingLevel = Number(value);
							this.updatePreview();
							await save();
						});
					});
				},
			},
			{
				name: t("settings.dateFormat.name"),
				desc: t("settings.dateFormat.desc"),
				render: (setting) => {
					setting.addText((text) =>
						text
							.setPlaceholder(DEFAULT_SETTINGS.dateFormat)
							.setValue(settings.dateFormat)
							.onChange(async (value) => {
								settings.dateFormat = value.trim() || DEFAULT_SETTINGS.dateFormat;
								this.updatePreview();
								await save();
							}),
					);
					this.previewEl = setting.descEl.createDiv({ cls: "unidaily-setting-preview" });
					setting.descEl.createDiv({ text: t("settings.formatWarning"), cls: "mod-warning" });
					this.updatePreview();
				},
			},
			this.countRow("recentTagCount", t("settings.recentCount.name"), t("settings.recentCount.desc")),
			this.countRow("frequentTagCount", t("settings.frequentCount.name"), t("settings.frequentCount.desc")),
			{
				name: t("settings.openCalendar.name"),
				desc: t("settings.openCalendar.desc"),
				render: (setting) => {
					setting.addToggle((toggle) =>
						toggle.setValue(settings.openCalendarOnStartup).onChange(async (value) => {
							settings.openCalendarOnStartup = value;
							await save();
						}),
					);
				},
			},
			{
				name: t("settings.jumpToday.name"),
				desc: t("settings.jumpToday.desc"),
				render: (setting) => {
					setting.addToggle((toggle) =>
						toggle.setValue(settings.jumpToTodayOnOpen).onChange(async (value) => {
							settings.jumpToTodayOnOpen = value;
							await save();
						}),
					);
				},
			},
			{
				name: t("settings.listMarker.name"),
				desc: t("settings.listMarker.desc"),
				render: (setting) => {
					setting.addToggle((toggle) =>
						toggle.setValue(settings.listMarkerOnNewDay).onChange(async (value) => {
							settings.listMarkerOnNewDay = value;
							await save();
						}),
					);
				},
			},
			{
				name: t("settings.conflicts.name"),
				desc: t("settings.conflicts.desc"),
				render: (setting) => {
					const list = setting.descEl.createDiv({ cls: "unidaily-conflicts" });
					this.renderConflicts(list);
				},
			},
		];
	}

	/** Lists enabled plugins that create one file per day, each with a turn-off button (FR-18). */
	private renderConflicts(list: HTMLElement): void {
		const { t } = this.host;
		list.empty();
		const report = findConflicts(pluginState(this.app));
		for (const conflict of report.conflicts) {
			const row = list.createDiv({ cls: "unidaily-conflict" });
			row.createSpan({ cls: "unidaily-conflict-name", text: this.conflictLabel(conflict) });
			row.createEl("button", { cls: "mod-warning", text: t("settings.conflicts.disable") }).addEventListener(
				"click",
				() => this.confirmDisable(conflict, list),
			);
		}
		if (report.conflicts.length === 0) {
			list.createDiv({ cls: "unidaily-conflict-ok", text: t("settings.conflicts.none") });
		}
		if (report.unknown) {
			list.createDiv({ cls: "mod-warning", text: t("settings.conflicts.unknown") });
		}
	}

	private conflictLabel(conflict: DetectedConflict): string {
		const { t } = this.host;
		const name = conflict.id === "daily-notes" ? t("conflict.dailyNotes") : conflict.name;
		return `${name} · ${t(conflict.kind === "core" ? "conflict.core" : "conflict.community")}`;
	}

	private confirmDisable(conflict: DetectedConflict, list: HTMLElement): void {
		const { t } = this.host;
		const name = this.conflictLabel(conflict);
		new ConfirmModal(this.app, {
			title: t("conflict.confirmTitle"),
			message: t("conflict.confirmMessage", { name }),
			confirm: t("settings.conflicts.disable"),
			cancel: t("modal.cancel"),
			warning: true,
			onConfirm: () => {
				void (async () => {
					const ok = await disablePlugin(this.app, conflict.kind, conflict.id);
					new Notice(t(ok ? "notice.pluginDisabled" : "notice.pluginDisableFailed", { name }));
					this.renderConflicts(list);
				})();
			},
		}).open();
	}

	private countRow(field: "recentTagCount" | "frequentTagCount", name: string, desc: string): SettingRow {
		const { settings } = this.host;
		return {
			name,
			desc,
			render: (setting) => {
				setting.addSlider((slider) =>
					slider
						.setLimits(0, MAX_TAG_COUNT, 1)
						.setValue(settings[field])
						.onChange(async (value) => {
							settings[field] = value;
							await this.host.saveSettings();
						}),
				);
			},
		};
	}

	/** Shows today's heading with the current level and format. */
	private updatePreview(): void {
		const { settings, t } = this.host;
		this.previewEl?.setText(
			t("settings.dateFormat.preview", {
				heading: buildHeading(settings.headingLevel, moment().format(settings.dateFormat)),
			}),
		);
	}
}
