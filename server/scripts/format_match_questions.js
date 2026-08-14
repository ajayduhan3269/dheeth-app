const fs = require('fs');
const path = require('path');

const seedsDir = path.join(__dirname, '..', 'data', 'seeds');

function cleanText(text) {
  if (!text) return '';
  return text.trim().replace(/^[\,\.\:]+/, '').replace(/[\,\.]+\s*$/, '').trim();
}

function parseItems(str, isNumeric = false) {
  const items = [];
  const cleanStr = str.replace(/^List\s*[-–—]?\s*(?:I|II|1st|2nd|1|2)\s*[\:\(-]?.*?\)?/i, '').trim();

  if (isNumeric) {
    const regex = /(?:^|[\,\;\n\|]|\s+)([1-5])[\.\:\)]\s*([\s\S]*?)(?=(?:[\,\;\n\|]|\s+)[1-5][\.\:\)]|$)/g;
    let m;
    while ((m = regex.exec(cleanStr)) !== null) {
      items.push({ label: m[1], val: cleanText(m[2]) });
    }
  } else {
    const regex = /(?:^|[\,\;\n\|]|\s+)([a-dA-D])[\.\:\)]\s*([\s\S]*?)(?=(?:[\,\;\n\|]|\s+)[a-dA-D][\.\:\)]|$)/g;
    let m;
    while ((m = regex.exec(cleanStr)) !== null) {
      items.push({ label: m[1].toUpperCase(), val: cleanText(m[2]) });
    }
  }

  return items;
}

function formatMatchQuestion(text) {
  if (!text || typeof text !== 'string') return text;

  if (!/Match\s+List/i.test(text) && !/List\s*[-–—]?\s*I/i.test(text)) {
    return text;
  }

  if (text.includes('\\begin{array}')) return text;

  try {
    // 1. Pipe-separated format (e.g. POLITY.json, HISTORY.json, GEOGRAPHY.json)
    const lines = text.split(/\\n|\n/).map(l => l.trim()).filter(Boolean);
    const pipeLines = lines.filter(l => l.includes('|'));
    if (pipeLines.length >= 2) {
      let introLines = [];
      let tableRows = [];
      let footerLines = [];
      let inTable = false;
      let col1Title = 'List-I';
      let col2Title = 'List-II';

      for (const line of lines) {
        if (line.includes('|')) {
          inTable = true;
          const parts = line.split('|').map(p => p.trim());
          if (/List\s*[-–—]?\s*I/i.test(parts[0])) {
            col1Title = parts[0];
            col2Title = parts[1] || 'List-II';
          } else {
            tableRows.push(parts);
          }
        } else if (!inTable) {
          introLines.push(line);
        } else {
          footerLines.push(line);
        }
      }

      if (tableRows.length >= 2) {
        const formattedRows = tableRows.map(row => {
          const c1 = cleanText(row[0]);
          const c2 = cleanText(row[1] || '');
          const f1 = c1.includes('$') ? c1 : `\\text{${c1}}`;
          const f2 = c2.includes('$') ? c2 : `\\text{${c2}}`;
          return `  ${f1} & ${f2} \\\\`;
        });

        const title1 = cleanText(col1Title).includes('$') ? cleanText(col1Title) : `\\textbf{${cleanText(col1Title)}}`;
        const title2 = cleanText(col2Title).includes('$') ? cleanText(col2Title) : `\\textbf{${cleanText(col2Title)}}`;

        const latexTable = `$$\n\\begin{array}{|l|l|}\n\\hline\n${title1} & ${title2} \\\\\n\\hline\n${formattedRows.join('\n')}\n\\hline\n\\end{array}\n$$`;

        const introStr = introLines.join('\n\n');
        const footerStr = footerLines.length > 0 ? '\n\n' + footerLines.join('\n') : '';

        return `${introStr}\n\n${latexTable}${footerStr}`;
      }
    }

    // 2. Standard / Single Line / Multiline match questions
    const listIMatches = [...text.matchAll(/List\s*[-–—]?\s*(?:I|1st|1)\b/gi)];
    let matchIStart = -1;
    if (listIMatches.length > 1) {
      matchIStart = listIMatches[1].index;
    } else if (listIMatches.length === 1) {
      matchIStart = listIMatches[0].index;
    } else {
      return text;
    }

    const intro = text.substring(0, matchIStart).trim().replace(/\\n/g, '\n');
    const rest = text.substring(matchIStart);

    const listIIMatches = [...rest.matchAll(/List\s*[-–—]?\s*(?:II|2nd|2)\b/gi)];
    let matchIIStart = -1;
    if (listIIMatches.length > 1) {
      matchIIStart = listIIMatches[1].index;
    } else if (listIIMatches.length === 1) {
      matchIIStart = listIIMatches[0].index;
    } else {
      return text;
    }

    const listIPart = rest.substring(0, matchIIStart);
    const listIIPart = rest.substring(matchIIStart);

    let codePart = '';
    let listIIClean = listIIPart;
    const codeMatch = listIIPart.search(/(Code[s]?\s*:|Select the correct answer|Which of the above)/i);
    if (codeMatch !== -1 && codeMatch > 15) {
      codePart = '\n\n' + listIIPart.substring(codeMatch).trim().replace(/\\n/g, '\n');
      listIIClean = listIIPart.substring(0, codeMatch);
    }

    const listIItems = parseItems(listIPart, false);
    const listIIItems = parseItems(listIIClean, true);

    if (listIItems.length < 2 || listIIItems.length < 2) {
      return text;
    }

    const uniqueI = Array.from(new Map(listIItems.map(item => [item.label, item])).values());
    const uniqueII = Array.from(new Map(listIIItems.map(item => [item.label, item])).values());

    const maxRows = Math.max(uniqueI.length, uniqueII.length);
    const rows = [];

    for (let i = 0; i < maxRows; i++) {
      const col1 = uniqueI[i] ? `${uniqueI[i].label}. ${uniqueI[i].val}` : '';
      const col2 = uniqueII[i] ? `${uniqueII[i].label}. ${uniqueII[i].val}` : '';
      
      const formattedCol1 = col1.includes('$') ? col1 : `\\text{${col1}}`;
      const formattedCol2 = col2.includes('$') ? col2 : `\\text{${col2}}`;

      rows.push(`  ${formattedCol1} & ${formattedCol2} \\\\`);
    }

    const tableLatex = `$$\n\\begin{array}{|l|l|}\n\\hline\n\\textbf{List I} & \\textbf{List II} \\\\\n\\hline\n${rows.join('\n')}\n\\hline\n\\end{array}\n$$`;

    return `${intro}\n\n${tableLatex}${codePart}`;
  } catch (err) {
    console.error('Error formatting match question:', err);
    return text;
  }
}

function processAllSeeds() {
  const files = fs.readdirSync(seedsDir).filter(f => f.endsWith('.json'));
  let totalConverted = 0;

  for (const file of files) {
    const filePath = path.join(seedsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let fileConverted = 0;

    const updated = data.map(q => {
      const key = q.question_text ? 'question_text' : 'questionText';
      const originalText = q[key];
      if (originalText) {
        const formatted = formatMatchQuestion(originalText);
        if (formatted !== originalText) {
          fileConverted++;
          q[key] = formatted;
        }
      }
      return q;
    });

    if (fileConverted > 0) {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
      console.log(`[${file}] Formatted ${fileConverted} Match-List questions into LaTeX tables.`);
      totalConverted += fileConverted;
    }
  }

  console.log(`\n🎉 Total formatted match questions across all seed files: ${totalConverted}`);
}

processAllSeeds();
