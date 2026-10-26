import type { ReactNode } from "react";

/**
 * Parse text containing inline [n] markers into React nodes, turning markers
 * whose number is in `validNumbers` into superscript links to #cite-n.
 * Unknown markers are left as plain text. Pure; keys are position-based.
 */
export function parseCitedText(
  text: string,
  validNumbers: ReadonlySet<number>,
  keyPrefix = ""
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const n = Number(match[1]);
    if (!validNumbers.has(n)) continue; // leave as plain text

    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    nodes.push(
      <sup key={`${keyPrefix}ref-${match.index}`}>
        <a href={`#cite-${n}`} className="cite-ref" aria-label={`Source ${n}`}>
          [{n}]
        </a>
      </sup>
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render a summary (paragraphs separated by blank lines) with citation links. */
export default function CitedText({
  text,
  validNumbers,
}: {
  text: string;
  validNumbers: ReadonlySet<number>;
}) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="news-summary">
      {paragraphs.map((p, i) => (
        <p key={`p-${i}`}>{parseCitedText(p, validNumbers, `p${i}-`)}</p>
      ))}
    </div>
  );
}
