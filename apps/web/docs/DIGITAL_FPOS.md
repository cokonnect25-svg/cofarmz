# District Digital FPO implementation and rollout

## Architecture and scope

The production schema was inspected read-only before implementation. It has Better Auth's `user`, `session`, and `roles`, direct `messages`, `announcements`, `push_tokens`, and social activity notifications. There were no FPO organization, community, group, or membership tables. The `fpo` user role represents an individual account; it is not a district organization and is not repurposed.

The new relationship is `fpo_districts -> digital_fpos -> farmer_groups -> farmer_fpo_assignments`. The assignment row **is** the active group membership; there is no duplicate membership table. A farmer's primary key prevents multiple district memberships. FPO/group names are generated for display; UUIDs and district IDs are the relationships. Group name/state/district are obtained by joining the FPO and catalogue, not copied into multiple tables.

Existing announcements are extended with nullable `group_id`. Null retains global announcement behavior. Scoped announcements provide the group message feed, in-app notifications, unread counts, and push. The existing person-to-person messaging system is unchanged; the application has no group chat to extend.

`superadmin` is the existing production role spelling. Server authorization also recognizes `super_admin`, but not the ordinary `admin` or `fpo` role for management. Ordinary `admin` accounts have read-only review access to all FPO profiles, group members and message history, including inactive FPOs and expired/scheduled announcements. Self-registration can no longer choose an admin role. Authorization uses Better Auth's verified session and a current database role lookup, never a caller's `userId`, `adminId`, or `x-user-id` as proof of identity.

## Database migration

Migration files: `migrations/20260923_digital_fpos.sql` and `migrations/20260923_fpo_admin_review.sql`. The migration command runs both. The second permits and registers a distinct `admin` role, without promoting any account. Existing trusted account provisioning must explicitly assign that role; signup cannot select it.

Adds catalogue, FPO, group, assignment and message-read tables; adds `user.district_id` and `announcements.group_id`; creates foreign keys, normalized location uniqueness, unique FPO-per-district/group-per-FPO constraints, membership consistency trigger, access predicate and query indexes.

The migration is additive and rerunnable. It does **not** create Digital FPOs, promote users, reassign existing farmers, or change the production database until explicitly run.

From `apps/web`, with the target `DATABASE_URL` configured:

```sh
npm run migrate:fpo -- --apply
```

Review the migration and back up the target database using the normal deployment process first. Apply it **before deploying the updated application**: protected announcement queries and profile writes require the new columns/functions. Never run the old complete schema scripts to install this feature; those scripts contain table drops.

The migration script imports `data/fpo-districts.json`: a dated snapshot of 784 district entries across 36 States/UTs from NIC's Integrated Government Online Directory, downloaded on 2026-09-23. Every entry includes its official source URL. Counts were validated against the directory's per-state result count. This reflects the directory snapshot, not a guarantee that all recent administrative boundary changes have propagated. Unknown or differently named geocoder districts remain pending rather than guessed.

To refresh the local catalogue from the official source, review the resulting data diff, and import new entries:

```sh
python scripts/refresh-fpo-districts.py
npm run migrate:fpo -- --apply
```

Imports are additive: existing IDs/assignments are preserved. District renames, splits and mergers need reviewed data migrations, not automatic deletion. Source: https://igod.gov.in/sg/states

## Assignment behavior

- New farmer setup requires State and District validated against the server catalogue. Role confirmation, saved location and assignment are one transaction.
- An active configured FPO assigns its corresponding group. Missing FPO means `pending_fpo`; inactive FPO means `inactive_fpo`; no resolvable location means `pending_location` with a reason.
- Farmers never create FPOs automatically. Only Super Admin creation inserts the FPO and its single group atomically.
- Explicit profile State/District changes are validated and authoritative. Location-only changes resolve coordinates first, then address when coordinates are unavailable. The existing `location` column is reused as address; profile writes also accept `address` as an alias. Editing only address clears old coordinates so a stale coordinate pair cannot override the new address.
- Updating location replaces the single assignment in the same transaction as the profile. Failure rolls both back. If the new district has no active FPO, old group access is revoked and the farmer becomes pending.
- Existing-farmer processing uses coordinates first, otherwise address. A provider failure or ambiguous/unknown district is recorded as pending. Existing validated registration/manual/profile district selections are preserved on reruns.
- Processing snapshots and row locks avoid overwriting a profile changed during geocoding. Failed/conflicting records appear in the batch report and can be retried.
- Role-change approval updates assignment in its transaction. Users who cease being farmers lose access. Deactivation blocks reads/push immediately while retaining the association; reactivation restores eligible members. Processing an inactive membership may mark it pending, in which case rerun processing after activation.

