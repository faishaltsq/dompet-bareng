# Static QR Wallet Invitations with Admin Approval — Design Specification

**Status:** Proposed design; awaiting review of this written specification.
**Date:** 2026-10-19.
**Project:** Dompet Bareng, Expo SDK 57 / React Native 0.86.3 / Supabase.
**Scope of this work session:** Read-only discovery and this document only. No product implementation, package installation, migration execution, deployment, commit, or push.

## 1. Goal and agreed interpretation

Make joining a shared wallet easy through one reusable QR code while keeping membership under the wallet owner's/admins' control.

The user's confirmation is interpreted as **approval by the wallet owner or an existing admin**, not merely confirmation by the person scanning. A requester still sees the target wallet and their signed-in account before submitting, so scanning an unintended QR does not silently send a request.

- Each wallet can have one active static invitation QR.
- The QR stays unchanged across opening, refresh, login sessions, and sharing. It has no automatic expiry and changes only when an admin explicitly resets it.
- The QR contains a normal HTTPS invitation URL, not a wallet ID, credentials, JSON payload, or custom-scheme-only link.
- Scanning inside Dompet Bareng stays inside the application.
- Scanning with a regular camera or Google Lens opens the same invitation URL and existing web invitation entry point.
- Scanning or opening the link never grants membership by itself. Approval creates membership, always as `member`.
- Pending users cannot access wallet transactions, balances, budgets, member lists, or private workspace records.

“Directly in the app” means no browser round trip for the in-app scanner. It does not mean bypassing login, intentional submission, or owner/admin approval.

## 2. Verified current implementation

Repository discovery and read-only inspection of the live Supabase schema established:

| Area | Current behavior / evidence |
|---|---|
| Invitation generation | `context/WorkspaceContext.tsx:566` inserts a new `workspace_invites` row on each share action and builds `https://dompet-bareng.vercel.app/invite/{token}`. |
| Invitation storage | `workspace_invites.token` is the primary key, generated from 16 random bytes as 32 lowercase hexadecimal characters. `expires_at` is non-null and defaults to seven days. There is no static/temporary discriminator or revocation field. |
| Join screen | `app/invite/[token].tsx:44` reads the invitation table directly, then `:87` calls `joinWorkspace(workspace.id, 'member')`. |
| Membership write | `context/WorkspaceContext.tsx:733` inserts directly into `workspace_members`; the interface accepts a client-provided role. |
| Live membership INSERT policy | `wm_insert` currently checks only that `auth.uid()` is non-null. This is not an approval boundary and must not remain as a parallel join path. |
| Live invitation policies | Valid invitation rows are broadly selectable. The policy named “Admin buat invite” actually checks workspace membership, not admin status. Names are not proof of authorization. |
| Workspace preview visibility | Live workspace SELECT also permits access when the workspace has a valid invite. A token-scoped, minimal preview should replace that exception. |
| Approval subsystem | No `workspace_join_requests` table and no invitation/join RPCs were found. Existing helper functions include `is_workspace_member`, `user_workspace_ids`, and `user_admin_workspace_ids`. |
| Existing owner bootstrap | Workspace creation and `fetchWorkspaces()` owner auto-healing insert the creator's own `admin` membership. These legitimate paths must survive policy hardening. |
| Manual input | `app/(tabs)/two.tsx:401` currently strips characters from input to derive a token. A strict shared parser must replace this rather than silently repairing input. |
| Navigation | `app/_layout.tsx` handles OAuth and invite links, and preserves a pending token on web. Custom-scheme host/path parsing and cold/warm navigation must be unified. |
| Web routing | `vercel.json` rewrites `/invite/:token` to the static invitation route. This entry point should be retained. |
| Dependency baseline | `react-native-svg` is already installed; `expo-camera` and `react-native-qrcode-svg` are not declared in `package.json`. |
| Release baseline | App version 1.2.0 / Android versionCode 3; the workspace also contains uncommitted widget work that must be preserved. |

A point-in-time metadata probe found 29 invitation rows, zero currently unexpired invitations, and no noncanonical stored tokens. These counts are **not migration assumptions**: implementation must preserve every existing invitation and its actual expiry, including invitations created after this discovery.

