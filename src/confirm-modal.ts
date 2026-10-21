import { App, Modal } from "obsidian";

export interface ConfirmOptions {
	title: string;
	message: string;
	confirm: string;
	cancel: string;
	/** Use the warning style for the confirm button (for actions like turning a plugin off). */
	warning?: boolean;
	onConfirm: () => void;
}

/** A small yes/no dialog. Esc or Cancel closes it without doing anything. */
export class ConfirmModal extends Modal {
	private readonly options: ConfirmOptions;

	constructor(app: App, options: ConfirmOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { title, message, confirm, cancel, warning, onConfirm } = this.options;
		this.titleEl.setText(title);
		this.contentEl.createEl("p", { text: message });
		const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
		buttons.createEl("button", { text: cancel }).addEventListener("click", () => this.close());
		const ok = buttons.createEl("button", { text: confirm, cls: warning ? "mod-warning" : "mod-cta" });
		ok.addEventListener("click", () => {
			this.close();
			onConfirm();
		});
		ok.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
