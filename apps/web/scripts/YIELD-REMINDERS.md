# Taluk membership and overdue yield reminders

From apps/web after deploying this code:

```powershell
npm run migrate:fpo -- --apply
npm run auto:fpo:once
npm run remind:yield
```

The migration removes existing district group tags while preserving district FPOs and saved location data. The assignment sweep assigns eligible farmers to taluk/mandal FPOs. Farmers with unresolved taluks remain pending and can select their taluk in Profile.

Keep `remind:yield` running as a supervised background service. It checks hourly, groups overdue crops into one reminder per farmer per India calendar day, and retries failed push deliveries. Alternatively schedule `npm run remind:yield:once` daily using your hosting scheduler. Do not use both modes unnecessarily. Use the existing DATABASE_URL and Firebase server credentials configured for push notifications. Devices need an enabled push token; in-app reminders are available without one.

Dates before today in Asia/Kolkata are overdue. Today and future dates are excluded. Updating or deleting overdue crops stops further reminders. In-app notifications link to Current crops in Profile. The job creates its daily delivery ledger automatically and never sends reminders to non-farmer accounts.

Validation: `node tests/taluk-only-yield.cjs` uses only an isolated local PostgreSQL server at 127.0.0.1:55439 and its own temporary schema.