## 3. Architecture decision

### Chosen: extend invitations and add a server-owned request workflow

Reuse `workspace_invites` and `/invite/{token}` for both temporary share links and the reusable QR. Add invitation lifecycle metadata and a separate request table. Resolve tokens, submit requests, and decide requests through narrowly scoped PostgreSQL RPCs.

Benefits: one URL format, one admission rule, existing sharing channels remain useful, and printed QR codes work with ordinary camera software. Tradeoff: invitation queries, membership policies, and older join clients need a coordinated migration; this is not a UI-only feature.

### Alternative: a separate static-QR token table

This isolates the old invitation schema but introduces a second resolver/lifecycle and potential token-namespace ambiguity. It still does not solve the open membership INSERT policy. Rejected for the initial release because there is no independent product requirement for a second invitation subsystem.

### Alternative: put a wallet ID or custom scheme directly into the QR

This is easy to render but does not provide the requested browser invitation behavior and does not establish a revocable invitation capability. Rejected.

A rotating/session QR is out of scope because it contradicts the requirement for a static QR.

## 4. Product flows

### 4.1 Display and manage the QR

An owner/admin opens **Settings → Wallet invitation → Show QR** for the active wallet.

1. Retrieve the existing active static invitation, or create it once through the authorized get-or-create operation.
2. Show wallet name, a high-contrast QR on a white quiet-zone surface, and a short explanation that joining requires approval.
3. The encoded value is exactly the canonical HTTPS invitation URL. Do not shorten it through an external service or render QR images through a third-party API.
4. Keep existing link-sharing channels. QR image export, gallery saving, and new clipboard integrations are not required for this release.
5. Offer explicit **Reset QR** and **Disable QR** actions, each with confirmation and a clear explanation that existing members are unaffected.

Static QR creation, viewing through the management UI, reset, and disable are owner/admin operations in this proposal. Ordinary members retain their existing ability to create temporary share links; those links also require admin approval to admit a new member. This intentionally distinguishes QR management from existing temporary-link sharing rights.

Get-or-create is idempotent under simultaneous admin requests. Merely closing/reopening the QR screen must not generate another token. Disabling the QR leaves it disabled; opening the screen must not silently reactivate it. An explicit **Enable QR** action creates a new token after disable.

### 4.2 Scan inside the application

A signed-in user opens **Join wallet → Scan QR**.

1. Request camera access when this screen is opened, not at application startup.
2. Use the back camera and QR-only barcode detection.
3. Lock the scan callback after the first accepted result so repeated camera frames cannot duplicate navigation or requests.
4. Validate the URL locally, then resolve the invitation on the server.
5. Show wallet name and the current signed-in account, with **Request to join** and Cancel.
6. Submit the request through the server and show **Waiting for admin approval**.
7. A denied, unavailable, or permanently blocked camera has a manual-link/code fallback. The screen releases the camera when blurred or backgrounded.

Offline capture does not create a speculative membership or silently queue a write. Show a connection state and allow an explicit retry after connectivity returns.

### 4.3 Scan through a regular camera or Google Lens

The scanner reads `https://dompet-bareng.vercel.app/invite/{token}`.

- The web invitation page remains useful whether the app is installed or not.
- If the OS chooses to open the installed app, the same invitation workflow runs natively.
- Otherwise, show the browser invitation page with explicit **Open app**, browser login/request, and download options.
- Do not force an immediate custom-scheme redirect or promise verified App Links on devices where domain association is not configured.
- Browser submission and in-app submission use the same server operation and approval requirement.

### 4.4 Login and returning to an invitation

A user who is not signed in can view only the minimal invitation preview. Preserve the validated pending invitation through Google OAuth and return to it after authentication on native and web.

- Preserve only the invitation intent, not access/refresh tokens or financial data.
- Give the pending intent a 24-hour client-side retention period; this does not expire the underlying static QR.
- Revalidate the token on return because it may have expired or been revoked during login.
- Show which account is about to submit. Do not auto-submit because an account switch or OAuth callback occurred.
- Clear the pending intent on cancel, logout, or successful submission. Do not let an old global storage key auto-submit into another account.
- Anonymous/guest auth must not submit requests merely because it has an `auth.uid()`; the server enforces registered, non-anonymous identity.

