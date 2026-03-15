import { App, PluginSettingTab, Setting } from "obsidian";
import type PdfTagsPlugin from "./main";

export class PdfTagsSettingTab extends PluginSettingTab {
  plugin: PdfTagsPlugin;

  constructor(app: App, plugin: PdfTagsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Companion folder")
      .setDesc(
        "Vault-relative folder where companion .md files (holding tags) are stored. " +
        "These files are what Obsidian indexes for graph view and search."
      )
      .addText((text) =>
        text
          .setPlaceholder("_pdf-tags")
          .setValue(this.plugin.settings.companionFolder)
          .onChange(async (value) => {
            this.plugin.settings.companionFolder = value.trim() || "_pdf-tags";
            await this.plugin.saveSettings();
          })
      );
  }
}
