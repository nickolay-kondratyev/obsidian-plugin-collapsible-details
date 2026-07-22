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
import { DetailsRange, DetailsRangeScanner } from "./DetailsRangeScanner";
import { SectionRoleClassifier } from "./SectionRoleClassifier";

interface DetailsMarkdownSettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: DetailsMarkdownSettings = {
  enabled: true,
};

/** Marks a <details> element whose body we already replaced, so re-runs never double-render. */
const RENDERED_ATTRIBUTE = "data-details-markdown-rendered";
/** Hides escaped fragment sections (styles.css); removed by unhide/reconcile. */
const HIDDEN_FRAGMENT_CLASS = "details-markdown-hidden-fragment";
/** Bounded retries for the post-render fragment sweep, which must wait for DOM attach. */
const FRAGMENT_SWEEP_MAX_TRIES = 10;

/** A <details> block whose body this plugin rendered; tracked to detect staleness and leaks. */
interface RenderedBlockEntry {
  sectionEl: HTMLElement;
  detailsEl: HTMLElement;
  bodyContainer: HTMLElement;
  lifecycleOwner: MarkdownRenderChild;
  renderedSource: string;
  /** Sections render detached and attach later; only ever-connected elements can be pronounced dead. */
  everConnected: boolean;
}

/** A section we hid because its content is rendered inside a fold; tracked so it can be unhidden. */
interface HiddenFragmentEntry {
  el: HTMLElement;
  everConnected: boolean;
}

interface PathBlocks {
  rendered: RenderedBlockEntry[];
  hidden: HiddenFragmentEntry[];
}

