/**
 * The roast is written as prose with a deliberately tiny subset of markdown —
 * `**bold**` for the load-bearing phrases and `*italic*` for the occasional
 * aside — so the emphasis in a review reads like an editor put it there
 * rather than being flat wall-to-wall text. That's the whole grammar: no
 * headings, links or lists, which is why this is 30 lines of regex instead of
 * a markdown dependency, and why nothing here can emit HTML.
 */

export type RichTextPart =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string };

// Bold is listed first so `**foo**` never gets matched as an empty italic.
const EMPHASIS_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function parseRichText(input: string): RichTextPart[] {
  return input
    .split(EMPHASIS_PATTERN)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return { type: "bold" as const, text: part.slice(2, -2) };
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return { type: "italic" as const, text: part.slice(1, -1) };
      }
      return { type: "text" as const, text: part };
    });
}

/**
 * Flattens the markers back out for anywhere emphasis can't be rendered —
 * `<meta>` descriptions, share sheet text, image cards drawn by Satori.
 */
export function stripEmphasis(input: string): string {
  return parseRichText(input)
    .map((part) => part.text)
    .join("");
}
