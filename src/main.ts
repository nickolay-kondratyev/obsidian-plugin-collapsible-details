import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
import { DetailsBlockParser } from "./DetailsBlockParser";
import { DetailsRange, DetailsRangeScanner } from "./DetailsRangeScanner";
import { SectionRole, SectionRoleClassifier } from "./SectionRoleClassifier";

interface DetailsMarkdownSettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: DetailsMarkdownSettings = {
  enabled: true,
};

/** Marks a <details> element whose body we already replaced, so re-runs never double-render. */
const RENDERED_ATTRIBUTE = "data-details-markdown-rendered";
/** Hides escaped fragment sections (styles.css); kept in sync with the source by reconcile. */
const HIDDEN_FRAGMENT_CLASS = "details-markdown-hidden-fragment";
/** After a vault or workspace event, how often and how long to re-sync while views re-parse. */
const SETTLE_INTERVAL_MS = 200;
const SETTLE_DURATION_MS = 2000;

/** A <details> block whose body this plugin rendered; tracked to detect staleness and leaks. */
interface RenderedBlockEntry {
  /** The context of the view that rendered the block; resolves its section in that view. */
  ctx: MarkdownPostProcessorContext;
  sectionEl: HTMLElement;
  detailsEl: HTMLElement;
  bodyContainer: HTMLElement;
  lifecycleOwner: MarkdownRenderChild;
  renderedSource: string;
  /** Sections render detached and attach later; only ever-connected elements can be pronounced dead. */
  everConnected: boolean;
}

/** A processed section; tracked so its hidden state follows edits Obsidian never re-processes it for. */
interface TrackedSection {
  /** The context of the view that rendered the section; resolves its lines in that view. */
  ctx: MarkdownPostProcessorContext;
  everConnected: boolean;
  /** The view's source text this section's hidden state was last decided against. */
  syncedText: string | null;
}

interface PathBlocks {
  rendered: RenderedBlockEntry[];
  sections: Map<HTMLElement, TrackedSection>;
  /** The note source last seen by the post-processor; a change triggers a reconcile. */
  source: string | null;
  settleUntil: number;
  settling: boolean;
}

/** A source text split into lines and scanned for <details> ranges, cached per reconcile. */
interface ScannedSource {
  lines: string[];
  ranges: DetailsRange[];
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

