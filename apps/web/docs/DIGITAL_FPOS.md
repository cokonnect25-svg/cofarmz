# District Digital FPO implementation and rollout

## Architecture and scope

The production schema was inspected read-only before implementation. It has Better Auth's `user`, `session`, and `roles`, direct `messages`, `announcements`, `push_tokens`, and social activity notifications. There were no FPO organization, community, group, or membership tables. The `fpo` user role represents an individual account; it is not a district organization and is not repurposed.

The new relationship is `fpo_districts -> digital_fpos -> farmer_groups -> farmer_fpo_assignments`. The assignment row **is** the active group membership; there is no duplicate membership table. A farmer's primary key prevents multiple district memberships. FPO/group names are generated for display; UUIDs and district IDs are the relationships. Group name/state/district are obtained by joining the FPO and catalogue, not copied into multiple tables.

Existing announcements are extended with nullable `group_id`. Null retains global announcement behavior. Scoped announcements provide the group message feed, in-app notifications, unread counts, and push. The existing person-to-person messaging system is unchanged; the application has no group chat to extend.

`superadmin` is the existing production role spelling. Server authorization also recognizes `super_admin`, and ordinary `admin` accounts can create Digital FPOs. The `fpo` role cannot create them. Ordinary `admin` accounts also have review access to all FPO profiles, group members and message history, including inactive FPOs and expired/scheduled announcements. Self-registration can no longer choose an admin role. Authorization uses Better Auth's verified session and a current database role lookup, never a caller's `userId`, `adminId`, or `x-user-id` as proof of identity.

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

### Taluk, tehsil and mandal addresses

Saved addresses can now resolve through reviewed subdistrict-to-district mappings. For example, `omalur ,tamilnadu` resolves to Salem, Tamil Nadu. Full State names written without spaces (such as `Tamilnadu`) are accepted. Subdistrict inference requires a State; partial place names, multiple parent districts, and conflicting district/taluk information remain pending. An explicitly saved district ID remains authoritative.

Apply `npm run migrate:fpo -- --apply` **before deploying this change**. It installs `migrations/20260925_fpo_subdistricts.sql` and imports `data/fpo-subdistricts.json`. Then preview and rerun the existing saved-profile backfill to tag previously unresolved farmers. The migration itself does not change profiles or memberships.

