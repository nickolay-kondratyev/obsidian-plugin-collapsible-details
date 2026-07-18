import { DetailsTagPatterns } from "./DetailsTagPatterns";

/** Result of parsing a supported `<details>` block from raw Markdown source. */
export interface ParsedDetailsBlock {
  /** Inner text of the single-line `<summary>` tag, or null when absent. */
  readonly summaryText: string | null;
  /** Raw Markdown body between summary (or opening tag) and `</details>`, lines joined by `\n`. */
  readonly bodyMarkdown: string;
}

/**
 * Pure parser for the exact block shape this plugin supports (see req.md "Supported input"):
 *
 *   <details>            (or `<details open>`; own line)
 *   <summary>...</summary>   (optional; single line)
 *   ...markdown body...      (blank lines allowed — Phase 1.5)
 *   </details>               (own line)
 *
 * Anything else returns null so callers leave Obsidian's native rendering untouched.
 */
export class DetailsBlockParser {
  /**
   * Parses a source snippet expected to contain exactly one supported block
   * (blank lines around the block are tolerated). Returns null for any
   * unsupported or malformed shape.
   */
  static parse(source: string): ParsedDetailsBlock | null {
    const lines = DetailsBlockParser.trimSurroundingBlankLines(source.split("\n"));
    if (lines.length < 2) {
      return null;
    }
    if (!DetailsTagPatterns.OPENING_LINE.test(lines[0])) {
      return null;
    }
    if (!DetailsTagPatterns.CLOSING_LINE.test(lines[lines.length - 1])) {
      return null;
    }

    const innerLines = lines.slice(1, lines.length - 1);
    const summaryMatch =
      innerLines.length > 0 ? innerLines[0].match(DetailsTagPatterns.SUMMARY_LINE) : null;
    // A <summary> that opens but is not a valid single line (e.g. spans multiple lines)
    // is malformed: rendering its tags as Markdown would diverge from native behavior.
    if (summaryMatch === null && innerLines.length > 0 && /^<summary/i.test(innerLines[0].trim())) {
      return null;
    }
    const bodyLines = summaryMatch ? innerLines.slice(1) : innerLines;

    return {
      summaryText: summaryMatch ? summaryMatch[1] : null,
      bodyMarkdown: bodyLines.join("\n"),
    };
  }

  private static trimSurroundingBlankLines(lines: string[]): string[] {
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start].trim() === "") start++;
    while (end > start && lines[end - 1].trim() === "") end--;
    return lines.slice(start, end);
  }
}
