/**
 * A plain-text box that wraps long text onto several lines and grows with it
 * (FR-2, 1.0.7). It is a `contenteditable` element limited to one paragraph
 * of plain text, with an `<input>`-like API: `value`, `caret`, `focus()`.
 *
 * Line breaks are never kept: Enter is left to the capture window (it saves),
 * and pasted line breaks become spaces, because every entry is one line in
 * the journal.
 */
/** Non-breaking spaces some engines insert into editable text; read back as plain spaces. */
const NBSP = new RegExp(String.fromCharCode(0xa0), "g");

export class PlainTextBox {
	readonly el: HTMLDivElement;

	constructor(parent: HTMLElement, options: { cls: string; placeholder: string }) {
		this.el = parent.createDiv({
			cls: options.cls,
			attr: {
				role: "textbox",
				"aria-multiline": "false",
				"aria-label": options.placeholder,
				"data-placeholder": options.placeholder,
				enterkeyhint: "done",
				spellcheck: "false",
			},
		});
		try {
			this.el.contentEditable = "plaintext-only";
		} catch {
			// Engines without plaintext-only: paste is still forced to plain text below.
			this.el.contentEditable = "true";
		}

		// No line breaks from Enter or Shift+Enter.
		this.el.addEventListener("beforeinput", (evt) => {
			if (evt.inputType === "insertParagraph" || evt.inputType === "insertLineBreak") evt.preventDefault();
		});
		// Paste as plain text on one line.
		this.el.addEventListener("paste", (evt) => {
			const pasted = evt.clipboardData?.getData("text/plain");
			if (pasted === undefined) return;
			evt.preventDefault();
			this.insertAtCaret(pasted.replace(/\s*[\r\n]+\s*/g, " "));
			this.el.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}

	get value(): string {
		return (this.el.textContent ?? "").replace(NBSP, " ");
	}

	set value(text: string) {
		this.el.textContent = text;
	}

	/** Caret position (end of the selection) as a character offset into `value`. */
	get caret(): number {
		return this.offsetOf("end");
	}

	set caret(offset: number) {
		const selection = window.getSelection();
		if (!selection) return;
		const range = document.createRange();
		let remaining = Math.max(0, Math.min(offset, this.value.length));
		let placed = false;
		const walker = document.createTreeWalker(this.el, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node && !placed; node = walker.nextNode()) {
			const length = node.textContent?.length ?? 0;
			if (remaining <= length) {
				range.setStart(node, remaining);
				range.collapse(true);
				placed = true;
			} else {
				remaining -= length;
			}
		}
		if (!placed) {
			range.selectNodeContents(this.el);
			range.collapse(false);
		}
		selection.removeAllRanges();
		selection.addRange(range);
	}

	focus(): void {
		this.el.focus();
	}

	/**
	 * Keeps the box as a single text node without line breaks, which is what
	 * `value` and `caret` assume. Call it after input, outside IME composition.
	 */
	normalize(): void {
		const text = this.value;
		const clean = text.replace(/[\r\n]+/g, " ");
		const tidy = this.el.childNodes.length <= 1 && this.el.firstChild?.nodeType !== Node.ELEMENT_NODE;
		if (clean === text && tidy) return;
		const caret = this.caret;
		this.value = clean;
		this.caret = caret;
	}

	/** Inserts text at the caret, replacing the selection if there is one. */
	private insertAtCaret(text: string): void {
		const value = this.value;
		const start = this.offsetOf("start");
		const end = this.offsetOf("end");
		this.value = value.slice(0, start) + text + value.slice(end);
		this.caret = start + text.length;
	}

	/** Character offset of the selection's start or end; the end of the text if the selection is elsewhere. */
	private offsetOf(edge: "start" | "end"): number {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return this.value.length;
		const range = selection.getRangeAt(0);
		const container = edge === "start" ? range.startContainer : range.endContainer;
		const offset = edge === "start" ? range.startOffset : range.endOffset;
		if (!this.el.contains(container)) return this.value.length;
		const before = document.createRange();
		before.selectNodeContents(this.el);
		before.setEnd(container, offset);
		return before.toString().length;
	}
}
