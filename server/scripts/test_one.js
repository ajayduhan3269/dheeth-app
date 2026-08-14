const text = "Match List I with List II and select the correct answer using the codes given below the lists: List I: A. Penetration test, B. Marshal test, C. Ring and ball test, D. Benkelman beam test List II: 1. Design of bituminous concrete mix, 2. Overlay design, 3. Gradation of asphalt cement, 4. Determination of softening point";

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

// Find List I block header (skip "Match List I with List II" intro)
const listIMatches = [...text.matchAll(/List\s*[-–—]?\s*(?:I|1st|1)\b/gi)];
let matchIStart = -1;
if (listIMatches.length > 1) {
  matchIStart = listIMatches[1].index;
} else if (listIMatches.length === 1) {
  matchIStart = listIMatches[0].index;
}

const intro = text.substring(0, matchIStart).trim();
const rest = text.substring(matchIStart);

const listIIMatches = [...rest.matchAll(/List\s*[-–—]?\s*(?:II|2nd|2)\b/gi)];
let matchIIStart = -1;
if (listIIMatches.length > 1) {
  matchIIStart = listIIMatches[1].index;
} else if (listIIMatches.length === 1) {
  matchIIStart = listIIMatches[0].index;
}

const listIPart = rest.substring(0, matchIIStart);
const listIIPart = rest.substring(matchIIStart);

console.log("Intro:", intro);
console.log("listIPart:", listIPart);
console.log("listIIPart:", listIIPart);

const listIItems = parseItems(listIPart, false);
const listIIItems = parseItems(listIIPart, true);

console.log("listIItems:", listIItems);
console.log("listIIItems:", listIIItems);
