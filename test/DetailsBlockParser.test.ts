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

  describe("GIVEN unsupported shapes", () => {
    it("THEN a blank line inside the body is rejected", () => {
      const source = ["<details>", "body", "", "more", "</details>"].join("\n");
      expect(parse(source)).toBeNull();
    });

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

    it("THEN unrelated attributes on details are rejected", () => {
      const source = ['<details class="x">', "body", "</details>"].join("\n");
      expect(parse(source)).toBeNull();
    });
  });
});
