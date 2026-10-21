const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Get the last script tag
const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
const inline = scripts[scripts.length - 1].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// Find Marte mission end in inline
const marteIdx = inline.indexOf("Marte");

let braceCount = 0;
let inObj = false;
let endIdx = -1;
for (let i = marteIdx; i < inline.length; i++) {
  if (inline[i] === '{') { braceCount++; inObj = true; }
  else if (inline[i] === '}') { 
    braceCount--; 
    if (inObj && braceCount === 0) { 
      endIdx = i + 1; 
      break;
    } 
  }
}

// The structure after Marte mission is: "]] }\n  ]\n};\n\n{ h:5..."
// The mission object ends at endIdx with "}"
// Before that: "]] }\n  ]\n}"
// We need to fix from the mission object end

const beforeEnd = inline.slice(0, endIdx);
const afterEnd = inline.slice(endIdx);

console.log('End of beforeEnd:', JSON.stringify(beforeEnd.slice(-60)));
console.log('Start of afterEnd:', JSON.stringify(afterEnd.slice(0, 60)));

// The pattern is: beforeEnd ends with "]] }\n  ]\n}"
// afterEnd starts with ";\n\n{ h:5..."
// We need to replace the extra "]\n}" in beforeEnd and add "];" 

// Find the last "}]" in beforeEnd (should be the mission object end)
const lastBrace = beforeEnd.lastIndexOf('}]');
console.log('Last }] at:', lastBrace);

if (lastBrace >= 0) {
  // Keep everything up to and including "}]"
  // Then add "];" 
  // Then skip the extra "}\n  ]\n}" in beforeEnd and the ";" in afterEnd
  const fixedBeforeEnd = beforeEnd.slice(0, lastBrace + 2) + '];';
  const fixedAfterEnd = afterEnd.slice(1); // skip the leading ";"
  
  const fixedInline = fixedBeforeEnd + fixedAfterEnd;
  
  // Find in HTML and replace
  const inlineStart = html.indexOf(inline.substring(0, 100));
  html = html.slice(0, inlineStart) + fixedInline + html.slice(inlineStart + inline.length);
  
  fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
  console.log('Fixed M array properly');
}