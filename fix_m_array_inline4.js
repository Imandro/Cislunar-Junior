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

const beforeEnd = inline.slice(0, endIdx);
const afterEnd = inline.slice(endIdx);

console.log('End of beforeEnd:', JSON.stringify(beforeEnd.slice(-80)));
console.log('Start of afterEnd:', JSON.stringify(afterEnd.slice(0, 80)));

// The structure is:
// beforeEnd ends with: "]] }\n  ]\n}"
// afterEnd starts with: "];;\n\n{ h:5..."

// We need to fix beforeEnd to end with "}];" and afterEnd to start after the ";"
// The extra stuff is: "\n  ]\n}" in beforeEnd and the first ";" in afterEnd

// Find the mission object closing "}" (should be at the end of beforeEnd)
const missionEnd = beforeEnd.lastIndexOf('}');
console.log('Mission end at:', missionEnd, 'of', beforeEnd.length);

if (missionEnd === beforeEnd.length - 1) {
  // beforeEnd ends with "}"
  // The extra is before that: "\n  ]\n"
  // We need to remove "\n  ]\n" and change "}" to "};"
  const fixedBeforeEnd = beforeEnd.slice(0, beforeEnd.lastIndexOf('\n  ]\n')) + '};';
  const fixedAfterEnd = afterEnd.slice(1); // skip first ";"
  
  const fixedInline = fixedBeforeEnd + fixedAfterEnd;
  
  const inlineStart = html.indexOf(inline.substring(0, 100));
  html = html.slice(0, inlineStart) + fixedInline + html.slice(inlineStart + inline.length);
  
  fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
  console.log('Fixed M array properly');
}