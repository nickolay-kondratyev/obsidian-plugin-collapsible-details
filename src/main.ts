import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import { DetailsBlockParser } from "./DetailsBlockParser";

interface DetailsMarkdownSettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: DetailsMarkdownSettings = {
  enabled: true,
};

/** Marks a <details> element whose body we already replaced, so re-runs never double-render. */
const RENDERED_ATTRIBUTE = "data-details-markdown-rendered";

export default class DetailsMarkdownPlugin extends Plugin {
  settings: DetailsMarkdownSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new DetailsMarkdownSettingTab(this.app, this));

    this.registerMarkdownPostProcessor(async (el, ctx) => {
      if (!this.settings.enabled) {
        return;
      }
      try {
        await this.renderDetailsBlock(el, ctx);
      } catch (error) {
        // Never throw into Obsidian's render loop; the block stays native.
        console.error("details-markdown: failed to render block", error);
      }
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Re-renders all open Reading views so a settings toggle applies (and reverts) immediately. */
  rerenderOpenMarkdownViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        view.previewMode?.rerender(true);
      }
    }
  }

  private async renderDetailsBlock(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const detailsEl = this.findSingleTopLevelDetails(el);
    if (detailsEl === null || detailsEl.hasAttribute(RENDERED_ATTRIBUTE)) {
      return;
    }

    const sectionSource = this.getSectionSource(el, ctx);
    if (sectionSource === null) {
      return;
    }

    const parsed = DetailsBlockParser.parse(sectionSource);
    if (parsed === null || parsed.bodyMarkdown === "") {
      return;
    }

    // Keep the native <summary> element (and the open attribute) untouched;
    // replace only the literal body nodes with a real Markdown render.
    const summaryEl = detailsEl.querySelector(":scope > summary");
    detailsEl.empty();
    if (summaryEl !== null) {
      detailsEl.appendChild(summaryEl);
    }

    const bodyContainer = detailsEl.createDiv({ cls: "details-markdown-body" });
    // MarkdownRenderChild ties embeds/Dataview/etc. in the body to the note's
    // lifecycle via ctx.addChild, so everything unloads when the note closes.
    const lifecycleOwner = new MarkdownRenderChild(bodyContainer);
    ctx.addChild(lifecycleOwner);
    detailsEl.setAttribute(RENDERED_ATTRIBUTE, "true");

    await MarkdownRenderer.render(
      this.app,
      parsed.bodyMarkdown,
      bodyContainer,
      ctx.sourcePath,
      lifecycleOwner
    );
  }

  /**
   * Returns the section's <details> element only when the section contains exactly
   * one top-level <details>; otherwise the section is not a supported block.
   */
  private findSingleTopLevelDetails(el: HTMLElement): HTMLElement | null {
    const topLevel = Array.from(el.querySelectorAll("details")).filter(
      (d) => d.parentElement?.closest("details") === null
    );
    return topLevel.length === 1 ? topLevel[0] : null;
  }

  /** Raw source lines of this section, or null when unavailable (e.g. embeds, export). */
  private getSectionSource(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): string | null {
    const sectionInfo = ctx.getSectionInfo(el);
    if (sectionInfo === null) {
      return null;
    }
    return sectionInfo.text
      .split("\n")
      .slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1)
      .join("\n");
  }
}

class DetailsMarkdownSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: DetailsMarkdownPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Render Markdown inside <details> blocks")
      .setDesc("When off, Obsidian's native (literal) behavior is restored.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
          this.plugin.rerenderOpenMarkdownViews();
        })
      );
  }
}
