const fs = require('fs');
let html = fs.readFileSync('C:/Users/Zbook de Mario/Desktop/Cislunar Junior/Cislunar Junior - Cañon Labs.html', 'utf8');

// Find all script tags
const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
console.log('Number of script tags:', scriptTags.length);

scriptTags.forEach((tag, i) => {
  const content = tag.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  const hasM = content.includes('var M = [');
  console.log('Script', i, ': length=', content.length, 'has M:', hasM);
  if (hasM) {
    console.log('  First 200 chars:', content.substring(0, 200));
  }
});