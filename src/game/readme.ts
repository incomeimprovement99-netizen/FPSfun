// README.md, parsed into the sections and blocks the range's README screen
// draws (readmetv.ts).
//
// The screen shows the project's own README rather than a copy of it, so it
// can never drift: `README.md?raw` is bundled at build time, and the public
// build runs it through tools/public-text.ts first (codenames, as
// PROJECT_RULES.md section 2 asks).
//
// Markdown, only as much as this README uses: "##" headings are the sections,
// "###" a subhead, paragraphs, lists, fenced code, and tables (a row becomes
// its first cell and the rest). Inline **bold**, `code` and [links](url).

/** a run of text in one style */
export interface Span {
  text: string;
  bold?: boolean;
  code?: boolean;
}

export type Block =
  /** a "###" subhead */
  | { kind: "head"; spans: Span[] }
  | { kind: "para"; spans: Span[] }
  | { kind: "item"; marker: string; spans: Span[] }
  /** a table's header row, drawn dim */
  | { kind: "caption"; spans: Span[] }
  /** a table row: the first cell, then the rest */
  | { kind: "row"; spans: Span[] }
  | { kind: "code"; spans: Span[] };

export interface Section {
  title: string;
  blocks: Block[];
}

/** **bold**, `code` and [text](url) in one line of markdown */
export function spansOf(text: string, bold = false): Span[] {
  const out: Span[] = [];
  let rest = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => (url.startsWith("#") ? label : `${label} (${url})`));
  const push = (t: string, style: Partial<Span>) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && !!last.bold === !!(style.bold ?? bold) && !!last.code === !!style.code) last.text += t;
    else out.push({ text: t, bold: style.bold ?? bold, code: style.code });
  };
  while (rest) {
    const m = /\*\*([^*]+)\*\*|`([^`]+)`/.exec(rest);
    if (!m) {
      push(rest, {});
      break;
    }
    push(rest.slice(0, m.index), {});
    if (m[1] !== undefined) push(m[1], { bold: true });
    else push(m[2], { code: true, bold });
    rest = rest.slice(m.index + m[0].length);
  }
  return out.length ? out : [{ text: "", bold }];
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

/** a "|---|---|" line under a table's header */
const isRule = (line: string): boolean => /^\|[\s:|-]+\|$/.test(line.trim());

/**
 * The README as sections. "Contents" is dropped: the screen's own list of
 * sections is the contents, and it is always in step with the file.
 */
export function parseReadme(md: string): Section[] {
  const sections: Section[] = [];
  let cur: Section = { title: "What this is", blocks: [] };
  sections.push(cur);
  const lines = md.split(/\r?\n/);
  let para: string[] = [];
  let item: { marker: string; text: string } | null = null;
  /** a table's header cells, so a "Key|Action|Key|Action" table can be split into two rows a line */
  let header: string[] | null = null;

  const flushPara = () => {
    if (para.length) cur.blocks.push({ kind: "para", spans: spansOf(para.join(" ")) });
    para = [];
  };
  const flushItem = () => {
    if (item) cur.blocks.push({ kind: "item", marker: item.marker, spans: spansOf(item.text) });
    item = null;
  };
  const flush = () => {
    flushItem();
    flushPara();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    // fenced code: kept as its own lines
    if (t.startsWith("```")) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) code.push(lines[i]);
      for (const c of code) if (c.trim()) cur.blocks.push({ kind: "code", spans: [{ text: c.replace(/\t/g, "  "), code: true }] });
      continue;
    }
    if (t.startsWith("## ")) {
      flush();
      header = null;
      cur = { title: t.slice(3).trim(), blocks: [] };
      sections.push(cur);
      continue;
    }
    if (t.startsWith("# ")) {
      flush();
      cur.title = t.slice(2).trim();
      continue;
    }
    if (t.startsWith("### ")) {
      flush();
      cur.blocks.push({ kind: "head", spans: spansOf(t.slice(4).trim(), true) });
      continue;
    }
    if (!t) {
      flush();
      header = null;
      continue;
    }
    if (isRule(t)) continue;
    if (t.startsWith("|")) {
      flush();
      const c = cells(t);
      if (!header) {
        header = c;
        cur.blocks.push({ kind: "caption", spans: spansOf(c.join("  ·  ")) });
        continue;
      }
      // "Key | Action | Key | Action": the same pair twice on a line
      const pairs = header.length === 4 && header[0] === header[2] && header[1] === header[3] ? [c.slice(0, 2), c.slice(2)] : [c];
      for (const p of pairs) {
        if (!p.length || !p.join("").trim()) continue;
        cur.blocks.push({ kind: "row", spans: [...spansOf(p[0], true), ...spansOf(p.length > 1 ? `  —  ${p.slice(1).join("  ·  ")}` : "")] });
      }
      continue;
    }
    header = null;
    const li = /^([-*]|\d+\.)\s+(.*)$/.exec(t);
    if (li) {
      flush();
      item = { marker: li[1] === "-" || li[1] === "*" ? "•" : li[1], text: li[2] };
      continue;
    }
    // a wrapped line: it belongs to the list item or paragraph above it
    if (item) item.text += ` ${t}`;
    else para.push(t);
  }
  flush();
  return sections.filter((s) => s.blocks.length && s.title !== "Contents");
}
