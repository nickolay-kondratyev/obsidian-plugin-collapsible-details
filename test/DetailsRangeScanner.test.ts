import { describe, expect, it } from "vitest";
import { DetailsRangeScanner } from "../src/DetailsRangeScanner";

/**
 * GIVEN full raw note text
 * WHEN DetailsRangeScanner.scan is called
 * THEN it returns 0-indexed line ranges of supported <details> blocks.
 */
describe("DetailsRangeScanner.scan", () => {
  const scan = (lines: string[]) => DetailsRangeScanner.scan(lines.join("\n"));

  it("THEN a simple block yields its full range", () => {
    const lines = ["before", "<details>", "body", "</details>", "after"];
    expect(scan(lines)).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("THEN a block with blank lines in the body is one range", () => {
    const lines = ["<details>", "a", "", "b", "</details>"];
    expect(scan(lines)).toEqual([{ startLine: 0, endLine: 4 }]);
  });

  it("THEN two blocks yield two ranges", () => {
    const lines = ["<details>", "a", "</details>", "", "<details open>", "b", "</details>"];
    expect(scan(lines)).toEqual([
      { startLine: 0, endLine: 2 },
      { startLine: 4, endLine: 6 },
    ]);
  });

  it("THEN an unclosed block yields no range", () => {
    expect(scan(["<details>", "body forever"])).toEqual([]);
  });

  it("THEN a nested block on its own lines extends the outer range to the matching close", () => {
    const lines = ["<details>", "<details>", "inner", "</details>", "</details>"];
    expect(scan(lines)).toEqual([{ startLine: 0, endLine: 4 }]);
  });

  it("THEN details tags inside a code fence are ignored", () => {
    const lines = ["<details>", "```", "</details>", "```", "real body", "</details>"];
    expect(scan(lines)).toEqual([{ startLine: 0, endLine: 5 }]);
  });

  it("THEN a code fence outside any block does not create ranges", () => {
    const lines = ["```", "<details>", "</details>", "```"];
    expect(scan(lines)).toEqual([]);
  });

  it("THEN an unclosed outer still lets a later closed block match", () => {
    const lines = ["<details>", "no close here", "", "<details>", "b", "</details>"];
    expect(scan(lines)).toEqual([{ startLine: 3, endLine: 5 }]);
  });

  it("THEN inline (non-own-line) tags are not block boundaries", () => {
    expect(scan(["text <details> text", "</details>"])).toEqual([]);
  });
});
