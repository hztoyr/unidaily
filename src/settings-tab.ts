import { App, Plugin, PluginSettingTab, Setting, moment } from "obsidian";
import type { Translator } from "./i18n.ts";
import { buildHeading } from "./journal.ts";
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

export class UnidailySettingTab extends PluginSettingTab {
	private readonly host: SettingsHost;

	constructor(app: App, host: SettingsHost) {
		super(app, host);
		this.host = host;
	}

	display(): void {
		const { containerEl } = this;
		const { settings, t } = this.host;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t("settings.journalPath.name"))
			.setDesc(t("settings.journalPath.desc"))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.journalPath)
					.setValue(settings.journalPath)
					.onChange(async (value) => {
						settings.journalPath = normalizeJournalPath(value);
						await this.host.saveSettings();
					}),
			);

		let previewEl: HTMLElement | null = null;
		const updatePreview = () => {
			previewEl?.setText(
				t("settings.dateFormat.preview", {
					heading: buildHeading(settings.headingLevel, moment().format(settings.dateFormat)),
				}),
			);
		};

		new Setting(containerEl)
			.setName(t("settings.headingLevel.name"))
			.setDesc(t("settings.headingLevel.desc"))
			.addDropdown((dropdown) => {
				for (let level = 1; level <= 6; level++) {
					dropdown.addOption(String(level), "#".repeat(level));
				}
				dropdown.setValue(String(settings.headingLevel)).onChange(async (value) => {
					settings.headingLevel = Number(value);
					updatePreview();
					await this.host.saveSettings();
				});
			});

		const dateSetting = new Setting(containerEl)
			.setName(t("settings.dateFormat.name"))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.dateFormat)
					.setValue(settings.dateFormat)
					.onChange(async (value) => {
						settings.dateFormat = value.trim() || DEFAULT_SETTINGS.dateFormat;
						updatePreview();
						await this.host.saveSettings();
					}),
			);
		dateSetting.descEl.createDiv({ text: t("settings.dateFormat.desc") });
		previewEl = dateSetting.descEl.createDiv({ cls: "unidaily-setting-preview" });
		dateSetting.descEl.createDiv({ text: t("settings.formatWarning"), cls: "mod-warning" });
		updatePreview();

		this.addCountSetting("recentTagCount", "settings.recentCount.name", "settings.recentCount.desc");
		this.addCountSetting("frequentTagCount", "settings.frequentCount.name", "settings.frequentCount.desc");
	}

	private addCountSetting(
		field: "recentTagCount" | "frequentTagCount",
		name: "settings.recentCount.name" | "settings.frequentCount.name",
		desc: "settings.recentCount.desc" | "settings.frequentCount.desc",
	): void {
		const { settings, t } = this.host;
		new Setting(this.containerEl)
			.setName(t(name))
			.setDesc(t(desc))
			.addSlider((slider) =>
				slider
					.setLimits(0, MAX_TAG_COUNT, 1)
					.setValue(settings[field])
					.onChange(async (value) => {
						settings[field] = value;
						await this.host.saveSettings();
					}),
			);
	}
}
