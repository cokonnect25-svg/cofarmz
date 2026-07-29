const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const hiddenRoutes = [
  ['api', '_api_backup'],
  // This empty server placeholder cannot be exported and is not used by the app.
  [path.join('admin', 'profile'), path.join('admin', '_profile_backup')],
].map(([route, backup]) => ({
  route: path.join(process.cwd(), 'app', route),
  backup: path.join(process.cwd(), 'app', backup),
}));

let buildSucceeded = false;

console.log('Mobile build starting...');
console.log('Temporarily hiding server-only routes from the static export...');

try {
  for (const { route, backup } of hiddenRoutes) {
    if (fs.existsSync(route)) fs.renameSync(route, backup);
  }
  console.log('Server-only routes hidden');

  console.log('Building static Next.js export...');
  execSync('npx next build', {
    stdio: 'inherit',
    env: { ...process.env, MOBILE_BUILD: 'true' },
  });
  console.log('Static build complete');
  buildSucceeded = true;
} catch (err) {
  console.error('Build failed:', err.message);
} finally {
  for (const { route, backup } of [...hiddenRoutes].reverse()) {
    if (fs.existsSync(backup)) fs.renameSync(backup, route);
  }
  console.log('Server-only routes restored');
}

if (!buildSucceeded) {
  console.error('Android sync skipped because the static build failed.');
  process.exitCode = 1;
} else {
  console.log('Syncing static assets to Android...');
  try {
    execSync('npx cap sync', { stdio: 'inherit' });
    console.log('Capacitor sync complete.');
    console.log('Ready to build APK: cd android && .\\gradlew assembleDebug');
  } catch (err) {
    console.error('Capacitor sync failed:', err.message);
    process.exitCode = 1;
  }
}