### 4.5 Admin approval and requester completion

Owners/admins see **Join requests** with a pending-count badge. A request card shows the requesting account's server-resolved display name/avatar and request time, not caller-supplied identity fields.

- **Approve:** atomically mark the request approved and create `member` membership.
- **Reject:** mark the request rejected; create no membership.
- No admin role selection is exposed on this flow. QR possession is not an admin invitation.
- Only owners/admins of that request's wallet can decide it. Cross-wallet decisions and non-admin decisions fail on the server.
- Existing membership is never downgraded or promoted by a repeated approval.

The requester sees pending, approved, rejected, cancelled, or expired state. They can cancel their own pending request.

Use authenticated Supabase Realtime updates plus foreground refresh, pull-to-refresh, and a 15-second polling fallback while a relevant screen is focused. Reconnect after lost events and clean up subscriptions on blur/account/workspace changes. Realtime is a convenience signal, not proof of membership.

After approval, fetch authoritative membership again. If the requester is still on the waiting screen, select the approved wallet and navigate into it. If they have moved elsewhere, show a non-interruptive **Open wallet** action rather than switching the active wallet while they are editing another transaction. Requesters can rediscover their requests after restarting the app.

## 5. Data model and lifecycle

### 5.1 Invitation extensions

Extend `workspace_invites` additively:

| Field / rule | Design |
|---|---|
| `kind` | `temporary` or `static`; existing rows default to `temporary`. |
| `expires_at` | Nullable for static invitations; preserve actual existing expiry values for temporary invitations. |
| `revoked_at` | Nullable revocation timestamp; revocation keeps the historical row. |
| Static constraint | `kind = 'static'` requires `expires_at IS NULL`. |
| Temporary constraint | `kind = 'temporary'` requires a non-null expiry. Default remains seven days. |
| Active static uniqueness | At most one unrevoked static invitation per wallet, enforced by a partial unique index. |
| Token | Preserve the existing cryptographically generated 32-character lowercase hex format. Client input never selects the token or the new member's role. |

A static invitation is valid only while unrevoked and while its wallet exists. A temporary invitation must additionally be unexpired according to the database clock.

Static QR reset revokes the old row and creates the replacement atomically. Disable revokes without replacement. Old rows and decision history are retained; unrelated invitations are not deleted.

### 5.2 Request records

Create `workspace_join_requests` with:

- UUID request ID.
- Workspace, requesting user, and source invitation references.
- Status: `pending`, `approved`, `rejected`, `cancelled`, or `expired`.
- Creation time, decision time, and deciding admin ID, with consistency constraints for the applicable states.
- Indexes for a wallet's pending requests and a user's recent requests.
- A partial unique index allowing at most one pending request per user per wallet.

Retain separate terminal attempts for audit history. A fresh attempt after a terminal state receives a new request ID.

### 5.3 Required state behavior

| Situation | Server result |
|---|---|
| First valid request | Create one pending record; no membership. |
| Repeated scan/retry while pending | Return the same pending request; do not duplicate it. |
| Already a member | Return `already_member`; let the user open the wallet without another request. |
| Rejected request encountered again | Return the existing rejection, not an automatically reopened request. |
| Explicit request-again action | Permit a fresh pending attempt after a five-minute cooldown from rejection; return the remaining delay when blocked. |
| Cancelled request | Require an explicit new submission; no automatic reopening. |
| Expired/revoked invitation | Refuse submission; never fall back to joining by workspace ID. |
| QR reset/disable | Invalidate pending requests sourced from that QR in the same transaction; existing memberships stay intact. |
| Temporary invite expires while pending | An approval attempt marks/detects expiry and grants no membership. |
| Simultaneous approve/reject | First committed decision wins; the other caller gets the authoritative terminal state. |
| Duplicate approval | Return the existing result without duplicate membership or role changes. |
| Previously approved user was later removed | Historical approval does not restore membership. A fresh valid request and new approval are required. |

Use one consistent transaction/locking order for invitation lifecycle and request decisions. Resolve reset-versus-approval races under locks: if approval commits first, the resulting membership remains; if revocation commits first, approval cannot grant membership.

