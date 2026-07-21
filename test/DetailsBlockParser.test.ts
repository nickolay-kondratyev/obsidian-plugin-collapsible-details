import { describe, expect, it } from "vitest";
import { DetailsBlockParser } from "../src/DetailsBlockParser";

/**
 * GIVEN a raw Markdown source section
 * WHEN DetailsBlockParser.parse is called
 * THEN it returns the block's summary/body for supported shapes, and null otherwise.
 */
describe("DetailsBlockParser.parse", () => {
  const parse = (source: string) => DetailsBlockParser.parse(source);

  describe("GIVEN a supported block with summary, heading and list", () => {
    const source = [
      "<details>",
      "<summary>My summary</summary>",
      "### Heading",
      "- item one",
      "- item two",
      "</details>",
    ].join("\n");

    it("THEN extracts the body markdown verbatim", () => {
      expect(parse(source)?.bodyMarkdown).toBe(
        "### Heading\n- item one\n- item two"
      );
    });

    it("THEN extracts the summary text", () => {
      expect(parse(source)?.summaryText).toBe("My summary");
    });
  });

  describe("GIVEN a block without a summary line", () => {
    const source = ["<details>", "plain body", "</details>"].join("\n");

    it("THEN summaryText is null", () => {
      expect(parse(source)?.summaryText).toBeNull();
    });

    it("THEN the body is the single line", () => {
      expect(parse(source)?.bodyMarkdown).toBe("plain body");
    });
  });

  describe("GIVEN a block with the open attribute", () => {
    const source = ["<details open>", "body", "</details>"].join("\n");

    it("THEN it parses", () => {
      expect(parse(source)?.bodyMarkdown).toBe("body");
    });
  });

  describe("GIVEN class attributes on details and summary", () => {
    const source = [
      '<details class="bordered-when-open">',
      '<summary class="central-thought-centered">Use goals to set direction.</summary>',
      "### Goals and Systems",
      "- item",
      "</details>",
    ].join("\n");

    it("THEN the body markdown is extracted", () => {
      expect(parse(source)?.bodyMarkdown).toBe("### Goals and Systems\n- item");
    });

    it("THEN the summary text (without its tag/attributes) is extracted", () => {
      expect(parse(source)?.summaryText).toBe("Use goals to set direction.");
    });
  });

  describe("GIVEN body markdown with tables, links and embeds", () => {
    const body = [
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
      "[[Some Note]]",
      "![[Embedded Note]]",
    ];
    const source = ["<details>", "<summary>s</summary>", ...body, "</details>"].join(
      "\n"
    );

    it("THEN body structure is preserved exactly (no lossy reconstruction)", () => {
      expect(parse(source)?.bodyMarkdown).toBe(body.join("\n"));
    });
  });

  describe("GIVEN body lines with leading indentation", () => {
    const source = ["<details>", "- outer", "    - nested", "</details>"].join("\n");

    it("THEN indentation is preserved", () => {
      expect(parse(source)?.bodyMarkdown).toBe("- outer\n    - nested");
    });
  });

  describe("GIVEN surrounding blank lines around the block", () => {
    const source = ["", "<details>", "body", "</details>", ""].join("\n");

    it("THEN the block still parses", () => {
      expect(parse(source)?.bodyMarkdown).toBe("body");
    });
  });

  describe("GIVEN a body with blank lines (Phase 1.5)", () => {
    it("THEN blank lines between paragraphs are preserved", () => {
      const source = ["<details>", "para one", "", "para two", "</details>"].join("\n");
      expect(parse(source)?.bodyMarkdown).toBe("para one\n\npara two");
    });

    it("THEN a code fence containing blank lines is preserved verbatim", () => {
      const body = ["```python", "some code", "", "some more code", "```"];
      const source = ["<details>", "<summary>s</summary>", ...body, "</details>"].join("\n");
      expect(parse(source)?.bodyMarkdown).toBe(body.join("\n"));
    });

    it("THEN a literal </summary> inside a code fence is tolerated", () => {
      const body = ["```html", "</summary>", "```"];
      const source = ["<details>", ...body, "</details>"].join("\n");
      expect(parse(source)?.bodyMarkdown).toBe(body.join("\n"));
    });
  });

  describe("GIVEN unsupported shapes", () => {
    it("THEN a missing closing tag is rejected", () => {
      expect(parse(["<details>", "body"].join("\n"))).toBeNull();
    });

    it("THEN an opening tag sharing a line with content is rejected", () => {
      expect(parse(["<details>body", "</details>"].join("\n"))).toBeNull();
    });

    it("THEN a closing tag sharing a line with content is rejected", () => {
      expect(parse(["<details>", "body</details>"].join("\n"))).toBeNull();
    });

    it("THEN a multi-line summary is rejected as malformed", () => {
      const source = ["<details>", "<summary>line one", "line two</summary>", "</details>"].join("\n");
      expect(parse(source)).toBeNull();
    });

    it("THEN content before the opening tag is rejected", () => {
      const source = ["text", "<details>", "body", "</details>"].join("\n");
      expect(parse(source)).toBeNull();
    });

    it("THEN content after the closing tag is rejected", () => {
      const source = ["<details>", "body", "</details>", "text"].join("\n");
      expect(parse(source)).toBeNull();
    });

    it("THEN an empty body yields empty bodyMarkdown", () => {
      const source = ["<details>", "<summary>s</summary>", "</details>"].join("\n");
      expect(parse(source)?.bodyMarkdown).toBe("");
    });

    it("THEN a tag name that merely starts with 'details' is rejected", () => {
      const source = ["<detailsfoo>", "body", "</detailsfoo>"].join("\n");
      expect(parse(source)).toBeNull();
    });
  });
});
