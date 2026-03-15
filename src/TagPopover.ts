import { TFile, setIcon } from "obsidian";
import type PdfTagsPlugin from "./main";

/**
 * A lightweight popover that appears anchored to the toolbar tag button.
 * Not a Modal — rendered as a floating div so it feels native to the toolbar.
 */
export class TagPopover {
  private plugin: PdfTagsPlugin;
  private file: TFile;
  private anchorEl: HTMLElement;
  private containerEl: HTMLElement | null = null;
  private onCloseCallback: (() => void) | null;

  constructor(
    plugin: PdfTagsPlugin,
    file: TFile,
    anchorEl: HTMLElement,
    onClose?: () => void
  ) {
    this.plugin = plugin;
    this.file = file;
    this.anchorEl = anchorEl;
    this.onCloseCallback = onClose ?? null;
  }

  open(): void {
    // If already open, close it (toggle)
    if (this.containerEl) {
      this.close();
      return;
    }
    this.render();
  }

  close(): void {
    this.containerEl?.remove();
    this.containerEl = null;
    document.removeEventListener("mousedown", this.onOutsideClick);
    this.onCloseCallback?.();
  }

  private async render(): Promise<void> {
    const file = this.file;
    const tags = await this.plugin.getTagsForFile(file.path);
    const vaultTags = this.plugin.getAllVaultTags().filter((t) => !tags.includes(t));

    // Build the popover (off-screen first so we can measure it)
    const pop = document.body.createEl("div", { cls: "pdf-tags-popover pdf-tags-popover--hidden" });
    this.containerEl = pop;

    // Current tags
    const chipArea = pop.createEl("div", { cls: "pdf-tags-popover-chips" });
    this.renderChips(chipArea, tags, file.path);

    // Input + add button
    const inputRow = pop.createEl("div", { cls: "pdf-tags-input-row" });
    const input = inputRow.createEl("input", {
      type: "text",
      placeholder: "Add tag…",
      cls: "pdf-tags-input",
    });

    const addBtn = inputRow.createEl("button", { cls: "pdf-tags-add-btn" });
    setIcon(addBtn, "plus");
    addBtn.setAttribute("aria-label", "Add tag");

    // Autocomplete dropdown
    const dropdown = pop.createEl("div", { cls: "pdf-tags-dropdown" });

    const showDropdown = (query: string) => {
      dropdown.empty();
      if (!query) { dropdown.classList.remove("pdf-tags-dropdown--visible"); return; }
      const q = query.toLowerCase().replace(/^#+/, "");
      const matches = vaultTags.filter((t) => t.toLowerCase().includes(q)).slice(0, 8);
      if (!matches.length) { dropdown.classList.remove("pdf-tags-dropdown--visible"); return; }
      matches.forEach((tag) => {
        const item = dropdown.createEl("div", {
          cls: "pdf-tags-dropdown-item",
          text: `#${tag}`,
        });
        item.addEventListener("mousedown", async (e) => {
          e.preventDefault();
          input.value = "";
          dropdown.classList.remove("pdf-tags-dropdown--visible");
          await this.plugin.addTag(file.path, tag);
          await this.rerender(pop, file);
        });
      });
      dropdown.classList.add("pdf-tags-dropdown--visible");
    };

    input.addEventListener("input", () => showDropdown(input.value));
    input.addEventListener("blur", () => {
      setTimeout(() => { dropdown.classList.remove("pdf-tags-dropdown--visible"); }, 150);
    });

    const doAdd = async () => {
      const raw = input.value.trim().replace(/^#+/, "");
      if (!raw) return;
      const tag = raw.toLowerCase().replace(/\s+/g, "-");
      input.value = "";
      dropdown.classList.remove("pdf-tags-dropdown--visible");
      await this.plugin.addTag(file.path, tag);
      await this.rerender(pop, file);
    };

    addBtn.addEventListener("click", doAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
      if (e.key === "Escape") this.close();
    });

    // Vault tag suggestions
    if (vaultTags.length > 0) {
      const section = pop.createEl("div", { cls: "pdf-tags-suggestions" });
      section.createEl("p", { cls: "pdf-tags-suggestions-label", text: "Your tags:" });
      const list = section.createEl("div", { cls: "pdf-tags-suggestion-list" });
      vaultTags.slice(0, 20).forEach((tag) => {
        const chip = list.createEl("span", {
          cls: "pdf-tags-suggestion-chip",
          text: `#${tag}`,
        });
        chip.addEventListener("click", async () => {
          await this.plugin.addTag(file.path, tag);
          await this.rerender(pop, file);
        });
      });
    }

    // Close on outside click
    setTimeout(() => {
      document.addEventListener("mousedown", this.onOutsideClick);
    }, 0);

    // Focus the input
    setTimeout(() => input.focus(), 50);

    // Position after the popover has been rendered so we know its dimensions
    requestAnimationFrame(() => {
      this.positionPopover(pop);
      pop.classList.remove("pdf-tags-popover--hidden");
    });
  }

  private positionPopover(pop: HTMLElement): void {
    const rect = this.anchorEl.getBoundingClientRect();
    const popW = pop.offsetWidth;
    const popH = pop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 4;

    // Prefer opening below; if it clips, open above
    let top = rect.bottom + GAP;
    if (top + popH > vh) top = rect.top - popH - GAP;
    if (top < 0) top = GAP;

    // Right-align to the button's right edge; clamp so it doesn't go off the left
    let left = rect.right - popW;
    if (left < GAP) left = GAP;
    // Also clamp right edge
    if (left + popW > vw - GAP) left = vw - GAP - popW;

    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  private async rerender(pop: HTMLElement, file: TFile): Promise<void> {
    const tags = await this.plugin.getTagsForFile(file.path);
    const chipArea = pop.querySelector(".pdf-tags-popover-chips") as HTMLElement;
    if (chipArea) {
      chipArea.empty();
      this.renderChips(chipArea, tags, file.path);
    }
    // Refresh suggestion chips
    const suggestList = pop.querySelector(".pdf-tags-suggestion-list") as HTMLElement;
    if (suggestList) {
      const vaultTags = this.plugin.getAllVaultTags().filter((t) => !tags.includes(t));
      suggestList.empty();
      vaultTags.slice(0, 20).forEach((tag) => {
        const chip = suggestList.createEl("span", {
          cls: "pdf-tags-suggestion-chip",
          text: `#${tag}`,
        });
        chip.addEventListener("click", async () => {
          await this.plugin.addTag(file.path, tag);
          await this.rerender(pop, file);
        });
      });
    }
  }

  private renderChips(container: HTMLElement, tags: string[], filePath: string): void {
    if (tags.length === 0) {
      container.createEl("p", { cls: "pdf-tags-no-tags", text: "No tags yet." });
      return;
    }
    tags.forEach((tag) => {
      const chip = container.createEl("span", { cls: "pdf-tags-chip" });
      chip.createEl("span", { text: `#${tag}`, cls: "pdf-tags-chip-label" });
      const removeBtn = chip.createEl("button", {
        cls: "pdf-tags-chip-remove",
        attr: { "aria-label": `Remove tag ${tag}` },
      });
      setIcon(removeBtn, "x");
      removeBtn.addEventListener("click", async () => {
        await this.plugin.removeTag(filePath, tag);
        await this.rerender(container.closest(".pdf-tags-popover") as HTMLElement, this.file);
      });
    });
  }

  private onOutsideClick = (evt: MouseEvent) => {
    if (
      this.containerEl &&
      !this.containerEl.contains(evt.target as Node) &&
      !this.anchorEl.contains(evt.target as Node)
    ) {
      this.close();
    }
  };
}
