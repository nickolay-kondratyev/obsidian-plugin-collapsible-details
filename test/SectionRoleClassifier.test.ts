import { describe, expect, it } from "vitest";
import { SectionRoleClassifier } from "../src/SectionRoleClassifier";
import { DetailsRange } from "../src/DetailsRangeScanner";

/**
 * GIVEN block ranges and a rendered section's line span
 * WHEN SectionRoleClassifier.classify is called
 * THEN it says whether the section opens a block, is an escaped fragment, or neither.
 */
describe("SectionRoleClassifier.classify", () => {
  const range: DetailsRange = { startLine: 5, endLine: 12 };
  const classify = (lineStart: number, lineEnd: number) =>
    SectionRoleClassifier.classify([range], lineStart, lineEnd);

  it("THEN a section starting at the block start is the opening", () => {
    expect(classify(5, 7)).toEqual({ kind: "opening", range });
  });

  it("THEN a section fully inside the block is a fragment", () => {
    expect(classify(8, 10)).toEqual({ kind: "fragment", range });
  });

  it("THEN the closing-tag section is a fragment", () => {
    expect(classify(12, 12)).toEqual({ kind: "fragment", range });
  });

  it("THEN a section extending past the block end is not a fragment (glued tail)", () => {
    expect(classify(12, 14)).toEqual({ kind: "none" });
  });

  it("THEN a section before the block is none", () => {
    expect(classify(0, 4)).toEqual({ kind: "none" });
  });

  it("THEN a section after the block is none", () => {
    expect(classify(13, 15)).toEqual({ kind: "none" });
  });

  it("THEN a section holding the block start after glued text is the opening", () => {
    expect(classify(3, 5)).toEqual({ kind: "opening", range });
  });

  it("THEN a glued section covering the whole block is the opening", () => {
    expect(classify(3, 12)).toEqual({ kind: "opening", range });
  });

  it("THEN a closing-tag section glued to the next block's opening opens that block", () => {
    const next: DetailsRange = { startLine: 13, endLine: 20 };
    expect(SectionRoleClassifier.classify([range, next], 12, 13)).toEqual({ kind: "opening", range: next });
  });
});
