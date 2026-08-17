import { memo, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./LatexRenderer.css";

/*
 * Recognized bare environments.
 *
 * Bare environments are treated as block math even when the backend
 * does not surround them with \[...\] or $$...$$.
 */
const ENVIRONMENTS = [
  "array",
  "aligned",
  "alignedat",
  "gathered",
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
  "cases",
].join("|");

/*
 * Recognizes, in order:
 *
 * 1. \[ block math \]
 * 2. $$ block math $$
 * 3. Bare \begin{environment}...\end{environment}
 * 4. \( inline math \)
 * 5. $ inline math $
 */
const MATH_PATTERN = new RegExp(
  [
    String.raw`\\\[([\s\S]*?)\\\]`,
    String.raw`\$\$([\s\S]*?)\$\$`,
    String.raw`\\begin\{(${ENVIRONMENTS})\}[\s\S]*?\\end\{\3\}`,
    String.raw`\\\(([\s\S]*?)\\\)`,
    String.raw`(?<!\\)\$(?!\$)([^\n$]+?)(?<!\\)\$`,
  ].join("|"),
  "g"
);

function cleanTableCell(cell) {
  let c = cell.trim();
  c = c.replace(/\\textbf\{([^}]+)\}/g, '$1');
  c = c.replace(/\\text\{([^}]+)\}/g, '$1');
  c = c.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  return c.trim();
}

function parseTableEnvironment(mathStr) {
  const match = mathStr.match(/\\begin\{(?:array|tabular)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|tabular)\}/);
  if (!match) return null;
  const body = match[1];
  const rawRows = body.split(/\\\\|\\cr/).map(r => r.replace(/\\hline/g, '').trim()).filter(Boolean);
  if (rawRows.length === 0) return null;

  const parsedRows = rawRows.map(r => r.split('&').map(cleanTableCell));
  if (parsedRows.length === 0 || parsedRows[0].length === 0) return null;

  const isTextTable = parsedRows.some(row => row.some(cell => cell.length > 3 || /^[A-D]\.|\bList\b|\bColumn\b/i.test(cell)));
  if (!isTextTable) return null; // Keep pure numerical math matrices in KaTeX

  const firstRow = rawRows[0];
  const hasHeader = firstRow.includes('\\textbf') || firstRow.toLowerCase().includes('list') || firstRow.toLowerCase().includes('column');

  if (hasHeader && parsedRows.length > 1) {
    return {
      headers: parsedRows[0],
      rows: parsedRows.slice(1)
    };
  }

  return {
    headers: null,
    rows: parsedRows
  };
}

function parseMixedLatex(input) {
  const text = typeof input === "string" ? input : String(input ?? "");
  const parts = [];

  MATH_PATTERN.lastIndex = 0;
  let lastIndex = 0;
  let match;

  while ((match = MATH_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    const completeMatch = match[0];
    let math;
    let displayMode;

    if (completeMatch.startsWith("\\[")) {
      math = completeMatch.slice(2, -2);
      displayMode = true;
    } else if (completeMatch.startsWith("$$")) {
      math = completeMatch.slice(2, -2);
      displayMode = true;
    } else if (completeMatch.startsWith("\\begin{")) {
      math = completeMatch;
      displayMode = true;
    } else if (completeMatch.startsWith("\\(")) {
      math = completeMatch.slice(2, -2);
      displayMode = false;
    } else {
      math = completeMatch.slice(1, -1);
      displayMode = false;
    }

    const tableData = parseTableEnvironment(math);
    if (tableData) {
      parts.push({
        type: "table",
        tableData,
      });
    } else {
      parts.push({
        type: "math",
        value: math.trim(),
        displayMode,
      });
    }

    lastIndex = MATH_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return parts;
}

function renderPart(part) {
  if (part.type !== "math") {
    return part;
  }

  try {
    const html = katex.renderToString(part.value, {
      displayMode: part.displayMode,
      throwOnError: false,
      errorColor: "#cc0000",
      output: "htmlAndMathml",
      trust: false,
      maxExpand: 1000,
      strict: "warn",
    });

    return {
      ...part,
      html,
      error: null,
    };
  } catch (error) {
    return {
      ...part,
      html: null,
      error,
    };
  }
}

/**
 * Renders ordinary text mixed with LaTeX and native comparison tables.
 *
 * Usage:
 * <LatexRenderer text={question.questionText} />
 */
function LatexRenderer({ text = "", className = "", preserveNewlines = true }) {
  const parts = useMemo(() => parseMixedLatex(text).map(renderPart), [text]);

  return (
    <div
      className={`latex-renderer ${className}`.trim()}
      data-preserve-newlines={preserveNewlines}
    >
      {parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <span className="latex-renderer__text" key={`text-${index}`}>
              {part.value.replace(/\\\$/g, "$")}
            </span>
          );
        }

        if (part.type === "table") {
          const { headers, rows } = part.tableData;
          return (
            <div key={`table-${index}`} className="w-full my-3.5 overflow-x-auto rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md">
              <table className="w-full text-left border-collapse">
                {headers && (
                  <thead className="bg-slate-800/90 text-sky-400 font-heading font-extrabold text-sm sm:text-base border-b border-slate-700">
                    <tr>
                      {headers.map((h, hIdx) => (
                        <th key={hIdx} className="py-2.5 px-4 sm:px-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-slate-800/80 text-slate-100 font-sans text-sm sm:text-base">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2.5 px-4 sm:px-6 font-medium leading-relaxed">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (part.error || !part.html) {
          return (
            <code
              className="latex-renderer__error"
              key={`error-${index}`}
              title={part.error?.message}
            >
              {part.value}
            </code>
          );
        }

        if (part.displayMode) {
          return (
            <div
              className="latex-renderer__math latex-renderer__math--block"
              key={`math-${index}`}
              dangerouslySetInnerHTML={{ __html: part.html }}
            />
          );
        }

        return (
          <span
            className="latex-renderer__math latex-renderer__math--inline"
            key={`math-${index}`}
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        );
      })}
    </div>
  );
}

export default memo(LatexRenderer);