    // Reading view post-processes only sections whose text changed, so an edit that only
    // deletes sections (e.g. a removed </details> line), or a hidden tab re-parsing when
    // shown, runs no post-processor. Re-sync after every event that can change a view.
    this.registerEvent(this.app.vault.on("modify", (file) => this.settle(file.path)));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.settleOpenNotes()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.settleOpenNotes()));
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        const blocks = this.blocksByPath.get(oldPath);
        if (blocks !== undefined) {
          this.blocksByPath.delete(oldPath);
          this.blocksByPath.set(file.path, blocks);
        }
      })
    );
    this.registerEvent(this.app.vault.on("delete", (file) => this.blocksByPath.delete(file.path)));
  }

  onunload(): void {
    this.forgetAllBlocks();
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
    this.forgetAllBlocks();
    this.rerenderOpenMarkdownViews();
  }

  /** Re-renders reuse section elements, so unhide every fragment before dropping tracking. */
  private forgetAllBlocks(): void {
    for (const blocks of this.blocksByPath.values()) {
      for (const el of blocks.sections.keys()) {
        el.classList.remove(HIDDEN_FRAGMENT_CLASS);
      }
    }
    this.blocksByPath.clear();
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
    const text = await this.fullSourceText(ctx, sectionInfo);
    const lines = text.split("\n");
    const ranges = DetailsRangeScanner.scan(text);

    const path = ctx.sourcePath;
    const blocks = this.pathBlocks(path);
    if (text !== blocks.source) {
      blocks.source = text;
      await this.reconcileTrackedBlocks(path, blocks);
    }

    const role = SectionRoleClassifier.classify(ranges, sectionInfo.lineStart, sectionInfo.lineEnd);
    blocks.sections.set(el, {
      ctx,
      everConnected: el.isConnected,
      syncedText: text === sectionInfo.text ? text : null,
    });
    if (role.kind === "opening") {
      await this.renderOpeningSection(el, ctx, path, role.range, lines);
    }
    this.syncFragmentHidden(el, ctx, path, role);
  }

  /**
   * While Reading view renders a long note, the first sections' getSectionInfo() text
   * can be a single line, so no <details> range is found and those folds stay native.
   * Fall back to the note's whole source whenever the given text ends before the section.
   */
  private async fullSourceText(
    ctx: MarkdownPostProcessorContext,
    sectionInfo: { text: string; lineEnd: number }
  ): Promise<string> {
    if (sectionInfo.text.split("\n").length > sectionInfo.lineEnd) {
      return sectionInfo.text;
    }
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    return file instanceof TFile ? this.app.vault.cachedRead(file) : sectionInfo.text;
  }

  /** Renders the full block body (from raw source) into the section's <details> element. */
  private async renderOpeningSection(
    sectionEl: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    path: string,
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
    // Reading view mounts only sections near the viewport, from cached heights.
    // Toggling the fold changes this section's height without telling it, so after
    // an edit made while open, sections below stay detached and blank on collapse.
    // A workspace resize makes Reading view re-measure and remount them.
    detailsEl.addEventListener("toggle", () => this.app.workspace.trigger("resize"));

    await MarkdownRenderer.render(
      this.app,
      parsed.bodyMarkdown,
      bodyContainer,
      path,
      lifecycleOwner
    );

    const blocks = this.pathBlocks(path);
    // A full re-render reuses the section element, so replace its earlier entry.
    for (const old of blocks.rendered.filter((e) => e.sectionEl === sectionEl)) {
      old.lifecycleOwner.unload();
      this.remove(blocks.rendered, old);
    }
    blocks.rendered.push({
      ctx,
      sectionEl,
      detailsEl,
      bodyContainer,
      lifecycleOwner,
      renderedSource: source,
      everConnected: sectionEl.isConnected,
    });

    // Fragment sections may have rendered before this opening (scroll order is not
    // guaranteed), so hide those already processed, attached or not.
    this.hideTrackedFragments(ctx, blocks, range);
  }

  /**
   * Hides a fragment section exactly when its block's opening section rendered the body,
   * so a fold this plugin does not render (e.g. glued into a list) never loses content.
   * Openings stay tracked while detached, so fragments mounted later still find them.
   */
  private syncFragmentHidden(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    path: string,
    role: SectionRole
  ): void {
    const hide =
      role.kind === "fragment" && this.findRenderedOpening(ctx, path, role.range.startLine) !== null;
    el.classList.toggle(HIDDEN_FRAGMENT_CLASS, hide);
  }

  private hideTrackedFragments(
    ctx: MarkdownPostProcessorContext,
    blocks: PathBlocks,
    range: DetailsRange
  ): void {
    for (const el of blocks.sections.keys()) {
      const info = ctx.getSectionInfo(el);
      if (info !== null && info.lineStart > range.startLine && info.lineEnd <= range.endLine) {
        el.classList.add(HIDDEN_FRAGMENT_CLASS);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Reconciliation: staleness after edits, hidden state, dead-entry cleanup
  // ---------------------------------------------------------------------------

  private settleOpenNotes(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file !== null) {
        this.settle(view.file.path);
      }
    }
  }

  /** Re-syncs a note's tracked blocks for a short while, since views re-parse on their own schedule. */
  private settle(path: string): void {
    const blocks = this.blocksByPath.get(path);
    if (blocks === undefined) {
      return;
    }
    blocks.settleUntil = Date.now() + SETTLE_DURATION_MS;
    if (blocks.settling) {
      return;
    }
    blocks.settling = true;
    const tick = async (): Promise<void> => {
      try {
        await this.reconcileTrackedBlocks(path, blocks);
      } catch (error) {
        console.error("details-markdown: failed to reconcile", error);
      }
      // Stops once tracking is dropped (unload, delete, rename) or the window has passed.
      if (Date.now() < blocks.settleUntil && this.blocksByPath.get(path) === blocks) {
        window.setTimeout(tick, SETTLE_INTERVAL_MS);
      } else {
        blocks.settling = false;
      }
    };
    window.setTimeout(tick, SETTLE_INTERVAL_MS);
  }

  /**
   * Brings every tracked block of a note in line with the source its own view shows now.
   * Each entry resolves through the context of the view that rendered it, so open tabs
   * that show different versions of the note (a hidden tab not yet re-parsed) stay correct.
   */
  private async reconcileTrackedBlocks(path: string, blocks: PathBlocks): Promise<void> {
    const scans = new Map<string, ScannedSource>();
    const scan = (text: string): ScannedSource => {
      let scanned = scans.get(text);
      if (scanned === undefined) {
        scanned = { lines: text.split("\n"), ranges: DetailsRangeScanner.scan(text) };
        scans.set(text, scanned);
      }
      return scanned;
    };

    // Reading view detaches sections scrolled out of view and reattaches the same elements,
    // so a detached entry stays tracked. It is dropped only once its section is gone.
    for (const entry of [...blocks.rendered]) {
      entry.everConnected ||= entry.sectionEl.isConnected;
      const info = entry.ctx.getSectionInfo(entry.sectionEl);
      if (info === null) {
        if (entry.everConnected && !entry.sectionEl.isConnected) {
          this.remove(blocks.rendered, entry);
        }
        continue;
      }
      const { lines, ranges } = scan(info.text);
      if (lines.length <= info.lineEnd) {
        // The view's text is partial mid-render; decide on a later pass.
        continue;
      }
      const range = ranges.find((r) => info.lineStart <= r.startLine && r.startLine <= info.lineEnd);
      if (range === undefined) {
        // Block boundary edited away (e.g. </details> deleted): full re-render restores
        // native output; entry removed first so this cannot loop.
        this.remove(blocks.rendered, entry);
        this.rerenderViewsForPath(path);
        continue;
      }
      const source = this.sliceRange(lines, range);
      if (source !== entry.renderedSource) {
        await this.rerenderStaleBody(path, blocks, entry, source);
      }
    }

    // An edit re-processes only the sections whose text changed, yet can change the role of
    // unchanged ones (a fold wrapped around them, or unwrapped), so re-decide each tracked
    // section whenever the text its view shows has changed since its last decision.
    for (const [el, tracked] of blocks.sections) {
      tracked.everConnected ||= el.isConnected;
      const info = tracked.ctx.getSectionInfo(el);
      if (info === null) {
        if (tracked.everConnected && !el.isConnected) {
          blocks.sections.delete(el);
        }
        continue;
      }
      if (info.text === tracked.syncedText) {
        continue;
      }
      const { lines, ranges } = scan(info.text);
      if (lines.length <= info.lineEnd) {
        continue;
      }
      const role = SectionRoleClassifier.classify(ranges, info.lineStart, info.lineEnd);
      if (role.kind === "opening") {
        // A block can gain its end (a </details> line typed back) with no change to its opening.
        await this.renderOpeningSection(el, tracked.ctx, path, role.range, lines);
      }
      this.syncFragmentHidden(el, tracked.ctx, path, role);
      tracked.syncedText = info.text;
    }
  }

  /**
   * Re-renders a block body in place after an interior (blank-line-separated) edit:
   * Obsidian re-renders only the edited fragment section, never the opening one.
   */
  private async rerenderStaleBody(
    path: string,
    blocks: PathBlocks,
    entry: RenderedBlockEntry,
    source: string
  ): Promise<void> {
    const parsed = DetailsBlockParser.parse(source);
    if (parsed === null || parsed.bodyMarkdown === "") {
      this.remove(blocks.rendered, entry);
      this.rerenderViewsForPath(path);
      return;
    }
    // Unload the old lifecycle owner so embeds from the previous body do not leak.
    entry.lifecycleOwner.unload();
    entry.bodyContainer.empty();
    const lifecycleOwner = new MarkdownRenderChild(entry.bodyContainer);
    entry.ctx.addChild(lifecycleOwner);
    entry.lifecycleOwner = lifecycleOwner;
    entry.renderedSource = source;
    await MarkdownRenderer.render(
      this.app,
      parsed.bodyMarkdown,
      entry.bodyContainer,
      path,
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
      // The opening section holds the block's start line, possibly after glued text.
      if (info !== null && info.lineStart <= blockStartLine && blockStartLine <= info.lineEnd) {
        return entry;
      }
    }
    return null;
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
      blocks = { rendered: [], sections: new Map(), source: null, settleUntil: 0, settling: false };
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
