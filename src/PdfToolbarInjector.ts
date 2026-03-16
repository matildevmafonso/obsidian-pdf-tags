import { WorkspaceLeaf, TFile, setIcon } from "obsidian";
import type PdfTagsPlugin from "./main";
import { TagPopover } from "./TagPopover";

const INJECTED_ATTR = "data-pdf-tags-injected";

interface PdfViewerChild {
  toolbar?: {
    toolbarRightEl?: HTMLElement;
  };
}

interface PdfViewerComponent {
  child?: PdfViewerChild;
  then?: (cb: (child: PdfViewerChild) => void) => void;
}

interface PdfView {
  getViewType(): string;
  file?: TFile | null;
  viewer?: PdfViewerComponent;
}

export class PdfToolbarInjector {
  private plugin: PdfTagsPlugin;
  /** Map from toolbarRightEl → its MutationObserver, so we can disconnect on unload */
  private observers = new Map<HTMLElement, MutationObserver>();

  constructor(plugin: PdfTagsPlugin) {
    this.plugin = plugin;
  }

  async injectLeaf(leaf: WorkspaceLeaf): Promise<void> {
    const view = leaf.view as unknown as PdfView;
    if (view?.getViewType?.() !== "pdf") return;

    const file: TFile | null = view.file ?? null;
    if (!file) return;

    const viewerComponent = view.viewer;
    if (!viewerComponent) return;

    const doInject = (child: PdfViewerChild) => this.injectChild(child, file);

    if (viewerComponent.child) {
      doInject(viewerComponent.child);
    } else if (typeof viewerComponent.then === "function") {
      const child = await new Promise<PdfViewerChild>((resolve) => {
        viewerComponent.then!(resolve);
      });
      doInject(child);
    }
  }

  private injectChild(child: PdfViewerChild, file: TFile): void {
    const toolbarRightEl: HTMLElement | undefined = child?.toolbar?.toolbarRightEl;
    if (!toolbarRightEl) return;

    // Inject now (if not already present)
    this.injectButton(toolbarRightEl, file);

    // Watch for PDF++ (or anything else) removing our button and re-inject
    if (!this.observers.has(toolbarRightEl)) {
      const obs = new MutationObserver(() => {
        if (!toolbarRightEl.querySelector(`[${INJECTED_ATTR}]`)) {
          this.injectButton(toolbarRightEl, file);
        }
      });
      obs.observe(toolbarRightEl, { childList: true });
      this.observers.set(toolbarRightEl, obs);
    }
  }

  private injectButton(toolbarRightEl: HTMLElement, file: TFile): void {
    if (toolbarRightEl.querySelector(`[${INJECTED_ATTR}]`)) return;

    const btn = toolbarRightEl.createEl("button", {
      cls: "pdf-toolbar-button clickable-icon pdf-tags-toolbar-btn",
      attr: {
        [INJECTED_ATTR]: "true",
        "aria-label": "Edit PDF tags",
      },
    });
    setIcon(btn, "tag");

    let activePopover: TagPopover | null = null;
    btn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      if (activePopover) {
        activePopover.close();
        activePopover = null;
        return;
      }
      activePopover = new TagPopover(this.plugin, file, btn, () => {
        activePopover = null;
      });
      activePopover.open();
    });
  }

  async injectAll(): Promise<void> {
    const leaves = this.plugin.app.workspace.getLeavesOfType("pdf");
    for (const leaf of leaves) {
      await this.injectLeaf(leaf);
    }
  }

  destroy(): void {
    this.observers.forEach((obs) => obs.disconnect());
    this.observers.clear();
  }
}
