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

function parseMixedLatex(input) {
  const text = typeof input === "string" ? input : String(input ?? "");
  const parts = [];

  // RegExp objects with the global flag retain lastIndex.
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
      // Remove \[ and \]
      math = completeMatch.slice(2, -2);
      displayMode = true;
    } else if (completeMatch.startsWith("$$")) {
      // Remove opening and closing $$
      math = completeMatch.slice(2, -2);
      displayMode = true;
    } else if (completeMatch.startsWith("\\begin{")) {
      // KaTeX needs the complete environment.
      math = completeMatch;
      displayMode = true;
    } else if (completeMatch.startsWith("\\(")) {
      // Remove \( and \)
      math = completeMatch.slice(2, -2);
      displayMode = false;
    } else {
      // Remove opening and closing single-dollar delimiters.
      math = completeMatch.slice(1, -1);
      displayMode = false;
    }

    parts.push({
      type: "math",
      value: math.trim(),
      displayMode,
    });

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
      // Invalid expressions are displayed rather than crashing React.
      throwOnError: false,
      errorColor: "#cc0000",
      // HTML is used visually; MathML is included for accessibility.
      output: "htmlAndMathml",
      /*
       * Keep this false for backend/user-provided content.
       * It prevents potentially unsafe commands such as arbitrary links,
       * HTML extensions, and includegraphics.
       */
      trust: false,
      // Prevent excessive macro expansion.
      maxExpand: 1000,
      // "warn" is the KaTeX default.
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
 * Renders ordinary text mixed with LaTeX.
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
              {/* Display escaped currency dollars as normal dollars. */}
              {part.value.replace(/\\\$/g, "$")}
            </span>
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
