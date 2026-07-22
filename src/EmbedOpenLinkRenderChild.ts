import { MarkdownRenderChild } from "obsidian";
import { EmbedOpenLinkDecorator } from "./EmbedOpenLinkDecorator";

/**
 * Owns the rendered fold body's lifecycle AND its "Open link" embed decoration.
 *
 * Embeds load lazily: those inside a collapsed fold render their content only when the
 * fold is expanded, long after the initial render resolves. A scoped MutationObserver
 * re-applies the affordance as embed content appears, and disconnects on unload so it
 * leaks nothing — consistent with the plugin's no-leak contract. Decoration is idempotent,
 * so the self-triggered mutation from inserting a button settles immediately.
 */
export class EmbedOpenLinkRenderChild extends MarkdownRenderChild {
  private observer: MutationObserver | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly decorator: EmbedOpenLinkDecorator
  ) {
    super(containerEl);
  }

  onload(): void {
    this.decorator.decorateEmbedsIn(this.containerEl);
    this.observer = new MutationObserver(() =>
      this.decorator.decorateEmbedsIn(this.containerEl)
    );
    this.observer.observe(this.containerEl, { childList: true, subtree: true });
  }

  onunload(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
