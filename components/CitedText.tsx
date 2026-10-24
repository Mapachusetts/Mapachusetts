import type { ReactNode } from "react";

/**
 * Parse text containing inline [n] markers into React nodes, turning markers
 * whose number is in `validNumbers` into superscript links to
 * `#${anchorPrefix}${n}`. Unknown markers are left as plain text.
 */
export function parseCitedText(
  text: string,
  validNumbers: ReadonlySet<number>,
  anchorPrefix: string,
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
        <a
          href={`#${anchorPrefix}${n}`}
          className="cite-ref"
          aria-label={`Source ${n}`}
        >
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
  anchorPrefix = "cite-",
}: {
  text: string;
  validNumbers: ReadonlySet<number>;
  anchorPrefix?: string;
}) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="news-summary">
      {paragraphs.map((p, i) => (
        <p key={`p-${i}`}>
          {parseCitedText(p, validNumbers, anchorPrefix, `p${i}-`)}
        </p>
      ))}
    </div>
  );
}
