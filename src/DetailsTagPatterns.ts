/** Line-level regexes for the supported `<details>` block shape, shared by parser and scanner. */
export class DetailsTagPatterns {
  // WHAT (non-obvious regexes): opening tag on its own line, allowing any attributes
  // (e.g. `open`, `class="..."`), optionally followed on that line by a single-line summary,
  // whose inner content group 1 captures (`<details><summary>X</summary>`, as exported web
  // pages write it); single-line summary (attributes allowed) capturing its inner content;
  // bare closing tag on its own line. `\s[^>]*` requires a space before the attribute list
  // and stops at the first `>`, so `<detailsfoo>` is not matched.
  static readonly OPENING_LINE =
    /^<details(?:\s[^>]*)?>\s*(?:<summary(?:\s[^>]*)?>(.*)<\/summary>\s*)?$/i;
  static readonly SUMMARY_LINE = /^<summary(?:\s[^>]*)?>(.*)<\/summary>\s*$/i;
  static readonly CLOSING_LINE = /^<\/details>\s*$/i;
  /** A fenced-code delimiter line (``` or ~~~, up to 3 leading spaces, per CommonMark). */
  static readonly FENCE_DELIMITER_LINE = /^ {0,3}(?:`{3,}|~{3,})/;
}
