import { DetailsRange } from "./DetailsRangeScanner";

/** How a rendered section relates to the scanned `<details>` block ranges. */
export type SectionRole =
  | { kind: "opening"; range: DetailsRange }
  | { kind: "fragment"; range: DetailsRange }
  | { kind: "none" };

/**
 * Classifies a rendered section (by its line span) against the block ranges:
 * - "opening": the section starts exactly at a block start → render the full body there.
 * - "fragment": the section fell inside a block (content escaped past a blank line) → hide it.
 * - "none": unrelated, or a glued section extending past the block end (never hidden,
 *   so no unrelated content can be lost).
 */
export class SectionRoleClassifier {
  static classify(
    ranges: readonly DetailsRange[],
    lineStart: number,
    lineEnd: number
  ): SectionRole {
    for (const range of ranges) {
      if (lineStart === range.startLine) {
        return { kind: "opening", range };
      }
      const startsInside = lineStart > range.startLine && lineStart <= range.endLine;
      if (startsInside && lineEnd <= range.endLine) {
        return { kind: "fragment", range };
      }
    }
    return { kind: "none" };
  }
}
