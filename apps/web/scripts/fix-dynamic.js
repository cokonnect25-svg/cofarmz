const fs = require('fs');
const path = require('path');

function getAllRoutes(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(getAllRoutes(filePath));
        } else if (file === 'route.ts') {
          results.push(filePath);
        }
      } catch(e) {}
    });
  } catch(e) {}
  return results;
}

const apiDir = path.join(process.cwd(), 'app', 'api');
const routes = getAllRoutes(apiDir);
let fixed = 0;
let skipped = 0;
routes.forEach(f => {
  try {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('force-dynamic')) {
      content = "export const dynamic = 'force-dynamic';\n" + content;
      fs.writeFileSync(f, content, 'utf8');
      fixed++;
      console.log('Fixed:', f.replace(process.cwd(), '.'));
    } else {
      skipped++;
    }
  } catch(e) {
    console.error('Error on', f, e.message);
  }
});
console.log('\nDone! Fixed:', fixed, '| Skipped (already had it):', skipped);
