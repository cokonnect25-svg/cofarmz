# Website API proxy and private database

The repository is deployed to both Netlify (website) and Cloud Run (backend).
Netlify's root `netlify.toml` proxies `/api/*` to Cloud Run with a forced 200
rewrite. The browser continues using `https://cofarmz.com/api/...`, including
OAuth callbacks and session requests. Cloud Run executes the API handlers and
connects to PostgreSQL through its existing private network connection.

This includes protected APIs, not just authentication: they also need database
access. No Android source, Google ID-token endpoint, or native API URL changes
are required. The proxy does not apply to local development or mobile builds.

## Production rollout

1. In Google Cloud Console, open the OAuth Web client actually selected by
   `lib/auth.ts` (`GOOGLE_CLIENT_ID_MOBILE` takes precedence when configured).
   Add `https://cofarmz.com/api/auth/callback/google` to its authorized redirect
   URIs. Keep existing redirect URIs and Android credentials.
2. Leave all existing environment variables unchanged, including
   `BETTER_AUTH_URL`, `FRONTEND_URL`, and `NEXT_PUBLIC_BACKEND_URL`. Deploy the
   updated backend code to Cloud Run first. Netlify adds the fixed
   `X-Cofarmz-Website: cofarmz.com` header to proxied requests. The auth route
   selects a website auth context with base URL `https://cofarmz.com` for those
   requests, including callback GETs without an Origin header. Direct requests
   retain the original auth context and configured Cloud Run base URL. Both
   contexts share a database pool, secret, cookie prefix, and Google credentials.
   The header selects a fixed public URL; it does not grant access or bypass
   authentication. Unknown header values use the original context.
3. Deploy the website with the root `netlify.toml` in this repository. Confirm
   the Netlify build log reports that file as the active configuration and the
   `/api/*` proxy is present in the generated routing configuration. The backend
   must already contain the same API versions as the website; deploy matching
   backend code first if needed.
4. Sign in on `https://cofarmz.com` in a fresh browser session. The social sign-in
   response should start Google OAuth with the website callback URI. The callback
   must return through Netlify and set host-only session cookies on `cofarmz.com`.
   Check refresh, `/api/auth/get-session`, a protected API, and logout. Confirm
   responses carrying session data or cookies are not cached.
5. Test an existing Android installation: Google login, restore session after
   restart, a protected API, and logout. Native Google login still calls Cloud Run
   directly at `/api/auth/mobile/google-login`; no APK rebuild is required.

Do not change the database to a public IP to make Netlify reach it. Do not change
the browser auth client to call the unrelated Cloud Run domain directly: the
same-origin proxy keeps the website independent of third-party cookie support.
Existing Cloud Run-only browser cookies will not appear on the website domain;
those users may need to sign in again. Use cofarmz.com as the canonical login host;
www and Netlify preview hosts have separate cookie scopes.

## Verification and rollback

The repository change alone does not configure Google or Cloud Run and does not
prove production login works. Complete the live checks above after deployment.
If rollback is needed, restore the previous Netlify and Cloud Run deployments.
No environment variable changes are needed for rollout or rollback. Keep the added Google
callback URI while investigating; it need not replace existing entries.
