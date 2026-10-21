const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function load(file, mocks) {
  const mod = new Module(file, module);
  mod.require = name => name in mocks ? mocks[name] : require(name);
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(result.diagnostics.length, 0);
  mod._compile(result.outputText, file);
  return mod.exports;
}

(async () => {
  const env = { ...process.env };
  try {
    process.env.BETTER_AUTH_URL = 'https://native.example';
    process.env.GOOGLE_CLIENT_ID_MOBILE = ' "mobile-web-client" ';
    process.env.GOOGLE_CLIENT_ID = 'other-web-client';
    const pools = [];
    const mocks = {
      'better-auth': { betterAuth: options => options },
      pg: { Pool: class { constructor(options) { this.options = options; pools.push(this); } } },
    };
    const contexts = load('lib/auth.ts', mocks);
    assert.equal(contexts.auth.baseURL, 'https://native.example');
    assert.equal(contexts.websiteAuth.baseURL, 'https://cofarmz.com');
    assert.equal(contexts.auth.database, contexts.websiteAuth.database);
    assert.equal(pools.length, 1);
    assert.equal(contexts.websiteAuth.socialProviders.google.clientId, 'mobile-web-client');
    assert.equal(contexts.auth.socialProviders.google.clientId, 'mobile-web-client');
    process.env.GOOGLE_CLIENT_ID_MOBILE = '   ';
    assert.equal(load('lib/auth.ts', mocks).auth.socialProviders.google.clientId, 'other-web-client');

    const route = load('app/api/auth/[...all]/route.ts', {
      '@/lib/auth': contexts,
      'better-auth/next-js': { toNextJsHandler: context => ({
        GET: async () => Response.json({ baseURL: context.baseURL }),
        POST: async () => Response.json({ baseURL: context.baseURL }),
      }) },
    });
    for (const method of ['GET', 'POST']) {
      for (const [marker, expected] of [
        ['cofarmz.com', 'https://cofarmz.com'],
        [null, 'https://native.example'],
        ['untrusted.example', 'https://native.example'],
      ]) {
        const headers = marker ? { 'x-cofarmz-website': marker } : {};
        // No Origin: models Google's callback and direct native requests.
        const response = await route[method](new Request('https://backend.example/api/auth/callback/google', { method, headers }));
        assert.equal((await response.json()).baseURL, expected);
      }
    }
    console.log('PASS: shared pool; native configuration preserved; Google client precedence/fallback; website and direct GET/POST routing');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
