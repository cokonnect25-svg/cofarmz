# CoFarmz web and Android app

The Next.js application in `apps/web` is the shared source for both the website and the Capacitor Android app. Capacitor is only the Android wrapper; browser-safe fallbacks in the app keep camera, location, sharing, authentication, and navigation usable on the web.

## Run as a website

From this folder:

```powershell
npm --prefix apps/web install
Copy-Item apps/web/.env.example apps/web/.env.local
npm run dev:web
```

Open `http://localhost:3000`. The `dev:web` command listens on all network interfaces, so another device on the same network can use `http://YOUR_COMPUTER_IP:3000`.

Edit `apps/web/.env.local` with the real database, authentication, Firebase, Google, and upload values. Do not commit that file.

## Production website

```powershell
npm run build:web
npm start
```

The production server listens on port `8080`. The Dockerfile and Cloud Build configuration deploy this full Next.js server, including API routes. `netlify.toml` also configures the repository for a Netlify Next.js deployment; add the values from `.env.example` in the hosting provider's environment settings.

Because this app contains server API routes, deploy it as a Next.js server. Do not upload the Capacitor `out` folder as the website.

## Android

The existing Android commands remain available from the same root:

```powershell
npm run android:build
npm run android:sync
npm run android:run
```

The Android wrapper continues to use `apps/web/capacitor.config.ts` and `apps/web/android`.

## Deploy the website to Google Cloud Run

The root `cloudbuild.yaml` builds the full Next.js website and deploys it to the public `cofarmz-backend` Cloud Run service in `asia-south1`.

Connect this repository to a Cloud Build trigger and use:

```text
Configuration type: Cloud Build configuration file
Location: Repository
Cloud Build file: /cloudbuild.yaml
```

Alternatively, from a computer with the Google Cloud CLI installed and authenticated:

```powershell
gcloud builds submit --config cloudbuild.yaml --project cofarmz-492212
```

The service needs the server-only variables listed in `apps/web/.env.example`, especially `DATABASE_URL`, `BETTER_AUTH_SECRET`, Google credentials, upload credentials, and mail credentials. Configure sensitive values as Cloud Run environment variables or Secret Manager references; do not add them to `cloudbuild.yaml`.


After deployment, check:

```text
Website: https://cofarmz-backend-866114557322.asia-south1.run.app
Health:  https://cofarmz-backend-866114557322.asia-south1.run.app/api/ping
```
