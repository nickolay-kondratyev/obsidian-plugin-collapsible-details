import { DetailsTagPatterns } from "./DetailsTagPatterns";

/** Inclusive 0-indexed line range of a supported `<details>...</details>` block. */
export interface DetailsRange {
  readonly startLine: number;
  readonly endLine: number;
}

/**
 * Scans full raw note text for supported `<details>` block ranges.
 *
 * Needed because Obsidian ends an HTML block at the first blank line, splitting a
 * block with blank-line bodies across multiple render sections; the ranges let the
 * post-processor re-assemble the block from source (req.md Phase 1.5).
 *
 * Rules: tags count only on their own lines; tags inside fenced code are ignored;
 * nesting is tracked so the outer range extends to its matching close; unclosed
 * openings yield no range (native behavior is preserved for them).
 */
export class DetailsRangeScanner {
  static scan(text: string): DetailsRange[] {
    const lines = text.split("\n");
    const inFence = DetailsRangeScanner.computeFenceMask(lines);
    const ranges: DetailsRange[] = [];
    let i = 0;
    while (i < lines.length) {
      if (!inFence[i] && DetailsTagPatterns.OPENING_LINE.test(lines[i])) {
        const endLine = DetailsRangeScanner.findMatchingClose(lines, inFence, i);
        if (endLine !== -1) {
          ranges.push({ startLine: i, endLine });
          i = endLine + 1;
          continue;
        }
      }
      i++;
    }
    return ranges;
  }

  /** Line index of the close matching the opening at `openLine`, or -1 if unclosed. */
  private static findMatchingClose(
    lines: string[],
    inFence: boolean[],
    openLine: number
  ): number {
    let depth = 1;
    for (let j = openLine + 1; j < lines.length; j++) {
      if (inFence[j]) {
        continue;
      }
      if (DetailsTagPatterns.OPENING_LINE.test(lines[j])) {
        depth++;
      } else if (DetailsTagPatterns.CLOSING_LINE.test(lines[j])) {
        depth--;
        if (depth === 0) {
          return j;
        }
      }
    }
    return -1;
  }

  /** True for lines inside (or delimiting) a fenced code block, so tags there are ignored. */
  private static computeFenceMask(lines: string[]): boolean[] {
    const mask = new Array<boolean>(lines.length);
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      if (DetailsTagPatterns.FENCE_DELIMITER_LINE.test(lines[i])) {
        mask[i] = true;
        inFence = !inFence;
      } else {
        mask[i] = inFence;
      }
    }
    return mask;
  }
}
