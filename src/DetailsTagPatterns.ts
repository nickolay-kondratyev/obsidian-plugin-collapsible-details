/** Line-level regexes for the supported `<details>` block shape, shared by parser and scanner. */
export class DetailsTagPatterns {
  // WHAT (non-obvious regexes): opening tag with only an optional `open` attribute on its own line;
  // single-line summary capturing its inner content; bare closing tag on its own line.
  static readonly OPENING_LINE = /^<details(?:\s+open)?>\s*$/i;
  static readonly SUMMARY_LINE = /^<summary>(.*)<\/summary>\s*$/i;
  static readonly CLOSING_LINE = /^<\/details>\s*$/i;
  /** A fenced-code delimiter line (``` or ~~~, up to 3 leading spaces, per CommonMark). */
  static readonly FENCE_DELIMITER_LINE = /^ {0,3}(?:`{3,}|~{3,})/;
}
