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

## Daily mobile matches and profile reminders

The existing `npm run remind:yield` worker now also sends the closest farmer/buyer crop match and missing-profile-listing reminders. `npm run remind:yield:once` runs all three categories once. Deliveries are deduplicated per user, reminder kind, and Asia/Kolkata calendar day. Failed deliveries and users without registered devices remain retryable. Existing immediate crop-addition match pushes are unchanged.

For Cloud Run, deploy the updated backend and configure a scheduler to POST `/api/notifications/process` hourly with header `x-scheduler-secret` matching the backend runtime secret `NOTIFICATION_SCHEDULER_SECRET`. The endpoint returns 503 until that secret is configured and 401 for an incorrect secret. Use either this scheduled endpoint or the supervised worker. `npm start` alone does not run reminder sweeps. An hourly schedule allows retry after a phone registers later in the day; accepted reminders are sent once daily.

No new APK is required for these backend notification triggers. Firebase credentials and an enabled device push token are required, as for message alerts. Profile reminders stop once crops/location or the supplier's required listings are present. The daily match alert selects the nearest opposite-role user with a matching crop.

Validation: `node tests/daily-mobile-reminders.cjs` checks reminder categories, delivery retries, and deduplication with mocked SQL/FCM. Real-device delivery still needs verification after backend deployment and scheduler configuration.

## Catchy copy and evening exploration

Daily copy rotates automatically using user ID and the India calendar day. No AI subscription or external text service is required. Match alerts use actual matching crop/profile information; copy never invents demand, discounts, or unread activity. Immediate crop-addition match alerts also use the friendlier wording.

The combined worker/endpoint runs between 09:00 and 21:00 Asia/Kolkata. Before 18:00 it sends at most one discovery/profile reminder per user per day. From 18:00 to 20:59 it sends one rotating evening invitation, such as “Seeds in the soil. Ideas on CoFarmz.”, linking to `/reels`. Yield reminders remain a separate daily alert. Messages and other transactional alerts keep their existing delivery behavior. Keep the scheduler hourly so both windows are covered. The standalone yield-only function is unchanged with respect to delivery time.

Android now has a dedicated white sprout notification icon configured through Firebase manifest metadata. Rebuild and distribute the APK to apply this icon; the copy and scheduling changes need backend deployment. This is a simplified farm symbol, not a full-color wordmark. Firebase default icon configuration follows https://firebase.google.com/docs/cloud-messaging/android/get-started . No production deployment, scheduler configuration, or device-delivery verification was performed by this code change.