## APIs

| Route | Methods | Purpose / access |
|---|---|---|
| `/api/fpo-locations` | GET | Public State/District selector catalogue |
| `/api/digital-fpos` | GET | Signed-in discovery, own assignment, manager capability |
| `/api/digital-fpos` | POST, PATCH | Super Admin create or activate/deactivate |
| `/api/digital-fpos/:id` | GET | Signed-in permitted public profile; no private content or membership mutation |
| `/api/digital-fpos/messages` | GET, POST | Own active group feed/unread count; mark own accessible updates read |
| `/api/admin/fpo/messages` | GET | Admin/Super Admin read-only group history; required `group`, optional `offset`; 50 messages per page |
| `/api/admin/fpo` | GET | Admin/Super Admin farmer list, `pending=true`, optional `group`, cursor `after` |
| `/api/admin/fpo` | POST | Super Admin `action: assign` or `action: process` |
| `/api/users/profile` | POST, PUT | Secured role completion and automatic transactional assignment |
| `/api/users/:id` | PUT | Delegates to the same protected profile update |
| `/api/admin/announcements` | GET, POST, DELETE | Membership-filtered reads; Super Admin writes; optional `groupId` |
| `/api/admin/announcements/process` | POST | Existing scheduler secret, now membership-scoped delivery |
| `/api/notifications` | GET | Authenticated recipient and group-filtered inbox |
| `/api/push-tokens` | POST, DELETE | Session-owned token registration/revocation |
| `/api/role-change-requests` | GET, POST, PATCH | Session validation and transactional assignment maintenance |

Administrative assignment body: `{ "action":"assign", "farmer_id":"...", "state":"Tamil Nadu", "district":"Madurai" }`. IDs/status supplied by farmers are rejected; all FPO/group IDs are derived from the validated catalogue selection. Mutating protected requests require JSON content type.

Processing body: `{ "action":"process", "after":"", "dry_run":true }`. It handles at most ten farmers and returns `results` plus `next`. Preview is the default. Send `dry_run:false` to apply the batch and pass `next` as `after` until it is null. Retry reported failures; a cursor advances past them so one failure does not block everyone.

## UI and Super Admin steps

`/signup` and `/select-role` have dependent selectors. New accounts remain in role setup until their role is confirmed. OAuth users complete the same setup. Farmer profiles include “My Digital FPO” with a link to `/digital-fpos`.

`/digital-fpos` contains own association, district update, private group updates/read count, discoverable FPO profiles, a read-only Admin group overview on each selected FPO, and a separate Super Admin management section. The Super Admin dashboard links to it; ordinary admins visiting that dashboard are directed to the FPO page. Super Admin can create FPOs, open profiles, activate/deactivate, view farmer counts and group members, page through pending farmers, correct assignments, preview/process existing farmers, and post group announcements.

Rollout order:

1. Apply schema/catalogue migration.
2. Deploy and configure authentication URLs on both hosts (below).
3. Sign in with an existing authorized Super Admin account. No admin is seeded by this feature.
4. Create Digital FPOs for the districts you support.
5. Configure a geocoder suitable for the volume; preview batches and review pending reasons.
6. Process batches, inspecting failures. Rerun safely after corrections or creation of missing FPOs.

## Communication access

The shared PostgreSQL predicate `can_receive_fpo_message(user_id, group_id)` requires a current farmer role, assigned membership, matching user/assignment/FPO district, and active FPO. The feed, inbox and announcement query use it. Discovery never calls assignment. The separate administrative review endpoint authorizes Admin/Super Admin sessions and can view every group without enrollment. It does not alter farmer access, unread counts, push recipients, or membership. No client query parameter can grant membership.

