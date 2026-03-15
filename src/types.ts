export interface PdfTagsSettings {
  /** Vault-relative folder where companion .md files are stored */
  companionFolder: string;
}

export const DEFAULT_SETTINGS: PdfTagsSettings = {
  companionFolder: "_pdf-tags",
};