The five-minute rejection cooldown is a proposed MVP default for review, not a pre-existing application rule. It is enforced on the server, not by a disabled client button alone.

Do not require a background expiry job for correctness. Reads derive effective expiry from the source invitation. Before reusing a pending request or creating a replacement, the request RPC revalidates the existing pending record's own invitation and expires that record when necessary. A stale pending record from an expired temporary link must not occupy the uniqueness slot and block a valid new QR request. Admin pending counts exclude effectively expired requests, and approval checks expiry again under locks.

## 6. Server boundary and authorization

The following are **new proposed RPC responsibilities**, not existing APIs:

| Operation | Caller / behavior |
|---|---|
| Get invitation preview by token | Anonymous or signed-in caller; return only validity, wallet name/image, invitation kind, and applicable expiry. No broad wallet record or financial data. |
| Create temporary invitation | Registered member/owner/admin of the target wallet; server generates the token, binds the creator, and applies the existing seven-day duration. |
| Get/create static invitation | Registered owner/admin of the target wallet; return the stable invitation or a disabled state. |
| Enable/reset/disable static invitation | Registered owner/admin; atomic lifecycle operations. |
| Submit/request-again by token | Registered requester identified by `auth.uid()`; derive the wallet and `member` admission role on the server. |
| Read own requests | Authenticated requester; only their own request history and navigation metadata. |
| Read wallet pending requests | Owner/admin of that wallet; selected requester display fields only. |
| Approve/reject a request | Owner/admin at decision time; membership write and request decision in one transaction. |
| Cancel a request | The requester, while their request remains pending. |

Exact SQL function names and TypeScript signatures belong in the implementation plan after this specification is approved.

### Required policy changes

1. Remove the broad non-owner direct membership INSERT route. A waiting screen cannot enforce approval while this route remains open.
2. Preserve a tightly constrained owner bootstrap: the authenticated creator may create only their own `admin` membership for a workspace whose `created_by` is that same user. Preserve owner auto-healing and workspace creation without opening arbitrary self-enrollment.
3. Other membership admissions run through the approval transaction. Do not expose a client-selected `role` parameter as an admission authority.
4. Restrict direct request-table mutation; clients cannot set `approved`, choose another requester, or impersonate a reviewer with ordinary table writes.
5. Replace public invitation enumeration with exact-token preview resolution. Owners/admins can manage invitations for their own wallets. Existing members retain temporary-link creation through the authorized RPC and may read their own temporary invitations. Deny direct invitation writes so callers cannot choose tokens, creators, kinds, or expiry; static management remains admin-only.
6. Remove the workspace SELECT exception based only on the existence of a valid invite. Public previews must return a small explicit field set instead.
7. Leave unrelated transaction, budget, workspace deletion, leave, and member-removal permissions unchanged.
8. Use explicit function execution grants, schema-qualified references, fixed search paths, and authenticated actor checks for definer functions. Never ship a service-role key to the application.

The registered-user requirement applies to invitation management/submission, not to unrelated workspace bootstrap. Preserve existing guest/dev owner creation where it is currently supported. Do not log complete invitation URLs/tokens or leak SQL/private-row details in client errors.

Preserve current legitimate membership rows. Inspect unexpected admin assignments before release rather than deleting or downgrading them automatically as part of this feature.

## 7. Link parsing contract

All scan, manual input, web invitation, OAuth-return, and deep-link entry points must use the same strict token/link parsing rules.

- Canonical generated QR: `https://dompet-bareng.vercel.app/invite/{token}`.
- Keep the already configured `dompetbareng.app` HTTPS alias and `dompetbareng://invite/{token}` as legacy parse inputs, without treating them as guarantees of OS domain association.
- Manual input may accept a raw canonical token. Newly generated QR codes must always contain the HTTPS URL.
- Require exactly 32 lowercase hexadecimal token characters; preserve them literally. No character-stripping, substring extraction from arbitrary URLs, or decoding malformed tokens into valid ones.
- Require exact allowed host/scheme and one invitation path segment. Reject lookalike hosts, embedded credentials, unexpected ports, nested paths, executable schemes, and unrelated QR content.
- Tracking query parameters are not authorization inputs and cannot replace or override the path token. Generated QR URLs have no query or fragment.
- Recognize the custom-scheme URL's host/path structure correctly; a native URL does not have the same pathname shape as its HTTPS equivalent.
- Local validation is only a UX filter. The server checks token existence, lifecycle, identity, role, and request state independently.

