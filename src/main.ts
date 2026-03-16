import {
  Plugin,
  TFile,
  normalizePath,
} from "obsidian";
import { PdfTagsSettings, DEFAULT_SETTINGS } from "./types";
import { PdfTagsSettingTab } from "./SettingsTab";
import { PdfToolbarInjector } from "./PdfToolbarInjector";

export default class PdfTagsPlugin extends Plugin {
  settings: PdfTagsSettings = DEFAULT_SETTINGS;
  private injector!: PdfToolbarInjector;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.removeFromUserIgnoreFilters(this.settings.companionFolder);
    this.injector = new PdfToolbarInjector(this);

    // Inject into PDFs that are already open on load
    this.app.workspace.onLayoutReady(() => {
      void this.injector.injectAll();
    });

    // Inject whenever a new leaf becomes active
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf) void this.injector.injectLeaf(leaf);
      })
    );

    // Also catch layout changes (e.g. drag-drop, split panes)
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        void this.injector.injectAll();
      })
    );

    // Context menu shortcut in file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && file.extension === "pdf") {
          menu.addItem((item) => {
            item
              .setTitle("Open PDF in new tab to manage tags")
              .setIcon("tag")
              .onClick(async () => {
                const leaf = this.app.workspace.getLeaf("tab");
                await leaf.openFile(file);
              });
          });
        }
      })
    );

    // Keep companion file in sync when a PDF is renamed
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "pdf") {
          void this.handlePdfRename(file, oldPath);
        }
      })
    );

    // Delete companion file when PDF is deleted
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "pdf") {
          void this.handlePdfDelete(file);
        }
      })
    );

    this.addSettingTab(new PdfTagsSettingTab(this.app, this));
  }

  onunload(): void {
    this.injector.destroy();
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  async loadSettings(): Promise<void> {
    const data = await this.loadData() as Partial<PdfTagsSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // ─── Folder visibility (CSS only) ────────────────────────────────────────────

  private removeFromUserIgnoreFilters(folder: string): void {
    const vault = this.app.vault as unknown as { getConfig(k: string): unknown; setConfig(k: string, v: unknown): void };
    const existing = vault.getConfig("userIgnoreFilters");
    const filters: string[] = Array.isArray(existing) ? (existing as string[]) : [];
    const normalized = normalizePath(folder);
    const updated = filters.filter((f) => f !== normalized);
    if (updated.length !== filters.length) {
      vault.setConfig("userIgnoreFilters", updated.length ? updated : null);
    }
  }

  // ─── Companion file helpers ──────────────────────────────────────────────────

  companionPathFor(pdfPath: string): string {
    const name = pdfPath.replace(/\//g, "__").replace(/\.pdf$/i, "") + ".md";
    return normalizePath(`${this.settings.companionFolder}/${name}`);
  }

  private async ensureFolder(): Promise<void> {
    const folder = normalizePath(this.settings.companionFolder);
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
  }

  async getTagsForFile(pdfPath: string): Promise<string[]> {
    const companionPath = this.companionPathFor(pdfPath);
    const file = this.app.vault.getAbstractFileByPath(companionPath);
    if (!(file instanceof TFile)) return [];

    let result: string[] = [];
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const raw = fm["tags"];
      if (Array.isArray(raw)) result = raw.map(String);
      else if (typeof raw === "string") result = [raw];
    });
    return result;
  }

  private async writeTagsForFile(pdfPath: string, tags: string[]): Promise<void> {
    await this.ensureFolder();
    const companionPath = this.companionPathFor(pdfPath);

    const existing = this.app.vault.getAbstractFileByPath(companionPath);
    let file: TFile;
    if (existing instanceof TFile) {
      file = existing;
    } else {
      const pdfName = pdfPath.split("/").pop() ?? pdfPath;
      file = await this.app.vault.create(companionPath, `[[${pdfName}]]\n`);
    }

    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm["tags"] = tags;
    });
  }

  async addTag(pdfPath: string, tag: string): Promise<void> {
    const tags = await this.getTagsForFile(pdfPath);
    if (tags.includes(tag)) return;
    await this.writeTagsForFile(pdfPath, [...tags, tag]);
  }

  async removeTag(pdfPath: string, tag: string): Promise<void> {
    const tags = await this.getTagsForFile(pdfPath);
    await this.writeTagsForFile(pdfPath, tags.filter((t) => t !== tag));
  }

  getAllVaultTags(): string[] {
    const cache = this.app.metadataCache;
    const tagMap = (cache as unknown as { getTags(): Record<string, number> }).getTags?.() ?? {};
    return Object.keys(tagMap)
      .map((t) => t.replace(/^#/, ""))
      .sort();
  }

  // ─── Rename / Delete sync ────────────────────────────────────────────────────

  private async handlePdfRename(file: TFile, oldPath: string): Promise<void> {
    const oldCompanion = this.companionPathFor(oldPath);
    const oldFile = this.app.vault.getAbstractFileByPath(oldCompanion);
    if (!(oldFile instanceof TFile)) return;
    const newCompanion = this.companionPathFor(file.path);
    await this.app.fileManager.renameFile(oldFile, newCompanion);
  }

  private async handlePdfDelete(file: TFile): Promise<void> {
    const companionPath = this.companionPathFor(file.path);
    const companion = this.app.vault.getAbstractFileByPath(companionPath);
    if (companion instanceof TFile) {
      await this.app.fileManager.trashFile(companion);
    }
  }
}
