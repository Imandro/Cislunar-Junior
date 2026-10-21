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

// The structure after Marte mission should be: "}];\n\nvar SAT = ..."
// But currently it's: "};\n\n{ h:5..."
// We need to insert "];" after the mission object closes (after the };)
const beforeEnd = inline.slice(0, endIdx);
const afterEnd = inline.slice(endIdx);

// Check what's at endIdx
console.log('At endIdx:', JSON.stringify(inline.slice(endIdx - 10, endIdx + 50)));

// The mission object ends with "}," or "}" 
// We need to add "];" to close the M array
// The pattern is: mission object ends with "}" then we need "];"
const fixedInline = beforeEnd + '];' + afterEnd;

// Now find this in the HTML and replace
const inlineStart = html.indexOf(inline.substring(0, 100));
const htmlPos = inlineStart + endIdx;
html = html.slice(0, htmlPos) + '];' + html.slice(htmlPos);

fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
console.log('Fixed M array closing in inline script');