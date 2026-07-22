/** Obsidian's aria-label for the embed navigation affordance; matched so its native CSS applies. */
const OPEN_LINK_LABEL = "Open link";
/** Native class Obsidian styles (position + hover reveal) for the embed navigation button. */
const OPEN_LINK_CLASS = "markdown-embed-link";
/** Lucide icon Obsidian renders inside the embed link. */
const OPEN_LINK_ICON = "lucide-arrow-up-right";

/** Sets a Lucide icon on an element (Obsidian's `setIcon`), injected to keep this class runtime-free. */
export type IconSetter = (el: HTMLElement, iconId: string) => void;
/** Navigates to an embed's source note, honoring modifier keys for new pane/tab. */
export type EmbedSourceOpener = (linktext: string, event: MouseEvent) => void;

/**
 * Adds Obsidian's reading-view "Open link" affordance to note embeds that were rendered
 * via `MarkdownRenderer.render`. That host-less path renders the embed content but never
 * runs the reading-view layer that decorates embeds with the navigation button, so it is
 * otherwise absent (a genuinely missing element, not merely CSS-hidden). We recreate the
 * native element (same class + label) so Obsidian's own positioning/hover CSS applies.
 *
 * Pure DOM + injected dependencies, so it carries no Obsidian runtime import.
 */
export class EmbedOpenLinkDecorator {
  constructor(
    private readonly setIcon: IconSetter,
    private readonly openEmbedSource: EmbedSourceOpener
  ) {}

  /** Decorates every loaded note embed in the container. Idempotent and safe to re-run. */
  decorateEmbedsIn(container: HTMLElement): void {
    container
      .querySelectorAll<HTMLElement>(".internal-embed[src]")
      .forEach((embed) => this.decorateEmbed(embed));
  }

  /**
   * Adds the button to one embed once its content frame exists. Skips embeds that are not
   * yet loaded (e.g. inside a collapsed fold) — the caller re-runs as they load — and embeds
   * that already carry a link (ours from a prior pass, or a native one).
   */
  private decorateEmbed(embed: HTMLElement): void {
    if (embed.querySelector(`.${OPEN_LINK_CLASS}`) !== null) {
      return;
    }
    const linktext = embed.getAttribute("src");
    if (linktext === null || linktext === "") {
      return;
    }
    // The frame is the `.markdown-embed` that wraps the transcluded content; only note
    // embeds produce `.markdown-embed-content`, so image/media embeds are left untouched.
    const content = embed.querySelector(".markdown-embed-content");
    const frame = content?.parentElement ?? null;
    if (frame === null) {
      return;
    }

    const link = document.createElement("div");
    link.className = OPEN_LINK_CLASS;
    link.setAttribute("aria-label", OPEN_LINK_LABEL);
    this.setIcon(link, OPEN_LINK_ICON);
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openEmbedSource(linktext, event);
    });
    frame.insertBefore(link, frame.firstChild);
  }
}
