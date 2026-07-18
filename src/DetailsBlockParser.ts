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
 *   ...markdown body...      (no blank lines)
 *   </details>               (own line)
 *
 * Anything else returns null so callers leave Obsidian's native rendering untouched.
 */
export class DetailsBlockParser {
  // WHAT (non-obvious regexes): opening tag with only an optional `open` attribute;
  // single-line summary capturing its inner content; bare closing tag.
  private static readonly OPENING_TAG = /^<details(?:\s+open)?>\s*$/i;
  private static readonly SUMMARY_LINE = /^<summary>(.*)<\/summary>\s*$/i;
  private static readonly CLOSING_TAG = /^<\/details>\s*$/i;

  /**
   * Parses a source section expected to contain exactly one supported block
   * (blank lines around the block are tolerated). Returns null for any
   * unsupported or malformed shape.
   */
  static parse(source: string): ParsedDetailsBlock | null {
    const lines = DetailsBlockParser.trimSurroundingBlankLines(source.split("\n"));
    if (lines.length < 2) {
      return null;
    }
    if (!DetailsBlockParser.OPENING_TAG.test(lines[0])) {
      return null;
    }
    if (!DetailsBlockParser.CLOSING_TAG.test(lines[lines.length - 1])) {
      return null;
    }

    const innerLines = lines.slice(1, lines.length - 1);
    const summaryMatch =
      innerLines.length > 0 ? innerLines[0].match(DetailsBlockParser.SUMMARY_LINE) : null;
    const bodyLines = summaryMatch ? innerLines.slice(1) : innerLines;

    const hasInteriorBlankLine = bodyLines.some((line) => line.trim() === "");
    if (hasInteriorBlankLine) {
      return null;
    }
    // A stray <summary> tag in the body means a malformed (e.g. multi-line) summary:
    // rendering it as Markdown would diverge from native behavior, so reject.
    const hasStraySummaryTag = bodyLines.some((line) => /<\/?summary/i.test(line));
    if (hasStraySummaryTag) {
      return null;
    }

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