export default class DetailsMarkdownPlugin extends Plugin {
  settings: DetailsMarkdownSettings = DEFAULT_SETTINGS;
  private readonly blocksByPath = new Map<string, PathBlocks>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new DetailsMarkdownSettingTab(this.app, this));

    this.registerMarkdownPostProcessor(async (el, ctx) => {
      if (!this.settings.enabled) {
        return;
      }
      try {
        await this.processSection(el, ctx);
      } catch (error) {
        // Never throw into Obsidian's render loop; the section stays native.
        console.error("details-markdown: failed to process section", error);
      }
    });
  }

  onunload(): void {
    this.blocksByPath.clear();
    // Restore native rendering in already-open views.
    this.rerenderOpenMarkdownViews();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Applies a settings toggle immediately: full re-render restores native or rendered state. */
  onEnabledSettingChanged(): void {
    this.blocksByPath.clear();
    this.rerenderOpenMarkdownViews();
  }

  private rerenderOpenMarkdownViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        view.previewMode?.rerender(true);
      }
    }
  }

  private rerenderViewsForPath(path: string): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === path) {
        view.previewMode?.rerender(true);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Section processing
  // ---------------------------------------------------------------------------

  private async processSection(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const sectionInfo = ctx.getSectionInfo(el);
    if (sectionInfo === null) {
      // No source access (embeds, export, nested renders): leave native.
      return;
    }
    const lines = sectionInfo.text.split("\n");
    const ranges = DetailsRangeScanner.scan(sectionInfo.text);

    await this.reconcileTrackedBlocks(ctx, ranges, lines);

    const role = SectionRoleClassifier.classify(ranges, sectionInfo.lineStart, sectionInfo.lineEnd);
    if (role.kind === "opening") {
      await this.renderOpeningSection(el, ctx, role.range, lines);
    } else if (role.kind === "fragment") {
      this.hideFragmentIfBlockRendered(el, ctx, role.range);
    }
  }

  /** Renders the full block body (from raw source) into the section's <details> element. */
  private async renderOpeningSection(
    sectionEl: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    range: DetailsRange,
    lines: string[]
  ): Promise<void> {
    const detailsEl = this.findSingleTopLevelDetails(sectionEl);
    if (detailsEl === null || detailsEl.hasAttribute(RENDERED_ATTRIBUTE)) {
      return;
    }
    const source = this.sliceRange(lines, range);
    const parsed = DetailsBlockParser.parse(source);
    if (parsed === null || parsed.bodyMarkdown === "") {
      return;
    }

    // Keep the native <summary> element (and the open attribute) untouched;
    // replace only the (possibly truncated) literal body with a real Markdown render.
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

    this.pathBlocks(ctx.sourcePath).rendered.push({
      sectionEl,
      detailsEl,
      bodyContainer,
      lifecycleOwner,
      renderedSource: source,
      everConnected: sectionEl.isConnected,
    });

    // Fragment sections may have rendered before this opening (scroll order is not
    // guaranteed); sweep siblings once attached so nothing shows twice.
    this.scheduleFragmentSweep(sectionEl, ctx, FRAGMENT_SWEEP_MAX_TRIES);
  }

  /**
   * Hides an escaped fragment section, but only when its block's opening is actually
   * rendered — otherwise (e.g. opening glued into a list section) hiding would lose content.
   */
  private hideFragmentIfBlockRendered(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    range: DetailsRange
  ): void {
    const opening = this.findRenderedOpening(ctx, ctx.sourcePath, range.startLine);
    if (opening === null) {
      // The opening's post-render sweep will hide this section if the block renders.
      return;
    }
    this.hideFragment(el, ctx.sourcePath);
  }

  /** After the opening attaches, hides already-rendered sibling sections inside its block. */
  private scheduleFragmentSweep(
    sectionEl: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    triesLeft: number
  ): void {
    if (triesLeft <= 0) {
      return;
    }
    requestAnimationFrame(() => {
      try {
        if (!sectionEl.isConnected) {
          this.scheduleFragmentSweep(sectionEl, ctx, triesLeft - 1);
          return;
        }
        this.sweepSiblingFragments(sectionEl, ctx);
      } catch (error) {
        console.error("details-markdown: fragment sweep failed", error);
      }
    });
  }

  private sweepSiblingFragments(
    sectionEl: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    const openingInfo = ctx.getSectionInfo(sectionEl);
    const parent = sectionEl.parentElement;
    if (openingInfo === null || parent === null) {
      return;
    }
    const ranges = DetailsRangeScanner.scan(openingInfo.text);
    for (const sibling of Array.from(parent.children)) {
      if (
        sibling === sectionEl ||
        !(sibling instanceof HTMLElement) ||
        sibling.classList.contains(HIDDEN_FRAGMENT_CLASS)
      ) {
        continue;
      }
      const info = ctx.getSectionInfo(sibling);
      if (info === null) {
        continue;
      }
      const role = SectionRoleClassifier.classify(ranges, info.lineStart, info.lineEnd);
      if (role.kind === "fragment" && role.range.startLine === openingInfo.lineStart) {
        this.hideFragment(sibling, ctx.sourcePath);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Reconciliation: staleness after interior edits, unhiding, dead-entry cleanup
  // ---------------------------------------------------------------------------

  private async reconcileTrackedBlocks(
    ctx: MarkdownPostProcessorContext,
    ranges: DetailsRange[],
    lines: string[]
  ): Promise<void> {
    const path = ctx.sourcePath;
    const blocks = this.blocksByPath.get(path);
    if (blocks === undefined) {
      return;
    }

    for (const entry of [...blocks.rendered]) {
      entry.everConnected ||= entry.sectionEl.isConnected;
      if (entry.everConnected && !entry.sectionEl.isConnected) {
        this.remove(blocks.rendered, entry);
        continue;
      }
      const info = ctx.getSectionInfo(entry.sectionEl);
      if (info === null) {
        continue;
      }
      const range = ranges.find((r) => r.startLine === info.lineStart);
      if (range === undefined) {
        // Block boundary edited away (e.g. </details> deleted): full re-render restores
        // native output; entry removed first so this cannot loop.
        this.remove(blocks.rendered, entry);
        this.rerenderViewsForPath(path);
        continue;
      }
      const source = this.sliceRange(lines, range);
      if (source !== entry.renderedSource) {
        await this.rerenderStaleBody(entry, source, ctx);
      }
    }

    for (const fragment of [...blocks.hidden]) {
      fragment.everConnected ||= fragment.el.isConnected;
      if (fragment.everConnected && !fragment.el.isConnected) {
        this.remove(blocks.hidden, fragment);
        continue;
      }
      const info = ctx.getSectionInfo(fragment.el);
      if (info === null) {
        continue;
      }
      const role = SectionRoleClassifier.classify(ranges, info.lineStart, info.lineEnd);
      if (role.kind !== "fragment") {
        fragment.el.classList.remove(HIDDEN_FRAGMENT_CLASS);
        this.remove(blocks.hidden, fragment);
      }
    }
  }

  /**
   * Re-renders a block body in place after an interior (blank-line-separated) edit:
   * Obsidian re-renders only the edited fragment section, never the opening one.
   */
  private async rerenderStaleBody(
    entry: RenderedBlockEntry,
    source: string,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const parsed = DetailsBlockParser.parse(source);
    if (parsed === null || parsed.bodyMarkdown === "") {
      this.remove(this.pathBlocks(ctx.sourcePath).rendered, entry);
      this.rerenderViewsForPath(ctx.sourcePath);
      return;
    }
    // Unload the old lifecycle owner so embeds from the previous body do not leak.
    entry.lifecycleOwner.unload();
    entry.bodyContainer.empty();
    const lifecycleOwner = new MarkdownRenderChild(entry.bodyContainer);
    ctx.addChild(lifecycleOwner);
    entry.lifecycleOwner = lifecycleOwner;
    entry.renderedSource = source;
    await MarkdownRenderer.render(
      this.app,
      parsed.bodyMarkdown,
      entry.bodyContainer,
      ctx.sourcePath,
      lifecycleOwner
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private findRenderedOpening(
    ctx: MarkdownPostProcessorContext,
    path: string,
    blockStartLine: number
  ): RenderedBlockEntry | null {
    for (const entry of this.pathBlocks(path).rendered) {
      const info = ctx.getSectionInfo(entry.sectionEl);
      if (info !== null && info.lineStart === blockStartLine) {
        return entry;
      }
    }
    return null;
  }

  private hideFragment(el: HTMLElement, path: string): void {
    el.classList.add(HIDDEN_FRAGMENT_CLASS);
    this.pathBlocks(path).hidden.push({ el, everConnected: el.isConnected });
  }

  /**
   * Returns the section's <details> element only when the section contains exactly
   * one top-level <details>; otherwise the section is not a supported opening.
   */
  private findSingleTopLevelDetails(el: HTMLElement): HTMLElement | null {
    const topLevel = Array.from(el.querySelectorAll("details")).filter(
      (d) => d.parentElement?.closest("details") === null
    );
    return topLevel.length === 1 ? topLevel[0] : null;
  }

  private sliceRange(lines: string[], range: DetailsRange): string {
    return lines.slice(range.startLine, range.endLine + 1).join("\n");
  }

  private pathBlocks(path: string): PathBlocks {
    let blocks = this.blocksByPath.get(path);
    if (blocks === undefined) {
      blocks = { rendered: [], hidden: [] };
      this.blocksByPath.set(path, blocks);
    }
    return blocks;
  }

  private remove<T>(list: T[], item: T): void {
    const index = list.indexOf(item);
    if (index !== -1) {
      list.splice(index, 1);
    }
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
          this.plugin.onEnabledSettingChanged();
        })
      );
  }
}
