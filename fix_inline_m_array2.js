const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Get the last script tag
const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
const inline = scripts[scripts.length - 1].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// Find the problematic pattern in inline
const pattern = '}\n  ]\n}\n  ]\n};';
const fixedPattern = '}\n  ]\n};';

if (inline.includes(pattern)) {
  console.log('Found pattern in inline');
  // Find position in HTML
  const inlineStart = html.indexOf(inline.substring(0, 100));
  const patternPos = inline.indexOf(pattern);
  const htmlPos = inlineStart + patternPos;
  
  html = html.slice(0, htmlPos) + fixedPattern + html.slice(htmlPos + pattern.length);
  fs.writeFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', html, 'utf8');
  console.log('Fixed in HTML');
} else {
  console.log('Pattern not found in inline');
  // Try alternative
  const altPattern = '}\n  ]\n};\n\n{ h:5';
  if (inline.includes(altPattern)) {
    console.log('Found alt pattern');
  }
}