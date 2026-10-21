# CoFarmz WhatsApp notifications

## Repository inspection and scope

CoFarmz is a Next.js 15 application with App Router API routes, PostgreSQL (`app/api/utils/sql.ts`), Better Auth plus signed mobile sessions (`lib/fpo-access.ts`), and Capacitor Android. `Dockerfile` and `cloudbuild-backend.yaml` build/deploy the `cofarmz-backend` Cloud Run service. No unrelated service was modified.

FCM remains in `app/api/utils/push.ts`: GoogleAuth obtains server credentials, `push_tokens` stores enabled per-device registrations, and FCM HTTP v1 delivers notification/data payloads. `NativePushNotifications.tsx` registers devices. Calls originate in messages, reservations, follows, posts, reels, machinery, announcements, social activity, and crop routes. `lib/crop-yield-reminders.ts` and `scripts/crop-yield-reminders.cjs` implement yield reminder scheduling; announcements have a secret-protected process endpoint.

`app/api/utils/crop-match-push.ts` is reused for WhatsApp match events on both crop creation and relevant crop updates. Existing FCM calls execute alongside independent, contained WhatsApp enqueue calls. FCM payloads and its sender are untouched by this integration. Previous mobile push fixes remain in the working tree.

Profile/crop-addition suggestions previously existed only in the GET notification feed (`app/api/notifications/route.ts`), so no existing background trigger could be reused. `profile-reminder-needs.ts` shares its missing-location/missing-crops predicates with the new scheduled sweep. The sweep covers farmer/buyer accounts, treating missing coordinates as profile completion and zero crops as crop addition; it is not a general assessment of every profile field. Existing supplier/equipment suggestions and crop-yield reminders remain outside WhatsApp scope. No messages are sent from the GET feed.

Registered numbers are stored in `user.phone`; profile editing normalizes Indian numbers and tracks phone verification. WhatsApp consent is a separate opt-in row, tied to the exact normalized registered number. A changed phone fails eligibility until the user saves fresh consent. Ten-digit numbers are interpreted as Indian (+91); international numbers must include their country code.

## Files and database setup

- `lib/whatsapp-core.ts`: Meta template transport, phone normalization, webhook signature verification.
- `lib/whatsapp.ts`: independent outbox, idempotency, reminder sweep and controlled dispatch.
- `app/api/whatsapp/preferences`: authenticated GET/PUT for the current user only.
- `app/api/whatsapp/webhook`: Meta GET challenge, signed POST delivery statuses and STOP requests.
- `app/api/whatsapp/process`: secret-protected scheduled POST sweep/dispatch.
- Settings: separate WhatsApp consent, category switches and opt-out; FCM preference controls are not changed.
- `/whatsapp?type=...`: allowlisted destination router with login return; `/open` and existing Capacitor app-link handling are reused.

Review and apply `migrations/20261020_whatsapp_notifications.sql` through your approved migration process before enabling. It adds `whatsapp_preferences`, `whatsapp_outbox`, `whatsapp_status_events`, constraints and indexes. It does not enroll existing users or alter their FCM tokens. No migration has been applied by this implementation. Back up and stage-test before production application.

## Server-only runtime configuration

See `whatsapp.env.example`. Do not put any of these secrets in NEXT_PUBLIC variables, build arguments, source control, browser code, or logs.

Use Google Secret Manager versions mounted into Cloud Run runtime environment variables using the existing service account. Grant that account secretAccessor only on required secrets. Store `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_SCHEDULER_SECRET` as secrets. Configure phone ID, a currently supported explicit Graph version, language, template names, caps and enablement flags as runtime environment variables. The implementation deliberately has no default Graph version. Never paste secret values into deployment command history. The checked-in Cloud Build pipeline has not been changed and no deployment was performed.

`WHATSAPP_ENABLED=false` is the default kill switch. With it enabled, `WHATSAPP_DRY_RUN` defaults to true: queued eligible rows are counted, no Meta calls are made, and they remain pending for later review. Dry-run still writes queue metadata; it is not a database-free mode. A blank `WHATSAPP_ROLLOUT_USER_IDS` sends to nobody; use explicit comma-separated internal user IDs, never `*`. All three template names and `WHATSAPP_TEMPLATES_APPROVED=true` are required for dispatch. This flag records the operator's approval verification; the application does not query Meta to verify current template approval. Template language must match the approved language exactly.

## Meta setup and templates

1. Create/connect a Meta business portfolio, Meta developer app with WhatsApp, WABA and business sending number. Complete Meta-required business/number verification and billing. Initially use Meta test assets and explicitly added test recipients.
2. Provision an appropriate system-user token with WhatsApp messaging permission for that WABA. Store it and the Meta app secret in Secret Manager; plan rotation and expiration monitoring.
3. Submit the following separate templates in WhatsApp Manager. These are proposed templates, not approved templates. They have static text and one static URL CTA, no variables (the sender deliberately supplies no body/button parameters). Add the exact static HTTPS URL during submission. Include ?Reply STOP to stop WhatsApp messages.? in each body.

| Purpose / suggested name | Proposed body | CTA | Category |
| --- | --- | --- | --- |
| `cofarmz_profile_completion` | Complete your CoFarmz profile location to help relevant farmers and buyers discover you. Reply STOP to stop WhatsApp messages. | Complete Profile | Marketing |
| `cofarmz_crop_addition` | Add the crops you grow or want to buy on CoFarmz to discover relevant connections. Reply STOP to stop WhatsApp messages. | Add Crops | Marketing |
| `cofarmz_nearby_matches` | New crop matches are available on CoFarmz. Open the app to view your connections. Reply STOP to stop WhatsApp messages. | View Matches | Marketing by default |