## 8. Technology and platform choices

- Use Expo SDK 57 `CameraView`, camera permission handling, and QR barcode callbacks. Configure the `expo-camera` plugin with Android audio recording permission disabled; this feature neither records audio nor uploads frames.
- SDK bundled-native metadata currently specifies `expo-camera ~57.0.5`. Use the SDK-aligned installer at implementation time and verify the resolved version rather than installing an arbitrary latest native package.
- Render QR locally with `react-native-qrcode-svg` and the already installed `react-native-svg`. Registry inspection found `react-native-qrcode-svg 6.3.26` with an SVG peer requirement satisfied by the current project; pin and verify the selected dependency during implementation.
- Mount only one active camera preview and unmount it on screen blur/background.
- Primary device acceptance is Android/Samsung. Keep TypeScript and iOS export compatible and configure iOS camera permission text if the native scanner is enabled there; do not claim an iOS device test without running one.
- Web supports QR display, invitation/login/request flow, and manual-link input. A browser camera scanner is not required in this release and must not become a static-export dependency.
- Adding `expo-camera` requires a new native APK/runtime. Proposed next release target is 1.3.0 / Android versionCode 4, subject to checking the current versions again at execution time. Do not publish camera-dependent JavaScript into runtime 1.2.0.

Reference: https://docs.expo.dev/versions/v57.0.0/sdk/camera/

## 9. Proposed implementation boundaries

These are file responsibilities for the later plan, not changes made by this design document.

| Area | Existing files / proposed additions |
|---|---|
| Data migration and policy tests | Add a versioned migration and isolated SQL integration tests under `supabase/`; update the documented schema to match. |
| Strict URL/parser helpers | New focused `lib/inviteLinks.ts` with parser/builder tests. |
| RPC client and result types | New focused `lib/workspaceInvites.ts`; keep server authority out of UI components. |
| Pending-login intent | New `lib/pendingInvite.ts`; integrate with existing native/web OAuth return handling in `app/_layout.tsx` and the invite route. |
| QR management UI | Focused component integrated into existing invitation sharing/settings; preserve `components/InviteShareModal.tsx` sharing behavior. |
| Scanner | New `app/scan-invite.tsx` route and platform-specific scanner components so web does not eagerly import native camera functionality. |
| Waiting state and admission | Adapt `app/invite/[token].tsx` to the request workflow instead of direct membership insertion. |
| Admin queue and requester refresh | Focused join-request components/hooks integrated into `app/(tabs)/two.tsx`; avoid placing the entire subsystem inside this already large screen/context. |
| Workspace activation | Adapt the existing membership refresh and `setActiveWorkspace` interfaces; remove the insecure join-by-ID admission call. |
| Text and native configuration | Extend ID/EN strings in `context/LanguageContext.tsx`; SDK-aligned dependencies, camera plugin/permissions, and version/runtime config. |
| Release and operational documentation | Document migrations, older-client behavior, QR reset semantics, real-device checks, and the signed APK/web-download verification. |

Do not refactor unrelated settings, transactions, widgets, or authentication behavior. Do not discard, commit, or push the existing uncommitted widget changes.

## 10. Rollout and compatibility

This is an authorization change as well as a camera feature. It cannot safely be rolled out as a QR overlay while old unrestricted membership writes remain possible.

1. Prepare and test the additive schema/RPC changes on an isolated database with feature entry points not yet publicly promoted.
2. Prepare matching native and web clients, and verify the tighter policies together with both.
3. Coordinate the final policy cutover, updated web invitation page, and new signed APK distribution. Account for the existing EAS webhook that automatically changes `latest_apk_url`; a candidate build must not be accidentally promoted before the server/client cutover is ready.
4. Enable static QR creation only after the actual database policy tests pass. Disabling the QR UI is not a substitute for authorization.
5. Preserve all existing wallet memberships and financial data. Existing members on older APKs should retain their ordinary financial reads/workflows.
6. Older APKs use direct invitation creation and a direct join-by-ID/table-write API. These cannot be kept as bypasses. Old clients may need an APK update to create invitations or join; the updated browser invitation flow is the fallback. A compatible legacy-runtime admission-only OTA is a separate explicit release decision, not an assumed capability of this camera release.
7. Do not restore the open membership INSERT policy as a rollback. A rollback can disable new QR creation/request submission while keeping authorization closed, then forward-fix the client or RPC.

