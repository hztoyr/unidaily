import { AbstractInputSuggest, App, Modal } from "obsidian";
import type { Translator } from "./i18n.ts";
import type { EntryKind } from "./journal.ts";
import { applyTag, filterTags, hasTag, splitTags, tagQueryAt, toggleTag, type TagQuery } from "./tags.ts";
import { PlainTextBox } from "./text-box.ts";

export interface CaptureOptions {
	t: Translator;
	/** Mode the window opens in; the user can switch it before saving. */
	kind: EntryKind;
	/** Journal file name shown in the title. */
	fileName: string;
	recentTags: readonly string[];
	frequentTags: readonly string[];
	/** All vault tags, most used first, offered by `#` completion. */
	allTags: readonly string[];
	/** Receives the trimmed text and the chosen mode after the modal has closed. */
	onSubmit: (text: string, kind: EntryKind) => void;
}

/**
 * Capture window (FR-1 – FR-8): a note/task switch, a text box that wraps and
 * grows with long text, rows of recent and frequent tag chips, and `#`
 * completion. It only collects text; writing to the journal is up to `onSubmit`.
 */
export class CaptureModal extends Modal {
	private readonly options: CaptureOptions;
	private kind: EntryKind;
	private box: PlainTextBox | null = null;
	private backdrop: HTMLElement | null = null;
	private backdropText: HTMLElement | null = null;
	private suggest: TagSuggest | null = null;
	private chips: { tag: string; el: HTMLElement }[] = [];
	private kindButtons: { kind: EntryKind; el: HTMLElement }[] = [];

	constructor(app: App, options: CaptureOptions) {
		super(app);
		this.options = options;
		this.kind = options.kind;
	}

	onOpen(): void {
		const { t, recentTags, frequentTags, allTags } = this.options;
		const { contentEl } = this;
		this.modalEl.addClass("unidaily-capture-modal");

		// Note / task switch (FR-2). Alt+J and Alt+T switch it while the window is open.
		const kinds = contentEl.createDiv({ cls: "unidaily-kind-switch", attr: { role: "group" } });
		for (const kind of ["note", "task"] as const) {
			const el = kinds.createEl("button", { text: t(kind === "task" ? "modal.task" : "modal.note") });
			el.addEventListener("mousedown", (evt) => evt.preventDefault());
			el.addEventListener("click", () => this.setKind(kind));
			this.kindButtons.push({ kind, el });
		}
		this.scope.register(["Alt"], "J", () => {
			this.setKind("note");
			return false;
		});
		this.scope.register(["Alt"], "T", () => {
			this.setKind("task");
			return false;
		});
		this.setKind(this.kind);

		// The text box sits on top of a backdrop that shows the same text with
		// #tags coloured; the box's own text is transparent, only its caret shows.
		// Both wrap the same way, so long text grows to several lines (1.0.7).
		const field = contentEl.createDiv({ cls: "unidaily-capture-field" });
		const backdrop = field.createDiv({ cls: "unidaily-capture-backdrop", attr: { "aria-hidden": "true" } });
		this.backdropText = backdrop.createSpan({ cls: "unidaily-capture-backdrop-text" });
		this.backdrop = backdrop;
		const box = new PlainTextBox(field, { cls: "unidaily-capture-input", placeholder: t("modal.placeholder") });
		box.el.addEventListener("input", (evt) => {
			// Don't touch the text while an IME is still composing.
			if (!(evt instanceof InputEvent && evt.isComposing)) box.normalize();
			this.refresh();
		});
		box.el.addEventListener("compositionend", () => {
			box.normalize();
			this.refresh();
		});
		for (const event of ["scroll", "keyup", "click", "focus"]) {
			box.el.addEventListener(event, () => this.syncScroll());
		}
		this.box = box;
		this.matchBackdropToBox();
		this.suggest = new TagSuggest(this.app, box, allTags, () => this.refresh());

		const rows = contentEl.createDiv({ cls: "unidaily-tag-rows" });
		this.addTagRow(rows, t("modal.recent"), recentTags);
		this.addTagRow(rows, t("modal.frequent"), frequentTags);
		if (recentTags.length === 0 && frequentTags.length === 0) {
			rows.createDiv({ cls: "unidaily-tag-hint", text: t("modal.tagHint") });
		}

		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		buttons.createEl("button", { text: t("modal.cancel") }).addEventListener("click", () => this.close());
		buttons
			.createEl("button", { text: t("modal.submit"), cls: "mod-cta" })
			.addEventListener("click", () => this.submit());

		// While the completion list is open its own scope takes Enter (FR-7).
		// Enter that confirms an IME composition must not submit.
		this.scope.register([], "Enter", (evt) => {
			if (evt.isComposing) return true;
			this.submit();
			return false;
		});

		box.focus();
	}