CTA URLs, using the deployed CoFarmz origin:

- `/open?path=/whatsapp&type=profile_completion`
- `/open?path=/whatsapp&type=crop_addition`
- `/open?path=/whatsapp&type=nearby_matches`

Only submit a Utility match template if Meta's current criteria support the actual expected user-specific update and Meta approves it as Utility. Do not relabel engagement reminders to reduce costs. Template names/languages in runtime configuration must match Meta exactly. Static URLs must use the deployed origin; changing the destination/domain requires template review where Meta requires it.

4. Set the HTTPS webhook callback to `/api/whatsapp/webhook` with the configured verification token, subscribe the WABA/app to `messages`, and confirm incoming messages and delivery status callbacks for the configured phone number ID. POST signatures use the Meta app secret and raw request body. Unknown business-number events are ignored; unsigned bodies are rejected.
5. Confirm WhatsApp consent using Settings on a controlled test account. STOP, UNSUBSCRIBE, CANCEL, OPT OUT and STOP_WHATSAPP inbound replies disable that number and pending messages. Re-enablement requires fresh in-app confirmation. Do not import consent from registration or FCM tokens.

Policy/reference links: https://whatsappbusiness.com/policy/ ; https://whatsappbusiness.com/products/platform-pricing/ ; https://developers.facebook.com/docs/whatsapp/cloud-api/ ; https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/ . Check current Meta requirements when registering and approving templates. Marketing messages incur applicable Meta charges.

## Scheduling and rollout

Create a scheduled HTTPS POST to `/api/whatsapp/process`, initially every 15 minutes, with `x-scheduler-secret` populated from the scheduler secret. Use HTTPS and a private secret-delivery setup; do not put the secret in the URL. Cloud Run must be reachable by Meta for webhook delivery. Configure request timeout to cover a batch of at most 10 messages with 15-second outbound timeouts (for example 240 seconds), and monitor non-2xx process responses. No scheduler was created.

Start disabled, migrate in staging, run mock tests, configure Meta test assets/approved templates, verify signed webhooks and opt-out, then enable dry-run for an internal allowlist. Review counts and queue records. Only after explicit approval should an operator set dry-run false and expand the allowlist. No production deployment, database operation or real message was performed here.

Costs are bounded by a default 20 accepted/ambiguous messages per rolling 24 hours globally (`WHATSAPP_DAILY_CAP`, clamped 1?100) and at most one per user per seven days across categories. Every dispatch rechecks consent, category, number and completed reminder conditions. Locks serialize workers and opt-out with dispatch. An already accepted message cannot be recalled by an opt-out.

## Reliability and operations

Unique `(user_id,category,event_key)` prevents duplicate events across repeated enqueue attempts. Reminder event keys are lifetime keys: an unchanged incomplete profile/no-crops state is messaged at most once, not daily. Match keys hash the crop and sorted distinct matched IDs, so re-saving an unchanged list does not generate a new event; counterpart updates are keyed by source user/crop. Frequencies may defer otherwise distinct events.

Only explicit throttling/transient rejection is retried, up to three attempts, with Retry-After when available or a five-minute delay. Network loss, 5xx or an unidentifiable successful response is `unknown`, never automatically resent, because Meta's messages endpoint does not provide a send idempotency key. Dispatch claims are committed before the API call; interrupted workers quarantine claims after ten minutes. This favors avoiding duplicate charged messages and can skip a notification after an interrupted pre-send claim. Investigate unknown rows manually before any replay. Permanent API failures are terminal; configuration failures wait an hour. Disabling the integration stops queue dispatch.

Delivery callbacks are signature-checked, deduplicated into status events, and reconciled to outbox rows on each worker pass, including callbacks arriving before send commit. Delivered/read statuses are never downgraded by older callbacks. Failed delivery is tracked without automatically resending. Logs use generic failures or numeric error codes, not tokens, phone numbers, API bodies or message text. Restrict database access; preferences contain phone numbers. Define a retention/archive policy for old outbox/status rows before high-volume rollout; no destructive purge is included.

Useful operator checks: aggregate outbox counts by status/category/error_code, accepted/delivered/read rates, unknown dispatches, scheduler failures and daily usage. Do not expose these tables through public APIs.

## Validation and limits

Run `npm run test:whatsapp`. It uses mocked HTTP and an in-memory SQL adapter: success payloads, API rejection/throttling, timeout quarantine, duplicate prevention, opt-out, changed number, category preference, allowlist, dry-run, frequency caps, retry exhaustion, webhook signatures/STOP, CTA routing and FCM failure isolation. It never contacts Meta or a database. These are not PostgreSQL transaction/concurrency integration tests. Stage-test migration syntax, actual concurrency/locking, webhook ordering, all login methods, Android installed/uninstalled fallback and Meta delivery before rollout.

Repository TypeScript checking currently reports pre-existing errors in admin/profile, digital-fpos conversations, machinery-list, nearby-farmers, rent-machinery and top-picks. No errors were reported in the new WhatsApp files. ESLint has no existing configuration. Production approval, real credentials, verified template approvals, migration application, signed live callbacks and device tests remain external prerequisites.