No production migration or distribution action is authorized by approval of this document alone; execution remains a later explicit step.

## 11. Acceptance criteria and test coverage

### Core journeys

- Reopening the QR for the same wallet returns exactly the same active URL until reset.
- Two admins opening it concurrently do not create two active static invitations.
- Disable stays disabled; explicit re-enable creates a different token.
- The same QR works in the in-app scanner and in Google Lens/regular camera as a normal HTTPS invitation.
- Login preserves and revalidates the invitation, including native cold starts, warm starts, cancellation, and account switches.
- A registered user can submit once, wait, receive approval, and open the correct wallet after authoritative membership refresh.
- A pending/rejected user cannot query wallet financial data or enroll via direct table writes.
- Approval always admits as `member`; it never grants `admin` or overrides an existing role.
- The owner can still create a wallet and repair their own missing membership. A legitimate non-owner admin can review requests; an ordinary member cannot.
- Existing member temporary-link sharing remains available, but admission through those links also requires approval.
- Reset/revoke, rejection, cancellation, expiry during approval, repeated callbacks, duplicate decisions, and approve-versus-revoke races have deterministic tested results.
- A previously approved-and-removed member is not restored by replaying the old approval.

### Five review-critical failure classes

1. **Bypass/privilege escalation:** direct INSERTs, forged roles/user IDs, another wallet's request ID, and non-admin decisions are rejected by actual database checks, not just client tests.
2. **Concurrent and repeated actions:** camera callback bursts, network retries, two reviewers, and QR rotation create neither duplicate pending requests nor unauthorized memberships.
3. **Identity/navigation changes:** anonymous auth, OAuth failure, login to a different account, foreground/background transitions, and pending-intent restoration do not submit for the wrong identity or switch an unrelated active wallet.
4. **Stale lifecycle evidence:** expired/revoked links, removed memberships, missed Realtime events, and cached approval state never substitute for current authoritative membership.
5. **Device/link compatibility:** camera denial/unavailability, malformed/lookalike URLs, Google Lens browser fallback, custom-scheme host parsing, minimum screen sizes, and ID/EN copy remain usable.

### Required verification layers

- Unit tests for URL parsing, pending intent retention, request-result mapping, scan locking, cooldown UX, and state-driven UI behavior.
- SQL/RPC integration tests against an isolated database with anonymous, requester, owner, non-owner admin, ordinary member, and other-wallet identities. Use real RLS roles/claims; privileged service execution alone does not test RLS.
- Migration checks preserve existing invite expiry and memberships; verify owner bootstrap and the removal of the old bypass.
- Native Android device/emulator checks for scan/show QR, camera lifecycle, repeated frames, and post-approval navigation. Verify regular camera/Google Lens on the user's Samsung before calling that device-specific flow tested.
- Web OAuth/invitation checks, denied-camera manual fallback, and Android/iOS/web export checks.
- Signed standalone APK checks: native camera linkage, package/version/runtime/channel, embedded bundle, signing continuity, and the actual public website download target.

## 12. Non-goals

- Automatic admission, role selection from QR contents, rotating/dynamic QR sessions, or one approval authorizing future re-admission.
- Scanning QR from gallery images, saving QR pictures to the gallery, or adding a third-party QR rendering service.
- Push notifications, email delivery, paid device farms, new backend hosting, or a separate invitation microservice.
- Unrelated widget changes, broad settings/auth refactors, or modifying existing financial records.

## 13. Review and next artifact

Review this written design before creating the detailed implementation plan. The implementation plan will be a separate English document under `docs/superpowers/plans/`, with exact migration/RPC contracts, file changes, TDD steps, database authorization fixtures, release sequencing, and execution gates.

Approval of this specification authorizes planning, not immediate implementation or production changes.
