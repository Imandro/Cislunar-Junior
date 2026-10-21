const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Find the start of the inline script (last script tag)
const lastScriptStart = html.lastIndexOf('<script>');
const inlineContentStart = html.indexOf('>', lastScriptStart) + 1;

// Find M array in inline script
const mIdx = html.indexOf('var M = [', inlineContentStart);

// Find end of M array in inline script
let braceCount = 0;
let inArray = false;
let endIdx = -1;
for (let i = mIdx; i < html.length; i++) {
  if (html[i] === '[') { braceCount++; inArray = true; }
  else if (html[i] === ']') { 
    braceCount--; 
    if (inArray && braceCount === 0) { 
      endIdx = i + 1; 
      break;
    } 
  }
}

// The structure is: "  ]\n}\n  ]\n};\n\n{ h:5..."
// We need to remove the extra "}\n  ]\n" before the final "};"
const beforeEnd = html.slice(0, endIdx);
const afterEnd = html.slice(endIdx);

// Find the extra closing brackets
// The pattern is: "  ]\n}\n  ]\n};"
// Should be: "  ]\n};"
const fixedBeforeEnd = beforeEnd.replace(/\n\}\n\s*\]\n\};$/, '\n  ]\n};');

html = fixedBeforeEnd + afterEnd;

fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
console.log('Fixed inline script M array');