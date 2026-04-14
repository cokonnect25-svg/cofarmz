const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const apiDir = path.join(process.cwd(), 'app', 'api');
const apiDirHidden = path.join(process.cwd(), 'app', '_api_backup');

console.log('📦 Mobile build starting...');
console.log('⏸  Temporarily hiding API routes from static export...');

try {
  // 1. Hide API folder
  fs.renameSync(apiDir, apiDirHidden);
  console.log('✅ API routes hidden');

  // 2. Run Next.js static build
  console.log('🔨 Building static Next.js export...');
  execSync('npx next build', { stdio: 'inherit' });
  console.log('✅ Static build complete');

} catch (err) {
  console.error('❌ Build failed:', err.message);
} finally {
  // 3. Always restore API folder
  if (fs.existsSync(apiDirHidden)) {
    fs.renameSync(apiDirHidden, apiDir);
    console.log('✅ API routes restored');
  }
}

// 4. Sync to Android
console.log('📱 Syncing to Android...');
try {
  execSync('npx cap sync', { stdio: 'inherit' });
  console.log('✅ Capacitor sync complete!');
  console.log('\n🎉 Ready to build APK: cd android && .\\gradlew assembleDebug');
} catch (err) {
  console.error('❌ Cap sync failed:', err.message);
}
