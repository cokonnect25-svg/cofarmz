const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const postcss = require('postcss');
const tailwind = require('tailwindcss');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.tsx') ? [file] : [];
  });
}
function classes(file, prefix) {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/className="([^"]+)"/g)].map(m => m[1]).find(c => c.startsWith(prefix));
}

(async () => {
  const top = classes('app/components/TopNav.tsx', 'fixed top-0');
  const bottom = classes('app/components/BottomNav.tsx', 'fixed bottom-0');
  const native = classes('components/FpoGroupDialog.tsx', 'fixed inset-0');
  const overlays = walk('app').flatMap(file => {
    const source = fs.readFileSync(file, 'utf8');
    return [...source.matchAll(/className="(app-dialog-overlay [^"]+)"/g)].map(m => ({ file, classes: m[1] }));
  });
  assert(overlays.length >= 38);
  const raw = [top, bottom, native, ...overlays.map(o => o.classes)].join(' ');
  const css = (await postcss([tailwind({ content: [{ raw, extension: 'html' }] })])
    .process(fs.readFileSync('app/globals.css', 'utf8'), { from: 'app/globals.css' })).css;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cofarmz-dialog-check-'));
  const file = path.join(folder, 'dialogs.html');
  fs.writeFileSync(file, `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>
    <nav id="top" class="${top}" style="height:64px">Top navigation</nav>
    <nav id="bottom" class="${bottom}" style="height:60px;display:block">Bottom navigation</nav>
    <main>Page content</main><pre id="results"></pre>
    <script>
      const errors = [];
      const check = (condition, message) => { if (!condition) errors.push(message); };
      const navHit = (x,y) => ['top','bottom'].includes(document.elementFromPoint(x,y)?.closest('nav')?.id);
      check(navHit(8,8), 'Top navigation should be usable before a dialog opens');
      check(navHit(8,innerHeight-8), 'Bottom navigation should be usable before a dialog opens');
      for (const item of ${JSON.stringify(overlays)}) {
        const overlay = document.createElement('div'); overlay.className = item.classes;
        overlay.innerHTML = '<div style="background:white;width:280px;padding:24px">Dialog content <button>Close</button></div>';
        document.body.append(overlay);
        check(!navHit(8,8), item.file + ': top navigation covers dialog');
        check(!navHit(8,innerHeight-8), item.file + ': bottom navigation covers dialog');
        overlay.remove();
      }
      const tall = document.createElement('div');
      tall.className = 'app-dialog-overlay fixed inset-0 z-50 flex items-center justify-center';
      tall.innerHTML = '<section style="height:1200px;width:280px;background:white">Tall dialog</section>';
      document.body.append(tall);
      check(tall.firstElementChild.getBoundingClientRect().top >= 0, 'Tall dialog close/header area is above viewport');
      tall.scrollTop = 1200;
      check(tall.scrollTop > 0, 'Tall dialog cannot scroll');
      tall.remove();
      const dialog = document.createElement('dialog'); dialog.className = ${JSON.stringify(native)};
      dialog.innerHTML = '<div style="height:240px;padding:24px">FPO report preview</div>';
      document.body.append(dialog); dialog.showModal();
      const rect = dialog.getBoundingClientRect();
      check(Math.abs(rect.left + rect.width/2 - innerWidth/2) < 2, 'Native FPO dialog is not horizontally centered');
      check(Math.abs(rect.top + rect.height/2 - innerHeight/2) < 2, 'Native FPO dialog is not vertically centered');
      check(!navHit(8,8) && !navHit(8,innerHeight-8), 'Navigation covers native dialog');
      dialog.close(); dialog.remove();
      check(navHit(8,8) && navHit(8,innerHeight-8), 'Navigation remains blocked after close');
      document.getElementById('results').textContent = JSON.stringify({ width:innerWidth,height:innerHeight,overlays:${overlays.length},errors });
    </script>`);
  const browser = process.env.DIALOG_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  for (const size of ['390,844', '1280,900', '390,400']) {
    // Desktop Chrome has a minimum window width. An iframe gives the document
    // the exact mobile viewport, including media queries and dynamic vh units.
    const [width, height] = size.split(',').map(Number);
    const wrapper = path.join(folder, `viewport-${width}-${height}.html`);
    fs.writeFileSync(wrapper, `<!doctype html><iframe src="dialogs.html" style="border:0;width:${width}px;height:${height}px" onload="document.getElementById('results').textContent=this.contentDocument.getElementById('results').textContent"></iframe><pre id="results"></pre>`);
    const output = execFileSync(browser, ['--headless', '--disable-gpu', '--no-first-run',
      '--no-default-browser-check', '--disable-extensions', '--allow-file-access-from-files',
      `--user-data-dir=${path.join(folder, size.replace(',', '-'))}`, `--window-size=${size}`,
      '--virtual-time-budget=1000', '--dump-dom', `file:///${wrapper.replaceAll('\\', '/')}`], { encoding: 'utf8', timeout: 25000, stdio: ['ignore','pipe','pipe'] });
    const result = JSON.parse(output.match(/<pre id="results">([^<]+)<\/pre>/)[1]);
    assert.equal(result.width, width);
    assert.equal(result.height, height);
    assert.deepEqual(result.errors, [], JSON.stringify(result));
    console.log(`PASS: ${result.overlays} dialog layers, tall dialog scrolling, centered FPO preview, navigation restored (${result.width}x${result.height})`);
  }
  console.log('Browser fixtures:', folder);
})().catch(error => { console.error(error); process.exitCode = 1; });