	onClose(): void {
		this.suggest?.close();
		this.contentEl.empty();
		this.chips = [];
		this.kindButtons = [];
		this.backdrop = null;
		this.backdropText = null;
		this.box = null;
	}

	/** Switches between note and task; the title and the switch follow. */
	private setKind(kind: EntryKind): void {
		const { t, fileName } = this.options;
		this.kind = kind;
		// Short "Note" / "Task" in the title; only the command list says "Capture" (1.1.3).
		const command = t(kind === "task" ? "modal.task" : "modal.note");
		this.titleEl.setText(t("modal.title", { command, file: fileName }));
		for (const { kind: k, el } of this.kindButtons) {
			el.toggleClass("is-active", k === kind);
			el.setAttr("aria-pressed", String(k === kind));
		}
		this.box?.focus();
	}

	private submit(): void {
		const box = this.box;
		if (!box) return;
		const text = box.value.trim();
		if (text === "") {
			box.focus();
			return;
		}
		this.close();
		this.options.onSubmit(text, this.kind);
	}

	private addTagRow(parent: HTMLElement, label: string, tags: readonly string[]): void {
		if (tags.length === 0) return;
		const row = parent.createDiv({ cls: "unidaily-tag-row" });
		row.createSpan({ cls: "unidaily-tag-label", text: label });
		for (const tag of tags) {
			const chip = row.createEl("button", { cls: "unidaily-tag", text: tag });
			// Keep focus and caret in the input when a chip is pressed.
			chip.addEventListener("mousedown", (evt) => evt.preventDefault());
			chip.addEventListener("click", () => this.toggle(tag));
			this.chips.push({ tag, el: chip });
		}
	}

	private toggle(tag: string): void {
		const box = this.box;
		if (!box) return;
		this.suggest?.close();
		box.value = toggleTag(box.value, tag);
		box.focus();
		box.caret = box.value.length;
		this.refresh();
	}

	/** Updates chip highlighting and the coloured backdrop after the text changed. */
	private refresh(): void {
		const value = this.box?.value ?? "";
		for (const { tag, el } of this.chips) el.toggleClass("is-active", hasTag(value, tag));
		this.renderBackdrop(value);
	}

	private renderBackdrop(value: string): void {
		const target = this.backdropText;
		if (!target) return;
		target.empty();
		for (const part of splitTags(value)) {
			if (part.tag) target.createSpan({ cls: "unidaily-inline-tag", text: part.text });
			else target.appendText(part.text);
		}
		this.syncScroll();
	}

	/** Keeps the backdrop scrolled exactly like the box once the text is taller than six lines. */
	private syncScroll(): void {
		window.requestAnimationFrame(() => {
			if (this.backdrop && this.box) this.backdrop.scrollTop = this.box.el.scrollTop;
		});
	}

	/** Copies the box's font and spacing so the backdrop text wraps and lines up exactly like it. */
	private matchBackdropToBox(): void {
		if (!this.backdrop || !this.box) return;
		const style = window.getComputedStyle(this.box.el);
		const props: Record<string, string> = {};
		for (const name of METRIC_PROPERTIES) props[name] = style.getPropertyValue(name);
		this.backdrop.setCssProps(props);
	}
}

/** CSS properties that decide where the box draws and wraps its text. */
const METRIC_PROPERTIES = [
	"font-family",
	"font-size",
	"font-weight",
	"font-style",
	"font-stretch",
	"line-height",
	"letter-spacing",
	"word-spacing",
	"text-transform",
	"text-indent",
	"padding-top",
	"padding-right",
	"padding-bottom",
	"padding-left",
	"border-top-width",
	"border-right-width",
	"border-bottom-width",
	"border-left-width",
	"border-radius",
];

/** `#` completion inside the capture text box (FR-6). */
class TagSuggest extends AbstractInputSuggest<string> {
	private readonly box: PlainTextBox;
	private readonly tags: readonly string[];
	private readonly onApplied: () => void;
	private query: TagQuery | null = null;

	constructor(app: App, box: PlainTextBox, tags: readonly string[], onApplied: () => void) {
		super(app, box.el);
		this.box = box;
		this.tags = tags;
		this.onApplied = onApplied;
		this.limit = 50;
	}

	protected getSuggestions(): string[] {
		this.query = tagQueryAt(this.box.value, this.box.caret);
		return this.query ? filterTags(this.tags, this.query.query) : [];
	}

	renderSuggestion(tag: string, el: HTMLElement): void {
		el.setText(tag);
	}

	selectSuggestion(tag: string): void {
		if (this.query) {
			const { text, caret } = applyTag(this.box.value, this.query, tag);
			this.box.value = text;
			this.box.caret = caret;
		}
		this.close();
		this.onApplied();
	}
}