Immediate and scheduled push use the same filtered recipient service. It rechecks and locks membership/FPO while submitting each recipient, preventing concurrent reassignment/deactivation from changing eligibility mid-submit. Notifications contain only a generic update notice, with no group name/private body, because an already-delivered OS notification cannot be recalled after a move. Opening the app fetches the content with a new membership check. Push failure leaves the existing announcement scheduler retry behavior in place. Global announcements retain their existing global delivery.

## Environment and deployment

Existing variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, Firebase/FCM service credentials, and `ANNOUNCEMENT_SCHEDULER_SECRET`. No new Firebase key is needed for FPOs.

Optional **server-only** geocoder configuration:

- `FPO_GEOCODER_URL`: HTTPS base URL of an approved Nominatim-compatible service with `/reverse` and `/search`. Configure a service whose permitted request rate supports the ten-record sequential batches. Do not point bulk processing at the public Nominatim service without checking its policy.
- `FPO_GEOCODER_TOKEN`: optional bearer token for that service.

No provider configured means coordinate/address-only farmers remain pending with an explicit reason; explicit validated State/District selection still works. Geocoding is never performed in the browser or silently sent to an unconfigured third party.

Browser auth now uses the current website origin, matching the protected APIs. Configure **Netlify** `BETTER_AUTH_URL=https://cofarmz.com` and **Cloud Run** its own service URL. Keep `NEXT_PUBLIC_BACKEND_URL` pointing to Cloud Run for the native app. Ensure Google OAuth permits the applicable `/api/auth/callback/google` redirect URL on each host. Users with a session only on the old Cloud Run origin may need to sign in again on `cofarmz.com`; cookies cannot be shared between unrelated domains. Both deployments must use the intended database and auth configuration.

## Validation and limitations

`npm run test:fpo` executes real PostgreSQL integration tests against localhost port 55439 by default (override `FPO_TEST_DATABASE_URL` with a loopback URL). It creates and drops only the `fpo_integration` schema; do not point it at a shared development instance using that schema. Better Auth session lookup, geocoder, and FCM are fixtures; route authorization and assignment/delivery SQL are real. These tests do not certify Google OAuth, provider accuracy, or live FCM delivery.

The test suite covers 29 scenarios: registration/validation; both resolution paths; missing location and later updates; dry runs; reruns; uniqueness; discovery without membership; cross-group feed/unread/push isolation; admin/identity spoofing; district moves; deactivation/reactivation; missing FPO; invalid coordinates; rollback; scheduled delivery; unchanged-location profile edits; admin visibility, read-only authorization, member isolation and historical-message pagination.

Production build completed successfully. Scoped FPO lint completed with no errors. Full project type checking has pre-existing failures in generated Android artifacts and unrelated pages (MapPicker, machinery-list, nearby-farmers, rent-machinery, top-picks); no diagnostics were reported for the changed FPO/API/auth files. The existing Next config ignores type/lint errors during build, so a passing build is not presented as a passing full type check. In-app browser verification was unavailable; visual and real-auth end-to-end checks remain to be performed before production rollout.

## Files

New: `migrations/20260923_digital_fpos.sql`, `data/fpo-districts.json`, `lib/fpo-{access,location,assignment,announcements}.ts`, `components/{DistrictSelect,MyDigitalFpo}.tsx`, `app/digital-fpos/page.tsx`, API routes listed above under `digital-fpos`, `admin/fpo`, `fpo-locations`, `scripts/{inspect-fpo-schema.cjs,migrate-fpos.cjs,refresh-fpo-districts.py}`, `tests/{fpo.integration.cjs,eslint.fpo.cjs}`, and this runbook.

Updated: profile/announcement/notification/push-token/role-change routes, push helper, signup/select-role/profile/admin pages, `RoleSelectionGuard`, `useAuth`, auth client/trusted origins, package scripts and local verification ignores. Pre-existing edits to root `cloudbuild.yaml` and `README.md` were left untouched.
