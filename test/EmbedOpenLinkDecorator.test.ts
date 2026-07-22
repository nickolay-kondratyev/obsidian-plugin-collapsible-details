// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmbedOpenLinkDecorator } from "../src/EmbedOpenLinkDecorator";

/**
 * GIVEN a container holding embeds rendered by MarkdownRenderer.render
 * WHEN EmbedOpenLinkDecorator.decorateEmbedsIn runs
 * THEN loaded note embeds gain the native "Open link" button, wired to the source opener,
 *      while unloaded and non-note embeds are left untouched.
 */
describe("EmbedOpenLinkDecorator.decorateEmbedsIn", () => {
  const openEmbedSource = vi.fn();
  const setIcon = vi.fn();

  beforeEach(() => {
    openEmbedSource.mockReset();
    setIcon.mockReset();
  });

  const decorate = (container: HTMLElement) =>
    new EmbedOpenLinkDecorator(setIcon, openEmbedSource).decorateEmbedsIn(container);

  /** A loaded note embed: `.internal-embed[src]` wrapping a `.markdown-embed` with content. */
  const loadedNoteEmbed = (src: string): HTMLElement => {
    const container = document.createElement("div");
    container.innerHTML = `
      <span class="internal-embed markdown-embed" src="${src}">
        <div class="markdown-embed">
          <div class="markdown-embed-title">${src}</div>
          <div class="markdown-embed-content">body</div>
        </div>
      </span>`;
    return container;
  };

  const links = (container: HTMLElement) =>
    container.querySelectorAll(".markdown-embed-link");

  describe("GIVEN a loaded note embed", () => {
    it("THEN adds exactly one Open link button", () => {
      const container = loadedNoteEmbed("Target Note");
      decorate(container);
      expect(links(container).length).toBe(1);
    });

    it("THEN labels the button 'Open link' for the native affordance CSS", () => {
      const container = loadedNoteEmbed("Target Note");
      decorate(container);
      expect(links(container)[0].getAttribute("aria-label")).toBe("Open link");
    });

    it("THEN places the button inside the embed frame that holds the content", () => {
      const container = loadedNoteEmbed("Target Note");
      decorate(container);
      const frame = container.querySelector(".markdown-embed-content")!.parentElement!;
      expect(frame.querySelector(":scope > .markdown-embed-link")).not.toBeNull();
    });

    it("THEN renders an icon into the button", () => {
      const container = loadedNoteEmbed("Target Note");
      decorate(container);
      expect(setIcon).toHaveBeenCalledWith(links(container)[0], expect.any(String));
    });

    it("THEN clicking the button opens the embed's source", () => {
      const container = loadedNoteEmbed("Target Note");
      decorate(container);
      (links(container)[0] as HTMLElement).click();
      expect(openEmbedSource).toHaveBeenCalledWith("Target Note", expect.any(MouseEvent));
    });
  });

  describe("GIVEN an embed already decorated", () => {
    it("THEN a second pass does not duplicate the button", () => {
      const container = loadedNoteEmbed("Target Note");
      decorate(container);
      decorate(container);
      expect(links(container).length).toBe(1);
    });
  });

  describe("GIVEN an embed not yet loaded (no content frame)", () => {
    it("THEN adds no button, leaving it for a later pass", () => {
      const container = document.createElement("div");
      container.innerHTML = `<span class="internal-embed" src="Target Note"></span>`;
      decorate(container);
      expect(links(container).length).toBe(0);
    });
  });

  describe("GIVEN an image embed (no markdown content frame)", () => {
    it("THEN adds no button, matching native behavior", () => {
      const container = document.createElement("div");
      container.innerHTML = `<span class="internal-embed image-embed" src="pic.png"><img src="pic.png" /></span>`;
      decorate(container);
      expect(links(container).length).toBe(0);
    });
  });
});
