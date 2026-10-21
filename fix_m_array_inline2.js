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
// Should be: "}]\n};\n\nvar SAT = ..."
// We need to replace "}]\n  ]\n};" with "}];"

const beforeEnd = inline.slice(0, endIdx);
const afterEnd = inline.slice(endIdx);

// Find the pattern to fix
const pattern = '}]\n  ]\n};';
const fixedPattern = '}];';

if (beforeEnd.endsWith(pattern)) {
  const fixedInline = beforeEnd.slice(0, -pattern.length) + fixedPattern + afterEnd;
  
  // Find in HTML and replace
  const inlineStart = html.indexOf(inline.substring(0, 100));
  const htmlPos = inlineStart;
  html = html.slice(0, htmlPos) + fixedInline + html.slice(htmlPos + inline.length);
  
  fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
  console.log('Fixed M array properly');
} else {
  console.log('Pattern not found at end of beforeEnd');
  console.log('End of beforeEnd:', JSON.stringify(beforeEnd.slice(-50)));
}