The small `fpo-subdistricts.json` mapping retains the 14 taluks listed by the [Salem district revenue administration](https://salem.nic.in/about-district/administrative-setup/revenue-administration/), retrieved 2026-09-25. The separate nationwide directory below extends this across all States/UTs. Include duplicate names in all applicable parent districts rather than choosing one arbitrarily. Unknown spellings remain unresolved unless a reviewed alias is imported or the configured geocoder resolves them.

Imports are additive. Boundary changes and removed/renamed subdistricts require reviewed database corrections; merely removing a JSON entry does not remove its database mapping.

### Nationwide subdistricts, villages and urban localities

`data/fpo-localities.jsonl.gz` contains a **31 May 2026** LGD snapshot with **861,077 name records**, including local-language aliases: 7,090 subdistrict records, 848,868 village-name records and 5,119 urban-local-body parent/name records. These are not counts of unique settlements. Parent mapping covers **all 36 States/UTs and all 784 districts** in the existing catalogue. The JSON manifest records coverage, raw-file hashes, compressed-file checksum and source links.

The originating source is the [Local Government Directory](https://lgdirectory.gov.in/downloadDirectory.do). The dated exports were downloaded from the [public LGD archive](https://ramseraph.github.io/opendata/lgd/), not directly from a live government API. Archives are `subdistricts.May2026.7z`, `villages.May2026.7z` and `statewise_ulbs_coverage.May2026.7z` under the manifest's archive URL. Extract only the named `31May2026.csv` files. Reviewed alternate Odisha district spellings and the merged Dadra/Nagar Haveli/Daman/Diu State name are reconciled explicitly; no fuzzy district mapping is performed.

Deployment order, from `apps/web`:

```sh
npm run migrate:fpo -- --apply
npm run import:fpo-localities
npm run import:fpo-localities -- --apply
# Deploy the application, then preview and process existing farmers:
npm run backfill:fpo
npm run backfill:fpo -- --apply
```

Migration adds `fpo_localities` and its indexed lookup; **apply it before deploying**. The default import is offline validation only. Applying the import transactionally replaces only the `lgd:` directory source; concurrent imports serialize, and a missing database parent rolls the replacement back. Existing custom subdistrict mappings remain. This operation does not change farmer profiles, FPOs or memberships. Memberships change only through the existing assignment flow. The compressed data is used by the import script, not downloaded by browser clients.

Matching requires a recognized State plus an exact whole-name locality, taluk/tehsil/mandal, or district. A repeated village name remains pending unless another matching district/taluk/locality narrows it to one district. Conflicting evidence stays pending. Place names that occur only inside the State name do not count as separate district evidence. Combining marks in native-script names are preserved; the State must still match its catalogue English name (spaced or unspaced). Explicit saved district IDs continue to take precedence.

Each address queries only indexed matching phrases within its State. The service does not scan or load the full directory for each farmer. Names missing from the directory can use the configured address geocoder; no unconfigured public geocoder receives profile data.

Coverage means a directory is available across all States/UTs, **not that every street, colony, informal hamlet, landmark, spelling or recent boundary change is covered**. This is a dated snapshot; review subsequent changes before replacing it. PIN codes alone and nearby GPS positions are not district evidence.

Rebuild from reviewed downloaded CSVs using `python scripts/build-fpo-localities.py --input .fpo-location-download --date 31May2026`. Review the manifest/data diff before importing a replacement. The builder rejects unknown parent districts and missing State/UT coverage. For a different archive month, verify/update the archive-base provenance in the builder.

`npm run test:fpo-localities` imports the complete snapshot into the dedicated local `fpo_localities_integration` schema, checks State/UT lookups, reruns the import, and verifies rollback on an unmatched parent. It refuses non-loopback databases and drops only its own test schema.

### Create every catalogue district and assign farmers

Super Admin can open `/digital-fpos` and select **Create all district FPOs and assign farmers**. This creates a Digital FPO and group for every imported catalogue district, including districts without farmers, then automatically runs saved-profile assignment across all farmer batches. Existing FPO IDs, names, creators and activation status are preserved. Repeated and concurrent provisioning cannot create duplicate FPOs or groups.

Keep the page open until processing completes. Stopping or closing the page retains completed work; rerun the operation to process everyone again. Creation is transactional; each farmer assignment is a separate retryable transaction. Errors and unresolved locations are reported separately. Missing or ambiguous locations remain pending, and inactive FPOs remain inactive. No announcements are sent.

New registrations and explicit profile district changes continue to assign automatically to the provisioned active FPO. After importing newly added catalogue districts, rerun this operation to create their FPOs. This is an admin-triggered workflow, not a background scheduler.

The Super Admin-only `POST /api/admin/fpo` action `{ "action":"provision" }` creates missing catalogue FPOs/groups and returns `districts`, `created`, `existing`, and `groups_created`. The UI then invokes the existing paginated `process` action with `dry_run:false` until finished. Provisioning alone does not process memberships; API clients must also run those batches. The existing preview checks current FPOs without provisioning new ones.

- Membership is based on the saved **profile State/District** (`user.district_id`), not current GPS, map searches, or Nearby results. It remains stable until an explicit profile State/District update or admin correction.
- New farmer setup requires a validated State and District. Existing farmers can select both in the profile edit form; the profile read/update responses include their saved selection.
- Existing profiles without a district ID are matched using their saved `location` text against the district catalogue. Full district and state names must match, or the entire address must be a unique district name. Partial names and ambiguous matches remain pending. No nearest-district guesses or device-coordinate fallback are used.
- If configured, `FPO_GEOCODER_URL` can resolve saved addresses that cannot be matched locally. It uses address search only. No location is sent to an unconfigured public service.
- Saved district IDs are preserved during repeated processing, even without an existing assignment row. A coordinate-only update never changes membership. An address-only edit does not override an existing saved district: farmers must explicitly change State/District when moving home districts.
- An active configured FPO assigns its corresponding group. Missing FPO means `pending_fpo`; inactive FPO means `inactive_fpo`; unresolved profile address means `pending_location` with a reason.
- Only Admin/Super Admin can create Digital FPOs. Creation inserts one FPO/group and enrolls farmers whose saved district already matches, in the same transaction. It does not guess unresolved addresses or create other districts' FPOs.
- Explicit State/District changes replace the single membership atomically. Old group access is revoked. Transactions roll back both profile and assignment on failure.
- Backfill rechecks and locks each profile before writing, rejecting concurrent profile changes. Failures can be retried; reruns cannot create duplicate memberships.
- Role changes maintain membership eligibility. Deactivation blocks reads/push immediately. Processing an inactive FPO may mark memberships pending; rerun after reactivation.

### Existing farmer backfill

From `apps/web`, using the intended database configuration:

```sh
npm run diagnose:fpo
npm run backfill:fpo
npm run backfill:fpo -- --apply
```

The diagnostic and default backfill are read-only and print aggregate counts, not personal profiles or credentials. Review preview totals before applying. `--apply` writes resolved district IDs and memberships, and records pending reasons for unresolved farmers. It never creates FPOs, changes roles, sends announcements, or edits address/GPS fields. Farmer rows are processed in separate transactions and can safely be retried after interruption. The script uses the same matching and assignment functions as the APIs.

Super Admin can also use **Preview all farmers** or **Assign from saved profiles** in Digital FPO management. This processes all pages in batches of ten, shows assigned/pending/error counts, and can stop after a batch. Keep the page open. Create missing district FPOs through the admin interface; farmers with those saved districts are enrolled on creation. Farmers with incomplete addresses must save their State/District, or receive a reviewed admin correction.

## APIs

| Route | Methods | Purpose / access |
|---|---|---|
| `/api/fpo-locations` | GET | Public State/District selector catalogue |
| `/api/digital-fpos` | GET | Signed-in discovery, own assignment, manager capability |
| `/api/digital-fpos` | POST, PATCH | Admin/Super Admin create; Super Admin activate/deactivate |
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

`/signup` and `/select-role` have dependent selectors. New accounts remain in role setup until their role is confirmed. OAuth users complete the same setup. Farmer profiles include “My Digital FPO” with a link to `/chat`.

Farmers discover district Digital FPOs in the FPOs tab at `/nearby-farmers?type=fpo`. Public profiles expose only ID, name, district, state and status. `/chat` shows only their assigned active FPO group's announcement feed, unread count and mark-as-read action. Farmer replies are not supported by this announcement feed. District changes remain available through profile editing.

`/digital-fpos` provides Admin/Super Admin creation and review of FPO groups and tagged farmers. Super Admin retains activation, assignment processing/corrections and publishing. Farmer visits show only the public directory.

Rollout order:

1. Apply schema/catalogue migration.
2. Deploy and configure authentication URLs on both hosts (below).
3. Sign in with an existing authorized Super Admin account. No admin is seeded by this feature.
4. Use **Create all district FPOs and assign farmers** to provision the entire catalogue and process saved profiles, or create individual districts manually.
5. Preview saved-profile matches and review pending reasons. An approved address geocoder is optional for unresolved text addresses.
6. Process batches, inspecting failures. Rerun safely after corrections or creation of missing FPOs.

## Communication access

The shared PostgreSQL predicate `can_receive_fpo_message(user_id, group_id)` requires a current farmer role, assigned membership, matching user/assignment/FPO district, and active FPO. The feed, inbox and announcement query use it. Discovery never calls assignment. The separate administrative review endpoint authorizes Admin/Super Admin sessions and can view every group without enrollment. It does not alter farmer access, unread counts, push recipients, or membership. No client query parameter can grant membership.

Immediate and scheduled push use the same filtered recipient service. It rechecks and locks membership/FPO while submitting each recipient, preventing concurrent reassignment/deactivation from changing eligibility mid-submit. Notifications contain only a generic update notice, with no group name/private body, because an already-delivered OS notification cannot be recalled after a move. Opening the app fetches the content with a new membership check. Push failure leaves the existing announcement scheduler retry behavior in place. Global announcements retain their existing global delivery.

## Environment and deployment

Existing variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, Firebase/FCM service credentials, and `ANNOUNCEMENT_SCHEDULER_SECRET`. No new Firebase key is needed for FPOs.

Optional **server-only** geocoder configuration:

- `FPO_GEOCODER_URL`: HTTPS base URL of an approved Nominatim-compatible service with `/reverse` and `/search`. Configure a service whose permitted request rate supports the ten-record sequential batches. Do not point bulk processing at the public Nominatim service without checking its policy.
- `FPO_GEOCODER_TOKEN`: optional bearer token for that service.

No provider configured still allows exact district/state matches in saved addresses. Unresolved or missing addresses remain pending; explicit validated profile State/District selection always works. FPO assignment geocoding runs server-side and never uses an unconfigured third party.

Browser auth now uses the current website origin, matching the protected APIs. Configure **Netlify** `BETTER_AUTH_URL=https://cofarmz.com` and **Cloud Run** its own service URL. Keep `NEXT_PUBLIC_BACKEND_URL` pointing to Cloud Run for the native app. Ensure Google OAuth permits the applicable `/api/auth/callback/google` redirect URL on each host. Users with a session only on the old Cloud Run origin may need to sign in again on `cofarmz.com`; cookies cannot be shared between unrelated domains. Both deployments must use the intended database and auth configuration.

## Validation and limitations

`npm run test:fpo` executes real PostgreSQL integration tests against localhost port 55439 by default (override `FPO_TEST_DATABASE_URL` with a loopback URL). It creates and drops only the `fpo_integration` schema; do not point it at a shared development instance using that schema. Better Auth session lookup, geocoder, and FCM are fixtures; route authorization and assignment/delivery SQL are real. These tests do not certify Google OAuth, provider accuracy, or live FCM delivery.

The integration suite covers profile-only assignment and static membership alongside: registration/validation; local address matching and configured address geocoding; missing location and later updates; dry runs; reruns; uniqueness; discovery without membership; cross-group feed/unread/push isolation; admin/identity spoofing; district moves; deactivation/reactivation; missing FPO; invalid coordinates; rollback; scheduled delivery; unchanged-location profile edits; admin visibility, read-only authorization, member isolation and historical-message pagination.

Production build completed successfully. Scoped FPO lint completed with no errors. Full project type checking has pre-existing failures in generated Android artifacts and unrelated pages (MapPicker, machinery-list, nearby-farmers, rent-machinery, top-picks); no diagnostics were reported for the changed FPO/API/auth files. The existing Next config ignores type/lint errors during build, so a passing build is not presented as a passing full type check. In-app browser verification was unavailable; visual and real-auth end-to-end checks remain to be performed before production rollout.

## Proposed Digital FPO manager access (not yet implemented)

Provide a **Digital FPO sign in** entry using the existing Better Auth login. After authentication, the server checks an active manager assignment and opens the assigned district dashboard. Selecting a login option never grants a role. Public signup and the existing self-selected `fpo` role must not grant district management access.

Use named individual accounts with an FPO-scoped `manager` permission in a new `digital_fpo_managers` table (`id`, `user_id`, `digital_fpo_id`, `status`, `granted_by`, `created_at`, `revoked_at`). Enforce uniqueness on `(user_id, digital_fpo_id)`. This permission is separate from the user's marketplace role, allowing an existing farmer or FPO account to manage a district without changing their existing profile. Multiple named managers can serve one FPO; each action remains attributable to a person.

### Manager dashboard and scope

- Show the assigned FPO, district, active farmer count, paginated farmer list, farmer profile detail, and announcement history.
- Initially expose name, profile image, bio, State/District and membership status. Add contact details only after agreeing which fields managers need; do not return credentials, precise coordinates, or unrelated account data.
- Check the authenticated manager grant, active FPO, and farmer's current matching district/group on every list, detail and publishing request. Return private, non-cacheable responses. A farmer moving districts immediately leaves the old manager's scope.
- Derive the announcement target from the manager's authorized FPO. Reject global publishing and other FPO IDs. Reuse the existing group announcement delivery filters and retry mechanism.
- Start with immediate announcements. Scheduled/repeating manager announcements require a delivery-time grant check and cancellation policy when the author loses access.
- Super Admin grants and revokes manager access. Managers cannot assign themselves districts, change farmer memberships, activate FPOs, or create other managers. Revoking the grant blocks subsequent manager requests even if the user's ordinary login session remains active.
- Record invitations, grant changes and announcement authorship in an audit trail. Do not log passwords or invitation/reset links.

### Recommended account onboarding and passwords

1. Super Admin opens an FPO and invites a named manager by email. Creating all catalogue FPOs does not create shared district passwords or grant anyone manager access.
2. Issue an expiring, single-use invitation bound to the email and FPO. Store only a hash of the invitation token; support revocation and replacement. A proposed expiry is 24 hours.
3. The recipient signs in or creates their own account through Better Auth. Require proof of the invited email before granting access. Existing users retain their password and marketplace role.
4. Consume the invitation and create the manager grant atomically. Reject expired, revoked, reused or mismatched-email invitations.
5. Managers choose their own password. Super Admin can resend onboarding or recovery links but cannot retrieve passwords. Use Better Auth password hashing, reset-token handling, change-password verification and session revocation.
6. Provide password change and forgot-password screens backed by a real transactional email service. Rate-limit invitation and recovery requests and return the same recovery response for existing and unknown emails.

An alternative onboarding flow is Super Admin assigning an existing verified account directly. The choice between invitations and existing-account assignment is awaiting product input; email delivery configuration is required for invitations and password recovery.

### Existing password recovery issue to fix before rollout

Inspection on 2026-09-25 found that `app/api/auth/forgot-password/route.ts` simulates delivery by logging reset links even in production. `app/api/auth/reset-password/route.ts` writes a bcrypt hash to `user.password`, while `lib/auth.ts` enables Better Auth email/password authentication. Replace this parallel recovery implementation with the installed Better Auth version's supported recovery flow and configure real email delivery. Do not treat the current success response as evidence of a delivered recovery email or working Better Auth password reset.

Reference: [Better Auth email/password configuration](https://better-auth.com/docs/reference/options) and [account password changes](https://better-auth.com/docs/concepts/users-accounts).

### Implementation and verification sequence

1. Add manager grants, invitation and audit migrations without granting existing accounts access.
2. Implement server scope checks, Super Admin grant/invitation endpoints, manager farmer/profile endpoints and immediate group publishing.
3. Integrate supported password recovery and configured email delivery; add invitation acceptance and manager login/dashboard screens.
4. Test cross-district list/detail/publishing denial, public-role self-promotion denial, inactive/revoked grants, farmer moves, invitation expiry/reuse/email mismatch, recovery delivery failures, actual credential login after reset, and session revocation.
5. Apply migrations and deploy, then invite managers. This proposal does not modify production permissions or send invitations.

## Files

New: `migrations/20260923_digital_fpos.sql`, `data/fpo-districts.json`, `lib/fpo-{access,location,assignment,announcements}.ts`, `components/{DistrictSelect,MyDigitalFpo}.tsx`, `app/digital-fpos/page.tsx`, API routes listed above under `digital-fpos`, `admin/fpo`, `fpo-locations`, `scripts/{inspect-fpo-schema.cjs,migrate-fpos.cjs,refresh-fpo-districts.py}`, `tests/{fpo.integration.cjs,eslint.fpo.cjs}`, and this runbook.

Updated: profile/announcement/notification/push-token/role-change routes, push helper, signup/select-role/profile/admin pages, `RoleSelectionGuard`, `useAuth`, auth client/trusted origins, package scripts and local verification ignores. Pre-existing edits to root `cloudbuild.yaml` and `README.md` were left untouched.


## Digital FPO interface

Farmer discovery follows the app's brand colors and card layout, with district display names, search, a state filter, an own-FPO badge and a public profile detail view. Registered FPO names remain available in profile details. The assigned group appears as an expandable conversation card in Messages, with unread updates and a mark-all-read action. Profile cards explain pending location, pending FPO and inactive assignment states.

Administrative management includes FPO/active/tagged-farmer totals, search and status filters, an expandable creation form and separate tagged-farmer/announcement views. Server capabilities continue to control creation, review and Super Admin operations. UI changes do not change assignment rules or add farmer message publishing.

## Assignment diagnosis (2026-09-24)

Aggregate read-only inspection found 2,283 farmers, zero saved district IDs, 2,263 farmers not yet processed, and 20 pending location records. The server had no address geocoder configured and only one active Digital FPO. With saved-profile catalogue matching, the preview resolved 413 farmers: 101 for the existing Hyderabad FPO and 312 awaiting creation of their district FPOs. Another 1,870 require profile clarification (706 missing addresses; 1,164 without a clear catalogue match). These are diagnostic snapshot counts, not guarantees about future data.

The reviewed backfill was applied on 2026-09-24: all 2,283 farmers were processed without errors. Verification found 413 saved district IDs, 101 assigned farmers eligible for their group feed, 312 pending FPO creation, 1,870 pending profile clarification, and zero membership/profile/FPO district mismatches. No Digital FPOs were created by the backfill. Deploy the application changes to keep future assignment behavior tied to saved profile State/District and enable automatic enrollment on FPO creation.
