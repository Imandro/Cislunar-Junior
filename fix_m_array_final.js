const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Get the last script tag
const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
const inline = scripts[scripts.length - 1].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// Find Marte mission end in inline
const marteIdx = inline.indexOf('Marte');

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

// The structure is corrupted: "]] }};;;\n\n{ h:5..."
// We need to fix from the last correct point
// The last correct point is after the last event's options array: "]]"
// Then we need "}];" to close mission object and M array

// Find the "]]" that closes the events array
const eventsEnd = inline.lastIndexOf(']]', endIdx);
console.log('Events end at:', eventsEnd);

// The structure should be: inline[0..eventsEnd+2] + "}];" + rest after the corruption
const beforeEventsEnd = inline.slice(0, eventsEnd + 2); // includes "]]"
const afterCorruption = inline.slice(endIdx + 4); // skip "}};;"

const fixedInline = beforeEventsEnd + '}];' + afterCorruption;

// Find in HTML and replace
const inlineStart = html.indexOf(inline.substring(0, 100));
html = html.slice(0, inlineStart) + fixedInline + html.slice(inlineStart + inline.length);

fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
console.log('Fixed M array properly');