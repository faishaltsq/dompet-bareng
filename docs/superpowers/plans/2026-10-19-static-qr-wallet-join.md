# Static QR Wallet Invitations with Admin Approval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable wallet QR, an in-app scanner, and a server-enforced owner/admin approval workflow that also works through ordinary camera/Google Lens invitation links.

**Architecture:** Extend the existing invitation table and URL route rather than introducing a second invitation namespace. PostgreSQL RPCs own token lifecycle, identity, admission, and decisions; React Native/web clients display the resulting states. Stage schema, workflow, and policy cutover separately, and prevent automatic APK promotion before the coordinated release is verified.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript, Supabase/PostgreSQL 17, Vitest, Expo Camera, react-native-qrcode-svg, existing react-native-svg, and a disposable Docker PostgreSQL test database.

**Spec:** `docs/superpowers/specs/2026-10-19-static-qr-wallet-join-design.md`, approved for detailed planning by the user's “lanjyut”. This plan still requires review and an execution-method choice; it is not permission to change production.

## Global Constraints

- One active static invitation per wallet; no automatic expiry, and no automatic regeneration after disable.
- Canonical QR payload: `https://dompet-bareng.vercel.app/invite/{token}`. Tokens are exactly 32 lowercase hexadecimal characters, preserved literally.
- Native scan and browser invitation use the same owner/admin approval requirement. Pending users are not members and cannot access wallet financial data.
- Successful admission creates `member`, never a caller-selected role.
- Existing temporary links retain seven-day expiry; existing rows retain their actual expiry and existing memberships remain unchanged.
- Static QR management is owner/admin-only. Existing ordinary members retain temporary-link sharing through an authorized RPC.
- Registered, non-anonymous identity is required for invitation management/submission. Preserve existing owner bootstrap, including supported guest/dev workspace creation.
- Pending login intent retention is 24 hours; rejection retry cooldown is five minutes; focused polling fallback is 15 seconds.
- QR generation is local. Do not upload camera frames or add audio recording, gallery scanning, QR image export, push/email delivery, paid services, or an invitation microservice.
- Primary device acceptance is Android/Samsung; maintain ID/EN copy and Android/iOS/web exports. Web camera scanning is not required.
- Camera-dependent changes require a new native runtime; proposed release is 1.3.0 / Android versionCode 4, only if still available at execution time. Never publish these changes into runtime 1.2.0.
- Do not edit `.env`/credential files, log raw invitation tokens, embed service-role keys, or copy hardcoded credential fallbacks into new code.
- Preserve the uncommitted widget work. Do not commit, stage broadly, push, uninstall the user's application, or run production migrations without separate authorization.
- Follow RED → GREEN per behavior. A test that never runs, an import error, or mocked RLS is not verification of the feature.
- This shell exports `NODE_ENV=production`, which makes React 19's `act` unavailable. Prefix unit-test commands with `NODE_ENV=test` as shown; do not globally change the environment used for builds. Keep `--include=dev` on dependency installation.
- Keep this plan and subsequent planning artifacts in English. Product copy and user-facing reports remain Indonesian with English translations supported in the application.

## Review Focus

1. **Authorization and preserved roles:** direct membership writes, forged role/user IDs, another wallet's request ID, non-admin decisions, owner self-bootstrap, guest owner bootstrap, non-owner admins, and ordinary-member temporary sharing. Pins: Tasks 2–4 and 7.
2. **Repeated and concurrent actions:** camera callback bursts, retries, two admins, duplicate approval, reset-versus-approval, disabled QR persistence, and stale pending uniqueness slots. Pins: Tasks 3, 4, and 8.
3. **Identity and navigation races:** anonymous identity, OAuth cancellation, account switches, slow results from a previous wallet/account, cold/warm custom links, and non-focused approval notifications. Pins: Tasks 5–8.
4. **Stale evidence:** expired/revoked invitations, removed membership after historical approval, missed Realtime updates, old caches, and clock changes during a blocked database transaction. Pins: Tasks 3–6.
5. **Device and release compatibility:** denied/unavailable camera, strict URL parsing, Google Lens browser fallback, static web export, existing app versions, and the automatic EAS download webhook. Pins: Tasks 1, 8–10.

## Discovery Baseline and Prerequisites

Verified on 2026-10-19; recheck before execution:

- `workspace_invites` has token/workspace/creator/expiry/creation fields only. Live database is PostgreSQL 17.6; no join-request table or join/invite RPC exists.
- A metadata-only probe saw 29 invitation rows, no unexpired rows, and no noncanonical tokens. Do not rely on those counts during migration.
- `wm_insert` currently permits any authenticated caller. Live invitation policy names are `Admin buat invite` and `Baca invite valid`; the former checks membership, not admin status. `ws_select` has an invite-existence exception.
- Existing owner auto-healing and workspace creation insert the creator's own admin membership. The existing member visibility helper is definer-based; do not replace it with a recursive self-query.
- `supabase/` contains standalone historical SQL files, not a numbered migrations directory. Do not concatenate those scripts as a production baseline: several represent superseded policies.
- Docker daemon is reachable. Local `psql` and Supabase CLI are not available on PATH. Use container `psql`; do not assume a local Supabase stack or install an ORM.
- Vitest includes only `lib/__tests__/**/*.test.ts`; write new tests there and use `React.createElement` instead of silently introducing undiscovered `.test.tsx` files.
- Current release is 1.2.0 / code 3. Existing `api/eas-webhook.js` promotes every finished Android build with a URL; `scripts/sync-latest-apk.js` chooses the latest build without a profile/version gate.
- Current SDK metadata specifies `expo-camera ~57.0.5`; registry checks found `react-native-qrcode-svg 6.3.26`, `react-test-renderer 19.2.3` with React `^19.2.3` peers, and `@types/react-test-renderer 19.3.0`.

**Execution preflight:**

```bash
git status --short
git branch --show-current
NODE_ENV=test npm test
npx tsc --noEmit
docker version --format '{{.Server.Version}}'
```

Record the actual results. Do not turn earlier widget-test counts into a fixed expected total for the new suite. Inspect migration numbering and current live policy names again before assigning/applying migrations.

No existing unstarted plan overlaps this subsystem. The widget release documents and its earlier plan address a different feature: **this plan does not implement or redesign widgets**.

## File Structure and Ownership

All paths below are relative to the repository root. `Create` means proposed new files, not files that already exist.

### Shared contracts and tests

- Create `lib/inviteTypes.ts`, `lib/inviteLinks.ts`, `lib/workspaceInvites.ts`.
- Create `lib/__tests__/inviteLinks.test.ts`, `lib/__tests__/workspaceInvites.test.ts`.

### Database and isolated validation

- Create `supabase/migrations/20261019000100_qr_join_schema.sql`.
- Create `supabase/migrations/20261019000200_qr_join_rpc.sql`.
- Create `supabase/migrations/20261019000300_qr_join_cutover.sql`.
- Create `supabase/tests/qr_join/baseline.sql`, `fixtures.sql`, `schema.sql`, `workflow.sql`, `authorization.sql`, `assertions.sql`, `rollback_schema.sql`, `performance.sql`.
- Create `scripts/test-qr-join-db.mjs`; modify `package.json` to wire `test:db:qr`.
- Modify `supabase/schema.sql` as documentation of the supported final bootstrap state; do not execute it against production.

### Authentication, membership, and reactive state

- Create `lib/pendingInvite.ts`, `lib/__tests__/pendingInvite.test.ts`, `lib/__tests__/workspaceAdmission.test.ts`, `lib/__tests__/inviteNavigation.test.ts`.
- Modify `context/WorkspaceContext.tsx`, `context/AuthContext.tsx`, `app/_layout.tsx`.
- Create `hooks/useInviteAdmission.ts`, `hooks/useJoinRequests.ts`, `hooks/useWorkspaceQr.ts`.
- Create `lib/__tests__/useInviteAdmission.test.ts`, `lib/__tests__/useJoinRequests.test.ts`, `lib/__tests__/useWorkspaceQr.test.ts`.
- Create `test/inviteRenderHarness.ts` for real React hook/component unit tests; native boundaries remain mocked.

### Product UI

- Modify `app/invite/[token].tsx`, `app/(tabs)/two.tsx`, `components/InviteShareModal.tsx`, `context/LanguageContext.tsx`.
- Create `app/join-requests.tsx`, `app/scan-invite.tsx`.
- Create `components/InviteAdmissionPanel.tsx`, `components/WorkspaceQrPanel.tsx`, `components/WorkspaceJoinRequestsPanel.tsx`.
- Create `components/InviteQrScanner.native.tsx`, `components/InviteQrScanner.web.tsx`, `components/InviteQrScanner.d.ts`.
- Create `lib/__tests__/inviteAdmissionUi.test.ts`, `lib/__tests__/walletInvitationUi.test.ts`, `lib/__tests__/inviteScanner.test.ts`.

### Release controls and evidence

- Create `lib/easApkPromotion.cjs`, `lib/__tests__/easApkPromotion.test.ts`.
- Modify `api/eas-webhook.js`, `scripts/sync-latest-apk.js`, `eas.json`, `app.json`, `package.json`, `package-lock.json`.
- Modify `lib/__tests__/releaseConfig.test.ts`, `README.md`.
- Create `docs/releases/1.3.0-qr-join.md`, `docs/qa/qr-join-device-checklist.md`.

`vercel.json` should remain unchanged unless the existing invitation rewrite demonstrably fails the acceptance test. Changes to an unexpected file require an explicit plan adjustment rather than an opportunistic refactor.

## Shared Contracts — Freeze Before Parallel Work

Task 1 owns the definitions below. Later tasks consume these exact names and shapes.

```ts
export type InviteKind = 'temporary' | 'static'
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
export type InviteErrorCode =
  | 'invalid_input' | 'unavailable' | 'feature_disabled'
  | 'login_required' | 'registered_account_required' | 'forbidden'
  | 'cooldown' | 'not_found' | 'network_error' | 'invalid_response'

export type InviteReply<T> =
  | { ok: true; value: T }
  | { ok: false; code: InviteErrorCode; retry_after_seconds?: number }

export type InvitePreview = {
  wallet_name: string
  wallet_image_url: string | null
  kind: InviteKind
  expires_at: string | null
}

export type InviteLink = {
  token: string
  kind: InviteKind
  expires_at: string | null
}

export type StaticQrState =
  | { state: 'active'; invite: InviteLink }
  | { state: 'disabled' }

export type JoinRequestView = {
  id: string
  workspace_id: string
  wallet_name: string
  wallet_image_url: string | null
  requester_id: string
  requester_display_name: string | null
  requester_avatar_url: string | null
  status: JoinRequestStatus
  created_at: string
  resolved_at: string | null
  reviewer_id: string | null
  requester_is_member: boolean
  can_retry_at: string | null
}

export type JoinState =
  | { state: 'available' }
  | { state: 'already_member'; workspace_id: string; wallet_name: string }
  | { state: 'request'; request: JoinRequestView }

export type JoinCursor = { created_at: string; id: string }
export type JoinRequestPage = {
  items: JoinRequestView[]
  pending_count: number
  next_cursor: JoinCursor | null
}

export type QrAction = 'get' | 'enable' | 'reset' | 'disable'
export type JoinDecision = 'approved' | 'rejected'
export type JoinRequestScope = { type: 'mine' } | { type: 'admin'; workspaceId: string }
```

Times are ISO timestamps; UUID strings are validated at the transport boundary. Public preview has no workspace ID, requester list, email, balance, or transactions. Raw invitation tokens never appear in request-list DTOs or logs. A request's status is its effective status after evaluating source expiry; `requester_is_member` refers to the requester, not the reviewing admin.

### RPC and TypeScript service matrix

Every SQL RPC returns JSONB matching `InviteReply<T>`. Transport/SQL failures map to safe client errors; do not echo database exception details.

| SQL RPC | Service function in `lib/workspaceInvites.ts` | Result `T` |
|---|---|---|
| `preview_workspace_invite(p_token text)` | `previewWorkspaceInvite(token: string)` | `InvitePreview` |
| `create_workspace_invite(p_workspace_id uuid)` | `createTemporaryInvite(workspaceId: string)` | `InviteLink` |
| `manage_workspace_qr(p_workspace_id uuid, p_action text)` | `manageWorkspaceQr(workspaceId: string, action: QrAction)` | `StaticQrState` |
| `get_workspace_join_state(p_token text)` | `getWorkspaceJoinState(token: string)` | `JoinState` |
| `submit_workspace_join_request(p_token text, p_retry boolean default false)` | `submitWorkspaceJoinRequest(token: string, retry = false)` | `JoinState` |
| `list_my_workspace_join_requests(p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 25)` | `listMyJoinRequests(cursor: JoinCursor \| null, limit = 25)` | `JoinRequestPage` |
| `list_workspace_join_requests(p_workspace_id uuid, p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 25)` | `listWorkspaceJoinRequests(workspaceId: string, cursor: JoinCursor \| null, limit = 25)` | `JoinRequestPage` |
| `decide_workspace_join_request(p_request_id uuid, p_decision text)` | `decideWorkspaceJoinRequest(requestId: string, decision: JoinDecision)` | `JoinRequestView` |
| `cancel_workspace_join_request(p_request_id uuid)` | `cancelWorkspaceJoinRequest(requestId: string)` | `JoinRequestView` |

List cursors are paired: both fields present or both null; limits are 1–50; ordering is `(created_at DESC, id DESC)`. Admin lists return effectively pending requests only and their total pending count. Own lists return all states and the caller's total effectively pending count. UUID/time/limit/decision validation happens on the server as well as the client.

### React/state interfaces

- `useWorkspaceQr(workspaceId: string | null, enabled: boolean)` returns `{ state, loading, error, action(action: QrAction): Promise<void>, refresh(): Promise<void> }`; `state` is `StaticQrState | null`.
- `useInviteAdmission(token: string | null, focused: boolean)` returns `{ preview, state, loading, submitting, error, refresh(), submit(retry?: boolean), cancel(), openWallet() }`; async actions return `Promise<void>`. `state` is `JoinState | null`.
- `useJoinRequests(scope: JoinRequestScope, enabled: boolean)` returns `{ items, pendingCount, loading, error, refresh(), loadMore(), decide(id, decision), cancel(id) }`; async actions return `Promise<void>` and identifiers/decisions use the contracts above.
- Add `openJoinedWorkspace(workspaceId: string): Promise<boolean>` to `WorkspaceContext`. It queries actual membership with the current authenticated account before touching workspace state; it never inserts a member or accepts a role.
- Remove the `joinWorkspace(workspaceId, role)` interface after its only current caller is migrated.
- Pure link functions: `parseInviteInput(raw: string, mode: 'link' | 'manual'): { token: string } | null` and `buildInviteUrl(token: string): string`. The builder throws on invalid tokens; it does not repair them.
- Pending intent functions: `savePendingInvite(token: string, now?: number): Promise<void>`, `readPendingInvite(now?: number): Promise<{ token: string; savedAt: number } | null>`, `clearPendingInvite(): Promise<void>`.

## Task 1: Strict Invitation Links and RPC Client Contracts

**Files:** Create the three shared-contract modules and their two test files listed in the inventory.

**Interfaces:** Produces every shared type and service function above. Consumes the existing Supabase client; no SQL migration or native dependency is required yet.

- [ ] **Step 1 — Add one failing parser test, then implement only that behavior.** Start with the canonical link and a malicious host that the old stripping parser would accept:

```ts
import { expect, it } from 'vitest'
import { parseInviteInput, buildInviteUrl } from '../inviteLinks'
const token = '0123456789abcdef0123456789abcdef'
it('recognizes the canonical invitation without repairing unrelated URLs', () => {
  expect(parseInviteInput(`https://dompet-bareng.vercel.app/invite/${token}`, 'link'))
    .toEqual({ token })
  expect(parseInviteInput(`https://evil.example/invite/${token}`, 'link')).toBeNull()
  expect(buildInviteUrl(token)).toBe(`https://dompet-bareng.vercel.app/invite/${token}`)
})
```

Run `NODE_ENV=test npm test -- lib/__tests__/inviteLinks.test.ts`. Establish a behavioral RED with the test file discovered; import/wiring failures are setup failures. Implement parser behavior, rerun GREEN, then repeat for each case below instead of writing every imagined test first.

- [ ] **Step 2 — Pin the complete parser surface.** Accept the two configured HTTPS hosts and `dompetbareng://invite/{token}`; handle the custom-scheme host correctly. Accept raw tokens only in manual mode. Accept surrounding whitespace, but never alter token characters. Reject uppercase/short/long/non-hex/percent-encoded tokens, HTTP, credentials, unexpected ports, trailing/nested path segments, lookalike hosts, executable schemes, and unrelated QR data. Ignore tracking query values as authorization inputs; never substitute a query token for the path token. Do not follow external URLs.

Implementation anchors:

```ts
const TOKEN = /^[0-9a-f]{32}$/
const HOSTS = new Set(['dompet-bareng.vercel.app', 'dompetbareng.app'])
export function buildInviteUrl(token: string): string {
  if (!TOKEN.test(token)) throw new Error('Invalid invitation token')
  return `https://dompet-bareng.vercel.app/invite/${token}`
}
```

Use a URL parser after validation of the allowed forms. Inspect raw path components before URL dot-segment normalization so a path containing `/x/../invite/` is not silently repaired into an allowed invitation.

- [ ] **Step 3 — Add `inviteTypes.ts` with the frozen contracts and explicit response guards.** Validate nested fields, enums, finite nonnegative counts, dates, and nullability. An unknown success shape becomes `invalid_response`, not an unchecked cast. Do not add a new schema-validation package.

- [ ] **Step 4 — Add one failing RPC mapping test, then the service implementation.** Mock only `@/lib/supabase`, and assert exact names/arguments with no user or role parameter:

```ts
it('requests admission by token, never by a client-selected role', async () => {
  rpc.mockResolvedValue({ data: { ok: true, value: { state: 'available' } }, error: null })
  await submitWorkspaceJoinRequest(token)
  expect(rpc).toHaveBeenCalledWith('submit_workspace_join_request', {
    p_token: token, p_retry: false,
  })
})
```

Implement each service from the matrix with named parameters and the matching decoder. Catch network rejection, null data, SQL errors, and malformed replies. Parameterize invalid-input, unavailable, cooldown, forbidden, and registered-account outcomes. Keep tokens out of console/error/analytics output.

- [ ] **Step 5 — Verify/review the deliverable.** Run both targeted test files, `npx tsc --noEmit`, and `NODE_ENV=test npm test`. Expect exit 0 / no failed tests; do not assert an invented suite total. Review the exact changed files. No commit without an explicit request.

## Task 2: Real PostgreSQL Harness and Additive Invitation/Request Schema

**Files:** Create the runner, baseline/fixtures/assertion/schema/rollback SQL files, and migration `20261019000100_qr_join_schema.sql`; wire `package.json` `test:db:qr`. `performance.sql` is owned by Task 4, not this task.

**Interfaces:** Produces the final table/constraint names below and the runner command. Consumes PostgreSQL 17 and the verified existing schema/policies; it must not connect to live Supabase.

- [ ] **Step 1 — Build the isolated runner and prove the baseline works.** Use Node built-ins (`child_process`, `fs`, `crypto`); create only a uniquely named container/database owned by this invocation. Use `postgres:17-alpine`, `--network none`, no published port, and an isolated test-only trust configuration. Use container `psql -X -v ON_ERROR_STOP=1 -d qr_join_test_local`. Probe `pg_isready` with a bounded readiness loop and clean up only this container in `finally`.

`baseline.sql` defines the minimal observed public tables, auth/users/claims helpers, profiles, app_configs, and observed policies. Grant schema `auth` usage and `auth.uid()` execution to test roles; do not grant clients SELECT on `auth.users`. Include real RLS and `anon`/`authenticated` roles. Use the verified non-recursive helper shapes, not the superseded historical scripts.

The JWT shim must read the JSON claim format used in these tests, rather than silently using a different `request.jwt.claim.sub` convention:

```sql
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid;
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
```

Wire the command before relying on tests:

```json
"test:db:qr": "node scripts/test-qr-join-db.mjs"
```

Supported stages: `schema`, `rpc`, `rls`, `race`, `rollback`, `performance`, and `all` (default). Schema stage applies migration 1; RPC stage applies migrations 1–2; final stages apply 1–3. Missing feature migrations may leave baseline objects absent, but the SQL assertions must fail with a clear feature assertion, not a missing-file exception.

- [ ] **Step 2 — Create deterministic, synthetic fixtures and fail on missing schema.** Use fixed UUIDs for owner, non-owner admin, ordinary member, requester, other-wallet admin, authenticated anonymous user, and a formerly approved/removed requester. Use two wallets. Seed fixed historical timestamps and far-future/expired temporary invitations, not copied production rows. Make the seed idempotent and execute it twice.

Use wallet A `10000000-0000-4000-8000-000000000001` and wallet B `10000000-0000-4000-8000-000000000002`. User IDs share prefix `20000000-0000-4000-8000-` with suffixes `000000000001` through `000000000007` in the role order just listed. Users 1/2/3 have A admin/admin/member roles; user 5 owns/administers B; users 4/6/7 have no membership. Only user 6 is anonymous. The token `0123456789abcdef0123456789abcdef` is a synthetic valid temporary source for A. The formerly approved request for user 7 is inserted only in post-migration workflow setup, never in the baseline seed.

Use `assertions.sql` to create a test-only assertion function:

```sql
create or replace function public.test_assert(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'QR_JOIN_ASSERT: %', p_message;
  end if;
end;
$$;
```

Run `npm run test:db:qr -- --stage schema`. Before implementing migration 1, the schema assertion must fail because static invitations/request constraints are absent, while baseline owner/member probes pass.

Keep common fixtures baseline-compatible: static/request-specific inserts live in their post-migration test files. For the preservation case, insert legacy fixtures before migration 1 and capture them; after applying it, seed twice and compare the preserved values. Other stages apply their migration prefix before the shared seed. Save before/after catalog snapshots from the synthetic database in scratch and assert that only intended schema/policy/function objects changed; do not dump production function definitions that may contain legacy secrets.

- [ ] **Step 3 — Implement migration 1 with the exact additive shape.** Keep the old expiry default; explicitly supply null for static rows. Add the compound key before the cross-tenant FK:

```sql
alter table public.workspace_invites
  add column if not exists kind text not null default 'temporary',
  add column if not exists revoked_at timestamptz;
alter table public.workspace_invites alter column expires_at drop not null;
alter table public.workspace_invites
  add constraint workspace_invites_kind_check check (kind in ('temporary','static')),
  add constraint workspace_invites_lifecycle_check check (
    (kind = 'static' and expires_at is null) or
    (kind = 'temporary' and expires_at is not null)
  ),
  add constraint workspace_invites_token_workspace_unique unique (token, workspace_id);
create unique index workspace_invites_active_static_unique
  on public.workspace_invites(workspace_id)
  where kind = 'static' and revoked_at is null;
create index workspace_invites_wallet_kind_created
  on public.workspace_invites(workspace_id, kind, created_at desc);

create table public.workspace_join_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  invite_token text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled','expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  reviewer_id uuid references auth.users(id) on delete set null,
  constraint workspace_join_request_source_fk foreign key (invite_token, workspace_id)
    references public.workspace_invites(token, workspace_id) on delete cascade,
  constraint workspace_join_request_resolution_check check (
    (status = 'pending' and resolved_at is null and reviewer_id is null) or
    (status <> 'pending' and resolved_at is not null)
  ),
  constraint workspace_join_request_reviewer_check check (
    status in ('approved','rejected') or reviewer_id is null
  )
);
create unique index workspace_join_requests_one_pending
  on public.workspace_join_requests(workspace_id, requester_id) where status = 'pending';
create index workspace_join_requests_wallet_pending
  on public.workspace_join_requests(workspace_id, created_at desc, id desc) where status = 'pending';
create index workspace_join_requests_requester_recent
  on public.workspace_join_requests(requester_id, created_at desc, id desc);
alter table public.workspace_join_requests enable row level security;
insert into public.app_configs(key,value,description)
values ('qr_join_enabled','false','Server gate for QR invitation admission')
on conflict (key) do nothing;
```

Do not silently rewrite malformed existing tokens or delete duplicates if preflight discovers unexpected data. Stop for review instead. A deleted reviewer may become null without deleting decision history. Mutation RPCs must set a reviewer for new approve/reject decisions; clients do not receive direct mutation access.

- [ ] **Step 4 — Prove constraints and preservation on actual Postgres.** Assert legacy token/expiry/creator/membership values survive unchanged; null temporary expiry, non-null static expiry, duplicate active static QR, duplicate pending request, invalid status, dangling requester, and a token from wallet B paired with wallet A are rejected. Revoked historical static rows and terminal request attempts remain allowed. Bound the test assertion helper to the test database only.

- [ ] **Step 5 — Exercise rollback/reapply only in the disposable database.** `rollback_schema.sql` must refuse any database name not beginning with `qr_join_test_`. Remove only synthetic new static/request rows, reverse the additive schema, verify original temporary rows/memberships, and reapply migration 1. This is not an authorized production downgrade script. Use forward fixes/disabled feature on production; never restore the open join policy as rollback.

Run schema and rollback stages, then `NODE_ENV=test npm test`. Record actual exit status and schema assertions, not merely that Docker started.

## Task 3: Server-Owned Invitation and Admission Workflow

**Files:** Create migration `20261019000200_qr_join_rpc.sql` and `supabase/tests/qr_join/workflow.sql`; extend synthetic fixtures/assertions and the runner's RPC stage as necessary.

**Interfaces:** Produces all nine RPCs in the matrix and private helpers. Consumes migration 1 and the exact DTO shapes from Task 1.

- [ ] **Step 1 — Pin RPC availability and one successful pending submission with a behavioral RED.** Set the test database gate true as the privileged fixture owner only. Assert RPC registration before invoking it. Then execute as a registered requester and assert a pending record exists but membership does not:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select public.test_assert(
  (public.submit_workspace_join_request('0123456789abcdef0123456789abcdef',false)
    #>> '{value,state}') = 'request', 'submission must return request state');
reset role;
select public.test_assert(exists (
  select 1 from public.workspace_join_requests
  where workspace_id = '10000000-0000-4000-8000-000000000001'
    and requester_id = '20000000-0000-4000-8000-000000000004'
    and status = 'pending'
), 'pending record must exist before rollback');
select public.test_assert(not exists (
  select 1 from public.workspace_members
  where workspace_id = '10000000-0000-4000-8000-000000000001'
    and user_id = '20000000-0000-4000-8000-000000000004'
), 'submission must not create membership');
rollback;
```

The fixture token belongs to wallet A and is unrevoked with far-future expiry. Observe the pending row and absence of membership as the privileged test connection **before** rollback, as shown; RLS-hidden rows or a post-rollback count cannot prove the boundary.

- [ ] **Step 2 — Implement helpers and execution grants.** Define owner/admin from `workspaces.created_by` or the caller's current admin membership. Define registered identity from the current `auth.uid()` and server-owned auth user fields, not caller parameters: the user must exist, `is_anonymous` must be false, and either email must be nonempty or the trusted app-metadata provider must be Google. This matches Settings' current registration rule. Helpers and RPCs have fixed search paths and qualified references. Revoke execution from PUBLIC, anon, and authenticated before applying explicit grants, including grants inherited from Supabase default privileges. Only preview is executable by `anon`; authenticated callers receive required entry points and policy helpers only. Do not expose helper functions that accept another user's ID as authority.

Example of a complete actor-bound helper:

```sql
create or replace function public.qr_join_is_admin(p_workspace_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.created_by = auth.uid()
  ) or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;
revoke all on function public.qr_join_is_admin(uuid) from public, anon, authenticated;
grant execute on function public.qr_join_is_admin(uuid) to authenticated;
```

New invitation/submission entry points fail closed while `app_configs.qr_join_enabled` is not exactly `'true'`. Read/cancel/decision paths still authenticate and can resolve existing records when new submissions are disabled; a hold must not strand an existing requester without a status or cancel action.

- [ ] **Step 3 — Implement each lifecycle operation incrementally with a RED/GREEN pair.** Use a wallet-scoped transaction advisory lock for cross-row lifecycle serialization; do not use row-locking as a substitute for guarded state updates:

```sql
perform pg_advisory_xact_lock(hashtextextended('qr-join:' || v_workspace_id::text, 0));
```

All get/create/reset/disable/enable/submission/decision/cancel mutations for a wallet use the same lock key. Recheck actor authorization and invitation validity after acquiring it. Use `clock_timestamp()` for expiry/cooldown at the decision point, not transaction-start `now()`, because a lock wait can cross expiry.

Required operation algorithms:

- Preview: exact-token validation; feature gate; unrevoked static or unexpired temporary source; project only the `InvitePreview` fields. Return generic `unavailable` for invalid/revoked/expired/nonexistent sources.
- Temporary create: registered current member or creator; use the existing cryptographic token column default, bind creator/time on the server, and apply seven-day duration. Never accept expiry, token, or role arguments or substitute `random()`/time-derived tokens.
- Static get: return current active static row; if historical static rows exist but none active, return disabled; otherwise create the first row once. Enable creates a token only from the disabled/uninitialized state. Reset revokes the active row, expires its pending requests, and creates a replacement. Disable revokes without replacement. Repeating enable/disable is idempotent.
- Join state read: derive wallet from exact token; return already_member only for current actual membership; otherwise return the latest own request with effective status or available. Do not create a request during a read.
- Submit: authenticate/gate/validate; check current membership; expire stale pending rows from their own now-invalid source; return the same valid pending request if present. Return existing terminal state unless the user explicitly retries. Apply five-minute rejection cooldown across tokens for the same wallet/user, then create a fresh attempt. Cancelled/expired/formerly-approved-but-removed cases require an explicit new attempt and a currently valid token.
- Lists: derive requester from auth; authorize wallet admins; enforce 1–50 limit and paired keyset cursor; compute effective expiry and pending counts; return no raw token or email. Query current membership for `requester_is_member` rather than inferring it from past approval.
- Decide: authorize current wallet owner/admin, guard `status = 'pending'`, revalidate source expiry/revocation, and admit only as member. A stale source becomes expired with no membership. A repeated terminal decision returns authoritative state and never re-adds a removed user.
- Cancel: requester only; guard pending state; set cancelled/resolved timestamp without a reviewer or membership change. Repeated cancel returns terminal state.

The decisive mutation must have a guarded UPDATE, not a read-then-unconditional-write:

```sql
update public.workspace_join_requests
set status = p_decision, resolved_at = clock_timestamp(), reviewer_id = auth.uid()
where id = p_request_id and status = 'pending'
returning * into v_request;
if found and p_decision = 'approved' then
  insert into public.workspace_members(workspace_id,user_id,role)
  values (v_request.workspace_id,v_request.requester_id,'member')
  on conflict (workspace_id,user_id) do nothing;
end if;
```

This fragment belongs after authorization and source validation inside the decision RPC. If membership insertion fails, the decision must roll back with it. If housekeeping marks a row expired, return a structured result instead of raising an exception that undoes the expiry update. Do not catch and disguise authorization failures as successful membership.

- [ ] **Step 4 — Pin the hard lifecycle cases.** Tests cover disabled get remaining disabled, concurrent first QR creation, repeated frame/network submissions, new source after stale pending expiry, reject cooldown boundaries, cancelled and expired retries, late expiry during an advisory-lock wait, cross-wallet token association, duplicate decisions, and approved-then-removed membership. Use relative clock setup only inside the clock-boundary test; keep the base seed fixed and repeatable.

- [ ] **Step 5 — Verify the actual RPC stage.** Run `npm run test:db:qr -- --stage rpc`. This stage tests workflow logic but does not claim the old table-write bypass is closed; that is Task 4's separate acceptance gate. Check JSON contracts against the Task 1 service tests and `npx tsc --noEmit`.

## Task 4: Close Direct Admission Bypasses and Prove Concurrency

**Files:** Create migration `20261019000300_qr_join_cutover.sql`, `authorization.sql`, `performance.sql`; extend the runner's RLS/race/performance stages; update `supabase/schema.sql` to document the supported final state.

**Interfaces:** Consumes Tasks 2–3. Produces a database in which only owner bootstrap or the authorized approval transaction can create wallet membership. Feature enablement remains a separate operator action.

- [ ] **Step 1 — Establish a positive control for the existing bug.** In a fresh baseline-only test database, prove that the current authenticated direct membership INSERT succeeds without approval. Then run the intended denial test against baseline and observe it fail. No real accounts or production rows are involved.

- [ ] **Step 2 — Implement the policy/grant cutover.** Remove all currently effective broad INSERT policies on `workspace_members`, not merely one assumed policy name. Fail preflight if an unexpected permissive policy would remain. Recreate one narrowly scoped creator-self-admin bootstrap policy, while retaining existing member SELECT and self/admin DELETE behavior. Remove the invite-existence clause from workspace SELECT, keeping creator/member access. Replace broad invitation enumeration/writes with admin and own-temporary reads and RPC-only writes. Request rows are selectable only by their requester or current wallet owner/admin, with no client INSERT/UPDATE/DELETE grant.

SQL anchor for the owner bootstrap (retain workspace SELECT's creator branch and its definer-safe membership helper to avoid RLS recursion):

```sql
create policy wm_insert_owner_bootstrap on public.workspace_members
for insert to authenticated
with check (
  user_id = auth.uid() and role = 'admin'
  and exists (
    select 1 from public.workspaces w
    where w.id = workspace_members.workspace_id and w.created_by = auth.uid()
  )
);
```

Keep table INSERT capability only to support that policy; RPC definer writes remain privileged. Do not globally revoke an existing SELECT/DELETE right needed by normal members. Add the request table to `supabase_realtime` only if the publication exists and the table is not already included; Realtime is optional for correctness because focused refresh/polling is mandatory. Leave `qr_join_enabled` false in production until the release gate.

- [ ] **Step 3 — Assert the complete identity matrix on real Postgres.** Cover anonymous public visitor, authenticated anonymous user, registered requester, creator owner, non-owner admin, ordinary member, and another wallet's admin. Assert denial of direct enrollment/admin-role injection or self-promotion UPDATE, client request approval, raw token enumeration, cross-wallet decisions and financial reads while pending. Assert positive creator/guest bootstrap, owner auto-heal, non-owner-admin decisions, member temporary sharing, existing member financial access, and unchanged leave/remove permissions. Assert `has_function_privilege` denies anon execution of every non-preview entry point. Server-side service/owner execution alone is not an RLS test.

- [ ] **Step 4 — Run real two-session races and prove the guards have teeth.** The Node runner launches separate container-psql processes with distinct application names. Use a coordinator advisory-lock barrier and inspect waiting sessions before releasing it; do not depend on arbitrary sleeps to create overlap. Probe simultaneous static get/create, repeated pending submission, approve-versus-reject, and approve-versus-reset. Assert consistent terminal replies, at most one active static/pending record, and membership matching the winning decision.

Add `--prove-guards` in the disposable database only: remove the exact pending-state predicate from a copy of the decision function, prove the opposing-decision race assertion fails, restore migration 2's function definition, and prove the same probe passes. The regular suite must never apply the mutant to a persistent or production database.

- [ ] **Step 5 — Validate migration/seed repeatability and query indexes.** Apply schema/RPC/cutover in order, run the seed twice, and rerun safe RPC definitions/grants. Use catalog assertions for every required index and a 10,000-row synthetic query test in `performance.sql`. Run `EXPLAIN (ANALYZE, FORMAT JSON)` for wallet pending and requester recent lists; do not force an index on tiny fixtures. In a disposable control, drop the relevant index and prove the index-presence/performance assertion fails, then restore it. A performance threshold should be recorded from the test environment, not invented as a production SLO.

Run `npm run test:db:qr -- --stage all`, `npm run test:db:qr -- --stage race --prove-guards`, `npm run test:db:qr -- --stage performance`, and `NODE_ENV=test npm test`. Record only actual results. Production application of these files remains a separate gated operation.

## Task 5: Login Intent, Shared Navigation, and Authoritative Wallet Activation

**Files:** Create `lib/pendingInvite.ts`, its test, `lib/__tests__/workspaceAdmission.test.ts`, `lib/__tests__/inviteNavigation.test.ts`, and `test/inviteRenderHarness.ts`. Modify `context/AuthContext.tsx`, `context/WorkspaceContext.tsx`, `app/_layout.tsx`, `package.json`, and `package-lock.json`.

**Interfaces:** Consumes Task 1 parsing/types and the existing auth/context. Produces the pending-intent functions and `openJoinedWorkspace` interface defined above. Keep `refreshWorkspaces(): Promise<void>` backward compatible; do not wait for React state by sleeping.

- [ ] **Step 1 — Wire real React unit rendering for the new UI/hooks.** After inspecting the current manifest/lock, install only the verified matching dev dependencies:

```bash
npm install --include=dev --no-audit --no-fund --save-dev --save-exact react-test-renderer@19.2.3 @types/react-test-renderer@19.3.0
```

Use `React.act` and React Test Renderer for new stateful tests. The existing renderer-free widget harness is not a real React scheduling test and must not be copied as a single-effect mock for these multi-effect hooks. In the new helper, set `IS_REACT_ACT_ENVIRONMENT`, expose async render/rerender/unmount, and keep the real React hooks. Mock only native primitives, storage, auth, camera, and Supabase boundaries per test file. Do not change the global `test/react-native-stub.ts` in a way that breaks existing widget tests.

Helper contract for following tasks:

```ts
export type HookProbe<T> = {
  read(): T
  rerender(hook: () => T): Promise<void>
  unmount(): Promise<void>
}
export async function renderHookProbe<T>(
  hook: () => T,
  wrapper?: React.ComponentType<React.PropsWithChildren>,
): Promise<HookProbe<T>>
export async function renderInviteElement(element: React.ReactElement): Promise<{
  renderer: ReactTestRenderer
  press(testID: string): Promise<void>
  unmount(): Promise<void>
}>
```

These are signatures to implement, not ambient declarations that replace a working test helper. Render a small Probe component that stores the hook's current return value, use `act` around every mount/update/event, and find explicit `testID` props for interaction tests. Renderer deprecation notices are not device proof; device acceptance remains Task 10.

- [ ] **Step 2 — Implement pending-intent storage with focused RED/GREEN tests.** Use key `@db:pending_invite:v1` and payload `{ token, savedAt }`. On native use existing AsyncStorage; on web prefer sessionStorage and retain a guarded localStorage fallback for an OAuth browser round trip. Wrap unavailable storage without touching auth-token keys. Reject invalid JSON, invalid tokens/timestamps, negative age, and ages at or beyond 24 hours; clear invalid/expired entries.

```ts
it('does not restore an expired invitation intent', async () => {
  const now = Date.parse('2026-10-19T09:00:00+07:00')
  await savePendingInvite('0123456789abcdef0123456789abcdef', now)
  expect(await readPendingInvite(now + 24 * 60 * 60 * 1000)).toBeNull()
})
```

Run `NODE_ENV=test npm test -- lib/__tests__/pendingInvite.test.ts` RED before implementing the storage behavior. Pin malformed, missing, valid, expired, backwards-clock, unavailable-web-storage, and legacy `pending_invite_token` migration cases. Clear both legacy web keys after a validated migration, without altering the token.

- [ ] **Step 3 — Integrate cold/warm invites and OAuth without loops.** Replace invitation-specific regex/character-stripping branches in root navigation with Task 1's parser. Preserve the existing OAuth code/hash exchange logic. Use the SDK-supported root-navigation readiness hook and auth-loading state; deduplicate navigation by intent/account and avoid the current arbitrary 300 ms invitation navigation delay. Do not call `Linking.openURL` from the native incoming-link handler.

Save the intent before initiating Google login on native or web. After auth settles, restore the invitation preview only, revalidate on the server, and show the current account before submission. Clear it on explicit cancel, explicit user logout, and successful request submission, not on a transient null/SIGNED_OUT during a deliberate OAuth account transition. Test initial URL plus repeated link events, custom-scheme host parsing, OAuth cancellation/failure, a login to another account, root navigation not yet ready, and ordinary non-invite OAuth callbacks.

- [ ] **Step 4 — Add verified activation and RPC-backed temporary sharing.** Implement `openJoinedWorkspace` alongside the existing admission method, querying the current user's actual memberships and selecting the requested workspace from that fresh response. Return false on query error or missing target; do not fall back to the first wallet or cached list. Guard the result against logout/account change while the query is in flight before setting any state/cache. Replace the existing `generateInviteLink()` body with `createTemporaryInvite(activeWorkspace.id)` plus `buildInviteUrl`, preserving its existing `Promise<string | null>` interface and registered-account failure behavior. Do not leave that context method writing invitation rows after the policy cutover.

The behavioral anchors are:

```ts
it('does not activate an approved-but-removed wallet from cache', async () => {
  const fixture = await mountWorkspaceAdmissionProbe()
  const before = fixture.probe.read().activeWorkspace
  const opening = fixture.probe.read().openJoinedWorkspace(walletId)
  fixture.resolveNextMemberships([])
  await act(async () => { expect(await opening).toBe(false) })
  expect(fixture.probe.read().activeWorkspace).toEqual(before)
  await fixture.probe.unmount()
})

it('does not apply account A membership after switching to account B', async () => {
  const fixture = await mountWorkspaceAdmissionProbe()
  const opening = fixture.probe.read().openJoinedWorkspace(walletId)
  await fixture.switchAccount('20000000-0000-4000-8000-000000000005')
  fixture.resolveNextMemberships(accountAMemberships)
  await act(async () => { expect(await opening).toBe(false) })
  expect(fixture.probe.read().activeWorkspace?.id).not.toBe(walletId)
  await fixture.probe.unmount()
})
```

Implement `mountWorkspaceAdmissionProbe()` locally in `workspaceAdmission.test.ts`: its result has `probe: HookProbe<ReturnType<typeof useWorkspace>>`, `resolveNextMemberships(rows: ReturnType<typeof useWorkspace>['workspaces']): void`, and `switchAccount(userId: string): Promise<void>`. It renders the real `WorkspaceProvider`, controls mocked `useAuth` identity with a rerender, and holds only the activation query in a deferred promise. Define `walletId` and `accountAMemberships` from the synthetic A fixture, and resolve initial bootstrap queries before each assertion. Observe provider state rather than exposing a production-only testing setter. Verify successful activation of the exact authorized wallet, cache keys for the current user, transaction/budget clearing on workspace switch, and zero member INSERT calls from activation or direct invitation INSERTs from sharing. Keep the old admission method temporarily only until Task 6 replaces its sole caller, then remove its body/type/export completely. Never deploy this intermediate client/policy combination.

- [ ] **Step 5 — Verify.** Run the three task test files, `npx tsc --noEmit`, and `NODE_ENV=test npm test`. No credentials or tokens in snapshots/output. Confirm that only invitation-specific navigation changed and widget/auth financial paths still pass.

## Task 6: Requester Admission UI, My Requests, and Live Status

**Files:** Create `hooks/useInviteAdmission.ts`, `hooks/useJoinRequests.ts`, their two tests, `components/InviteAdmissionPanel.tsx`, `app/join-requests.tsx`, and `lib/__tests__/inviteAdmissionUi.test.ts`. Modify `app/invite/[token].tsx`, `app/_layout.tsx`, `context/LanguageContext.tsx`, and finish removing the obsolete context join method.

**Interfaces:** Consumes Tasks 1, 3–5; produces the hook interfaces in Shared Contracts. `InviteAdmissionPanel` consumes hook state plus account label and callbacks; it never writes Supabase tables directly.

- [ ] **Step 1 — Pin “request is not membership” in a real hook/component test.** Start with a valid preview and registered identity; press `request-join`. Assert submission uses the token with `retry=false`, displays pending, and never activates a workspace:

```ts
it('waits for admin approval instead of joining on submit', async () => {
  const view = await renderInviteElement(React.createElement(InviteScreen))
  await view.press('request-join')
  expect(submitWorkspaceJoinRequest).toHaveBeenCalledWith(token, false)
  expect(openJoinedWorkspace).not.toHaveBeenCalled()
  expect(view.renderer.root.findByProps({ testID: 'join-pending' })).toBeTruthy()
  await view.unmount()
})
```

Create the screen import/mocks in `inviteAdmissionUi.test.ts`; an unresolved component import is setup, not behavioral RED. Then implement one state slice at a time.

- [ ] **Step 2 — Implement the complete visible state map.** The route loads minimal preview and current own admission state without submitting. Provide loading, offline/retry, unavailable/revoked, login required, available/request button, submitting, pending/cancel, rejected/retry-after-cooldown, cancelled/explicit retry, expired/scan-again, approved/open, and already-member/open states. An approved record with `requester_is_member=false` must not display a successful join; offer an explicit fresh request using a valid invitation. Obtain display name/avatar from server DTOs; do not trust input identity fields.

Use Indonesian/English translation keys rather than hardcoded strings. Suggested key family: `joinRequestSubmit`, `joinRequestWaiting`, `joinRequestApproved`, `joinRequestRejected`, `joinRequestCancelled`, `joinRequestExpired`, `joinRequestRetry`, `joinRequestCooldown`, `joinRequestOpenWallet`, `joinRequestAccountRequired`, `joinRequestUnavailable`, `myJoinRequests`.

- [ ] **Step 3 — Implement the shared list hook with scoped lifetime and fallback.** Query the matching list RPC immediately when enabled. Subscribe to `workspace_join_requests` filtered by current `requester_id` for mine or by `workspace_id` for admin; the database RLS is still authoritative. Treat event payloads as invalidation hints and refetch DTOs; do not render them directly or log them.

When focused, refresh after Realtime reconnect, AppState active, pull-to-refresh, and every 15 seconds as a missed-event fallback. Stop timers/subscriptions on disable/unmount/account/workspace change. Use an operation generation ID and in-flight guard to discard stale results and avoid overlapping poll queues. Refresh page one on events; keyset pagination appends deduplicated IDs without inventing a count from only the current page.

Use real React/fake timers and deferred RPC promises to test: exactly one active interval, cleanup/replay, previous account/wallet results arriving late, reconnection, network failure without deleting the last known list, duplicate event bursts, and complete server pending counts with paginated results.

- [ ] **Step 4 — Implement approval completion without unwanted navigation.** The admission hook refetches current state on relevant events/foreground/poll. On a newly approved result while the waiting screen is still focused, call `openJoinedWorkspace` and navigate only if it returns true. An event while another screen is focused shows a non-interruptive open action via My Requests; it must not switch a wallet underneath a transaction form. Suppress automatic activation after an explicit cancel/leave-screen intent even if approval wins a cancellation race.

If the token has since been revoked but the user is already a member, the private state-read operation may return already_member after checking current membership; public preview and new submission remain unavailable. A historical approval alone never suffices.

- [ ] **Step 5 — Add authenticated My Requests recovery.** Register `/join-requests` in the stack and link it from Settings/Join Wallet even when the user currently has no wallet. List all own effective states with pagination and pull-to-refresh. Pending supports cancel; approved supports authoritative open; rejected/expired supports scan/paste again, with the rejection delay respected. Do not return raw source tokens merely to reconstruct this screen. Existing `/invite/:token` Vercel rewrite remains unchanged.

- [ ] **Step 6 — Verify and remove the bypass caller.** Run task tests, `npx tsc --noEmit`, `NODE_ENV=test npm test`, and an Android/web export. Search product source for `joinWorkspace(` and direct invitation-route `workspace_members.insert`; there must be no admission caller left. Preserve owner bootstrap, leave/remove, and widget sync paths.

## Task 7: Stable QR Management and Admin Approval Queue

**Files:** Create `hooks/useWorkspaceQr.ts`, its test, `components/WorkspaceQrPanel.tsx`, `components/WorkspaceJoinRequestsPanel.tsx`, and `lib/__tests__/walletInvitationUi.test.ts`. Modify `components/InviteShareModal.tsx`, `app/(tabs)/two.tsx`, `context/LanguageContext.tsx`, `package.json`, and `package-lock.json`.

**Interfaces:** Consumes the shared hooks/services and the existing share modal. `WorkspaceQrPanel` takes `{ visible, workspaceId, walletName, onClose, onShareLink }`; `WorkspaceJoinRequestsPanel` takes `{ visible, workspaceId, onClose }`. Add optional `onShowQr?: () => void` and `inviteKind?: InviteKind` (default temporary) to the existing share modal without breaking current callers.

- [ ] **Step 1 — Install the QR renderer and wire one failing stability test.**

```bash
npm install --include=dev --no-audit --no-fund --save-exact react-native-qrcode-svg@6.3.26
```

Test that reopening/refreshing one wallet invokes action `get` and renders the same server token; a disabled reply must not be converted into `enable` automatically. A stale wallet-A response after switching to wallet B must never appear on B's panel. Implement the real `useWorkspaceQr` with generation guards and a single in-flight action per panel.

- [ ] **Step 2 — Render the actual canonical QR locally.** Use the existing wallet name and Task 1 builder, black modules, white background, a generous quiet zone, and a responsive size. Do not insert a mascot/logo into the code or render a fake decorative QR.

```tsx
<QRCode
  value={buildInviteUrl(state.invite.token)}
  size={224}
  color="#000000"
  backgroundColor="#FFFFFF"
  quietZone={32}
  ecl="M"
/>
```

In component unit tests mock only the native QR rendering boundary and assert the exact `value`/contrast/quiet-zone props. The independent real-code decoding check belongs to the native/browser device gate, not a mocked value assertion.

Add loading, error/retry, disabled/enable, reset confirmation, and disable confirmation states. Reset uses the new returned token; disable removes the QR; existing members remain visible in normal wallet settings. Do not optimistically replace a token before the server action succeeds.

- [ ] **Step 3 — Preserve sharing semantics and permissions.** Ordinary members can still use the temporary-link sharing action via `createTemporaryInvite`. Only owner/admin receives QR-management and approval-queue entry points. Server rejection still wins if client role state is stale. When sharing a static QR's link, pass `inviteKind='static'` so the modal does not falsely claim seven-day expiry. Use parent state to transition between share and QR modals; avoid stacking two active native modals.

Suggested test IDs: `show-wallet-qr`, `qr-value`, `qr-enable`, `qr-reset`, `qr-disable`, `qr-share-link`. Test both existing temporary callers and the new static caller, including a wallet switch while a share/QR request is unresolved.

- [ ] **Step 4 — Implement the admin queue and badges.** Use `useJoinRequests({type:'admin', workspaceId}, visible)` and the server `pending_count`. Show name/avatar/time, loading/empty/error/retry states, per-request disabled actions while a decision is running, and approve/reject actions. Wait for the RPC result and refresh; do not delete a card optimistically before server confirmation. First-committed opposing decisions display the returned authoritative state. Do not expose role selection, raw token, or requester email.

Use the existing settings role convention (`activeWorkspace.role === 'admin'`) for visibility, while preserving backend creator authority and owner auto-heal. Display no stale count from another wallet. Add a My Requests entry outside the admin-only section. Keep new UI in focused components rather than extending the large settings file with the entire workflow.

- [ ] **Step 5 — Run permission-aware UI regression tests.** Pin admin management/queue visibility, ordinary-member temporary sharing, non-owner-admin decisions, stale-role forbidden responses, correct pending badge across pages, cancellation/confirmation of destructive QR actions, static versus temporary copy, double presses, empty states, and both languages. Run targeted tests, `npx tsc --noEmit`, `NODE_ENV=test npm test`, and web export with the actual QR dependency.

## Task 8: QR Camera Screen and Native Runtime Configuration

**Files:** Create `app/scan-invite.tsx`, the native/web/declaration scanner files, and `lib/__tests__/inviteScanner.test.ts`. Modify `app/_layout.tsx`, `app/(tabs)/two.tsx`, `context/LanguageContext.tsx`, `app.json`, `package.json`, `package-lock.json`, and `lib/__tests__/releaseConfig.test.ts`.

**Interfaces:** Scanner props are `{ active: boolean; onResult(token: string): void; onManualEntry(): void }`, exported from `InviteQrScanner.d.ts`. The native implementation consumes Expo Camera; the web implementation renders a manual-entry/open-app fallback. The route imports the extensionless component so Metro selects `.native.tsx` or `.web.tsx` without eagerly loading native camera code in a web export.

- [ ] **Step 1 — Pin scan-once behavior before implementation.** Camera permission and camera view are mocked boundaries; execute the real component's callback through the React harness:

```ts
it('navigates once for repeated frames of the same valid code', async () => {
  const onResult = vi.fn()
  const view = await renderInviteElement(React.createElement(InviteQrScanner, {
    active: true, onResult, onManualEntry: vi.fn(),
  }))
  const camera = view.renderer.root.findByProps({ testID: 'invite-camera-preview' })
  await act(async () => {
    camera.props.onBarcodeScanned({ type: 'qr', data: inviteUrl })
    camera.props.onBarcodeScanned({ type: 'qr', data: inviteUrl })
  })
  expect(onResult).toHaveBeenCalledTimes(1)
  expect(onResult).toHaveBeenCalledWith(token)
  await view.unmount()
})
```

Wire this `.test.ts` into the existing glob. First establish a behavioral RED using an unlocked callback, then implement the lock.

- [ ] **Step 2 — Add SDK-aligned native configuration.** Re-read the exact SDK 57 camera docs and bundled dependency metadata, then install the native module with dev dependencies preserved:

```bash
NODE_ENV=development npx expo install expo-camera
npm install --include=dev --no-audit --no-fund
```

Verify the resolved SDK-aligned version rather than replacing it with an arbitrary latest version. Configure `expo-camera` with `recordAudioAndroid: false` and localized iOS camera usage text. Recheck current versions; if 1.3.0 / code 4 remain free, bump app/npm/lock roots together and retain the `appVersion` runtime policy. Extend release tests so the camera runtime cannot be 1.2.0 and the new plugin is present. Do not regenerate or manually edit native source as if it were maintained product code; use Expo CNG.

- [ ] **Step 3 — Implement focused camera ownership and explicit fallback.** Mount `CameraView` only when the route is focused, AppState is active, and camera permission is granted. Use `facing='back'`, QR-only barcode settings, `onBarcodeScanned`, and mount-error handling. Request permission from an explicit button/screen entry, not app startup. If `canAskAgain=false`, offer `Linking.openSettings` and manual entry; do not repeatedly request denied permission. A camera mount failure has an actionable manual fallback, not a blank screen.

Validate through `parseInviteInput(data,'link')`. Lock with a ref synchronously before navigation for a valid result; invalid results show a debounced inline message and allow rescan, rather than raising an Alert every frame. An explicit Retry or a fresh focused scan resets the lock. Push the internal invite route, never open the browser or arbitrary QR URL. Scanning alone submits no server write.

- [ ] **Step 4 — Register navigation and test lifecycle/input variants.** Add a translated stack title and a Scan QR entry in the existing Join Wallet UI. An unauthenticated visitor follows existing login routing; an authenticated anonymous scanner can preview but still must sign in as a registered account to submit. Test permission loading/denial/permanent denial, blur/background/unmount, unavailable camera, invalid/lookalike URLs, repeated frames, explicit rescan, and a deep link arriving while scanning. Confirm only one active camera view and that the web fallback never imports `expo-camera`.

- [ ] **Step 5 — Verify the native boundary.** Run scanner/release tests, all tests/typecheck, Android/iOS/web exports, and `CI=1 npx expo prebuild --platform android --no-install`. Inspect native camera linkage/permissions and confirm no microphone permission was added by this feature. Reuse the existing Windows short-CXX Gradle workaround if an Android debug build is needed. A successful prebuild or mocked camera callback is not proof of real scanning; carry the actual decode/camera tests into Task 10.

## Task 9: Prevent Premature APK Promotion During Authorization Cutover

**Files:** Create `lib/easApkPromotion.cjs` and `lib/__tests__/easApkPromotion.test.ts`. Modify `api/eas-webhook.js`, `scripts/sync-latest-apk.js`, and `eas.json`.

**Interfaces:** The CommonJS helper is deliberately usable by the existing Node script and Vercel handler without relying on Node executing TypeScript. Export:

```ts
verifyEasSignature(rawBody: Buffer, signature: string | undefined, secret: string | undefined): boolean
selectPromotableApk(rawBuild: unknown, policy: {
  hold: boolean
  expectedProjectId: string
  expectedAppIdentifier: string
  expectedVersion: string
  expectedVersionCode: number
  approvedBuildId: string | null
  approvedBuildUrl: string | null
}): { buildId: string; url: string } | null
```

Use `createRequire(import.meta.url)` with an explicit local type annotation in the TypeScript tests so strict tsc does not require inventing a missing declaration file for this Node-only helper. No mobile component imports it.

**Why this belongs here:** the current webhook automatically promotes every finished Android build. Without a hold, a candidate could reach the website before the new admission policies/client are ready. This task adds an explicit verified-build gate; it is not a new deployment service.

- [ ] **Step 1 — Add failing hold/profile/package tests against actual webhook-shaped data.** EAS webhook metadata is under `payload.metadata`; CLI `build:view --json` metadata is mostly top-level. Normalize only these two documented shapes and reject contradictory/missing fields. Do not assume a webhook has the CLI's top-level `buildProfile` field.

```ts
it('does not promote a finished candidate while the operator hold is active', () => {
  const result = selectPromotableApk(finishedWebhookFixture, {
    ...approvedPolicy, hold: true,
  })
  expect(result).toBeNull()
})
```

Create non-secret fixtures for a finished preview Android APK and a `qr-join-qa` candidate. Test hold, missing approval fields, wrong project/package/version/code/profile/channel/distribution, iOS, unfinished build, an AAB, malformed/external URL, and a build ID/URL different from the verified allowlist. Pin both webhook and CLI JSON shapes. No publish side effect occurs in these tests.

- [ ] **Step 2 — Implement fail-closed signature and promotion selection.** Verify EAS's documented `expo-signature` HMAC-SHA1 on the original request bytes, with constant-time comparison and a separately configured `EAS_WEBHOOK_SIGNING_SECRET`. Do not guess a signing secret or reuse an unrelated RPC secret. Example pure helper core:

```js
const crypto = require('node:crypto')
function verifyEasSignature(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^sha1=[0-9a-f]{40}$/.test(signature)) return false
  const expected = crypto.createHmac('sha1', secret).update(rawBody).digest()
  const received = Buffer.from(signature.slice(5), 'hex')
  return received.length === expected.length && crypto.timingSafeEqual(received, expected)
}
```

The handler must obtain original bytes before JSON parsing. Verify the current Vercel raw-body adapter with an integration fixture whose whitespace differs from `JSON.stringify(parsedBody)`; never “verify” a reserialized body. If the runtime cannot supply original bytes, fail closed instead of accepting unsigned callbacks. Test missing/wrong signatures and byte-different bodies with a synthetic test key, not a real credential. Missing required server configuration returns a controlled failure with no config write.

Promotion requires: finished Android, project `763c45e6-04da-426c-923d-c72da18c1d7c`, package `com.dompetbareng.app`, preview/internal profile/channel, the selected app version/code, and an exact operator-approved build ID plus public HTTPS Expo APK artifact URL. Candidate profile `qr-join-qa` is never promotable. Use server-controlled values, never a hold/approval flag supplied in webhook JSON.

Use server/CLI environment controls `APK_PROMOTION_HOLD`, `APK_PROMOTION_BUILD_ID`, and `APK_PROMOTION_BUILD_URL`. A missing hold setting or missing approved ID/URL fails closed. The selected project/package/version are checked against the current checked-in app configuration, not accepted from an arbitrary caller.

This intentionally makes public APK promotion an explicit post-verification step for each build. It prevents both premature candidate publication and an older/out-of-order callback from replacing the approved artifact. It does not alter the public download URL format.

- [ ] **Step 3 — Apply the same selection to manual synchronization.** Require `--build-id` for the manual script, fetch that exact build with the pinned cached EAS CLI, and apply the same selection helper. Do not select “latest build” as a proxy for the intended artifact. Retain the existing server-side update RPC only with a configured RPC secret; remove hardcoded secret fallbacks from the touched paths. Do not expose server credentials through `EXPO_PUBLIC_*` variables.

The webhook returns a controlled ignored result for valid but held/unapproved/candidate notifications, and never writes the target. Invalid signatures fail authentication. After verification, the operator can deliberately set the exact allowlist, clear the hold, and run the manual sync for the approved build if the earlier webhook was already acknowledged.

- [ ] **Step 4 — Add an isolated candidate profile.** In `eas.json`, add `qr-join-qa` extending preview, internal APK distribution, with channel `qr-join-qa`. Keep the public preview channel unchanged. A candidate build does not authorize using the production database for test writes; do not create a paid staging project or expose the isolated Docker database to the Internet.

If no authorized staging Supabase project is available, distinguish the actual evidence: isolated SQL/RLS tests, mocked transport tests, and camera/QR UI smoke are not an end-to-end production-auth test. The final consented two-account smoke follows the production release gate in Task 10.

- [ ] **Step 5 — Verify handler/script parity without publishing.** Run `NODE_ENV=test npm test -- lib/__tests__/easApkPromotion.test.ts`, `NODE_ENV=test npm test`, and `npx tsc --noEmit`. Mock fetch/update RPC and assert zero writes for held/wrong/unsigned cases and one expected write for an authenticated, exactly approved build. Test the manual selector with the same policy. Verify existing `/api/download` behavior is not changed. Document required configuration by name only; configuration/deployment happens only after explicit release authorization.

Reference: https://docs.expo.dev/eas/webhooks/ — build metadata shape and raw-body HMAC signature.

## Task 10: End-to-End Acceptance, Coordinated Cutover, and Signed APK Delivery

**Files:** Create `docs/qa/qr-join-device-checklist.md` and `docs/releases/1.3.0-qr-join.md`; modify `README.md`. Consume the final source, three migrations, release configuration tests, and promotion controls from earlier tasks.

**Interfaces:** Produces an evidence-backed go/no-go decision and, only after explicit authorization, a verified public APK/web/database cutover. No build ID, URL, checksum, test count, or device result is pre-filled as if it had already happened.

- [ ] **Step 1 — Run the complete local verification gate and inspect the archive.**

```bash
NODE_ENV=test npm test
npx tsc --noEmit
npm run test:db:qr -- --stage all
npm run test:db:qr -- --stage race --prove-guards
npm run test:db:qr -- --stage rollback
npm run test:db:qr -- --stage performance
git diff --check
CI=1 npx expo export --platform all --max-workers 2 --output-dir "$TMPDIR/dompetbareng-qr-export"
CI=1 npx expo prebuild --platform android --no-install
```

On this Windows host, use an actual `C:/...` scratch path if `$TMPDIR` is not suitable for a native executable. Generated native directories remain CNG output, not manually maintained source. Inspect the EAS archive using `EAS_NO_VCS=1` on OneDrive, excluding local environments, signing material, generated native outputs, QA probes, and exports. Compare hashes for the actual invitation/scanner/registration/config assets and source, including untracked files. Capture current dependency audit findings without silently doing unrelated upgrades.

- [ ] **Step 2 — Exercise independent QR decoding and the requester/admin journey.** The checklist must record actual device/OS/app version, result, and evidence for:

| Scenario | Required observation |
|---|---|
| Repeated show/refresh/restart | The same unreset static URL is rendered. |
| Real QR decoding | In-app camera and regular camera/Google Lens independently decode the actual displayed QR to that exact HTTPS URL. A mocked `value` test is not this proof. |
| In-app scan | One accepted result, no browser hop, target wallet/account confirmation, no automatic member INSERT. |
| Signed out / anonymous | Minimal preview only; Google login preserves intent; anonymous auth cannot submit. |
| Registered requester pending | No financial/member data before approval; request survives restart. |
| Approve / reject | Another authorized owner/admin can decide; requester sees authoritative result. |
| Two-wallet/account switch | No stale QR, queue, intent, or active-wallet switch leaks across scopes. |
| Background / camera denied | Camera releases; no repeated permission prompt; manual input remains available. |
| Reset / disable | Old QR refuses new requests, pending old-QR attempts expire, approved members stay members. |
| Repeated/late actions | Duplicate scans/decisions do not duplicate admission; removed membership is not restored by replay. |
| Browser fallback | Camera/Lens link supports open-app, browser login/request, and download options without forced redirect loops. |
| Layout / languages | Small phone screens, safe areas, keyboard/manual input, readable QR quiet zone, and ID/EN copy. |

Use a disposable emulator when resources allow; do not uninstall an existing app or destroy its data just to make signature installation succeed. USB is not required for a local emulator. Samsung camera/Lens acceptance can be a user-assisted check of the displayed QR; label it blocked or untested until actually observed. Do not label iOS device behavior tested based only on an iOS export.

- [ ] **Step 3 — Request the separate production-release authorization.** Present the verified local/candidate results, expected migration/policy changes, older-client join/share impact, and the recovery path. Do not apply live SQL, deploy the website/webhook, configure secrets, build/promote public artifacts, or seed live test accounts merely because source implementation was approved.

Once authorized, stage trusted promotion configuration with the hold on. Configure the EAS signing secret through an approved secret manager/masked configuration path; never request a password/key in chat. Keep existing remote Android signing credentials. If any required production/staging access is unavailable, report that gate as blocked rather than inventing a passed release.

- [ ] **Step 4 — Prepare and verify candidate/final binaries while publication is held.** A candidate can use `qr-join-qa`; final public binary uses preview. With authorization, use the pinned CLI and scratch temporary paths:

```bash
CI=1 EAS_NO_VCS=1 npx --yes eas-cli@25.2.0 build --platform android --profile qr-join-qa --non-interactive --no-wait --freeze-credentials --json
CI=1 EAS_NO_VCS=1 npx --yes eas-cli@25.2.0 build --platform android --profile preview --non-interactive --no-wait --freeze-credentials --json
```

Do not submit redundant builds if the existing candidate/final build is already valid. Query each actual returned build ID, filter signed log URLs from reports, and wait for its true terminal state. A failed watcher is not a failed build. Respect any account/quota/payment approval requirement; do not move to a paid tier automatically.

Download the actual artifact with a normal browser User-Agent. Verify signature against the 1.2.0 reference binary, package, version/code, runtime/channel, non-debuggable standalone configuration, embedded Hermes bundle, ARM64 libraries, camera linkage/permissions, and unchanged widget providers/assets. Cold-start the actual release without Metro on a suitable test device/emulator; if not possible, record the precise deferred gate instead of claiming it passed. Keep the public target on the previous verified APK until final checks and cutover are ready.

- [ ] **Step 5 — Perform the coordinated cutover with invitation-only maintenance if needed.** Apply the exact reviewed migration files, not the old aggregate schema scripts:

1. Apply migrations 1–2 with `qr_join_enabled=false`; confirm no unexpected schema/role changes and that data/expiry/membership counts reconcile with the actual pre-migration snapshot. Review existing admin assignments with the owner if their provenance is unclear; a legitimate non-owner admin is not automatically an invalid assignment. Do not silently delete or downgrade existing roles as part of this migration.
2. Deploy the matching web client and held/authenticated webhook. Existing financial workflows remain available; new invitation UI may show a temporary feature-disabled state during the cutover.
3. Apply migration 3, keeping the server gate false. Read back actual policy definitions, grants, and publication membership; ensure no second permissive membership policy remains. Do not create arbitrary production fixture users for this check.
4. Set the final artifact's exact approved build ID/URL in trusted promotion configuration, clear the promotion hold, and synchronize that exact verified build. Do not allow an unverified latest/candidate artifact to replace it.
5. Enable `qr_join_enabled=true` only after the closed-policy state and updated web/APK are ready. Use the existing protected configuration path or explicitly authorized SQL; read the value back afterward.
6. Run the consented two-account smoke in a clearly labeled QA wallet, or an authorized staging project where available. Observe request, denial of pre-approval data access, admin approval, and correct wallet access with real clients. Do not test against someone else's wallet or delete real financial data.

There is a short, explicit compatibility boundary: older APKs may no longer generate links/join by direct writes. The new APK and browser flow are the supported replacement. Do not preserve the bypass to avoid this boundary.

- [ ] **Step 6 — Verify public state and complete the evidence record.** Read `app_configs.latest_apk_url`, confirm the exact approved artifact, test `/api/download` redirect and `/download` HTTP response, and perform a real artifact GET. Verify signature/checksum/size from that binary, not from a tool success message. Test an out-of-order/wrong build notification cannot replace it. Include actual migration versions, source revision/worktree status, device evidence, remaining deferrals, and rollback/forward-fix actions in the release document.

If a critical problem appears: set `qr_join_enabled=false` to stop new invitation management/submissions while preserving existing member reads and request status/cancel paths, re-enable the promotion hold, and forward-fix. Do not reopen direct member INSERT or instruct installed users to uninstall/downgrade and lose data. A compatible JS fix targets only the new native runtime; native fixes need a higher versionCode.

- [ ] **Step 7 — Final review and handoff.** Run a final spec/quality review and any tests affected by fixes. Do not repeat a previously passing full suite solely to inflate evidence when no code changed. Leave no temporary probe/import, test container, generated export, credential file, or unrelated edit in the product tree. Preserve the user's work and do not commit/push unless separately requested.

## Dependency and Execution Order

```text
1 contracts/parser/client
  -> 2 schema + isolated harness
     -> 3 server workflow
        -> 4 RLS + race proofs
  -> 5 auth intent + authoritative activation
     -> 6 requester state + shared live hooks
        -> 7 QR management + admin queue
           -> 8 camera + new runtime
              -> 9 publication hold/approval controls
                 -> 10 full verification + separately authorized release
```

Tasks 1–4 define security and wire contracts used by later tasks. Do not execute client/server tasks against guessed interfaces. Tasks touching settings, auth layout, translations, package files, or release configuration are serialized. If subagents are chosen, delegate only disjoint file sets and keep integration ownership with the controller; no parallel commits.

## Coverage and File-Inventory Reconciliation

| Spec requirement | Owning task / evidence |
|---|---|
| Stable static QR, disable/enable/reset | 2, 3, 7; uniqueness, lifecycle RPC, real QR screen. |
| Normal HTTPS content and legacy entry points | 1, 5, 8, 10; strict parser and camera/Lens acceptance. |
| Shared admin approval and no pending access | 3, 4, 6, 7; real role/RLS probes and requester/admin UI. |
| Registered identity, OAuth intent, cancellation | 3, 5, 6; server identity and native/web return tests. |
| Race-safe/replay-safe membership | 3, 4, 5; guarded transaction, concurrent sessions, fresh membership activation. |
| Realtime, fallback polling, pagination, history | 3, 6, 7; DTO queries and focused hook cleanup/refresh tests. |
| Owner/guest bootstrap and member sharing preserved | 2–5, 7; positive permission-role tests, no blanket privilege removal. |
| Data/expiry preservation and stale pending cleanup | 2–4; migration checks, cross-tenant FK, effective-expiry tests. |
| Native camera and platform export safety | 8, 10; SDK config, actual decode, standalone smoke. |
| No premature website APK update | 9, 10; hold/signature/allowlist tests and public readback. |
| No unrelated widget or financial modifications | All tasks; scoped diff and unchanged provider/data assertions. |

Each proposed Create/Modify path in the inventory is assigned to a task above. New UI test helpers remain under `test/`; discoverable tests remain under `lib/__tests__/`. A future implementation that needs another path must update this inventory and the owning task before declaring completion.

## Definition of Done

- Product code and database migrations implement the approved spec; there are no stubbed RPCs, fake QR images, client-only approval checks, or historical-approval membership shortcuts.
- Relevant RED/GREEN tests, real PostgreSQL RLS/constraint/race tests, typecheck, and platform exports have actual recorded results.
- Camera/QR and requester/admin acceptance are observed on the claimed devices/environments; unrun gates are explicitly deferred or blocked.
- No production database/deployment/promotion occurred without the separate release authorization.
- If release is authorized, the signed standalone APK, actual closed policies, correct runtime, and exact website download target are read back and verified.
- No secrets, unrelated user changes, or unintended commits/pushes are introduced.

## Plan Review and Execution Choice

This document is the implementation plan, not evidence that the feature is implemented or tested. Review it before execution.

**Recommended: Native execution.** The ten tasks share tightly coupled database/DTO/state contracts and repeatedly touch settings, translations, and package files; recent background workers in this workspace also timed out. One controller implementing sequentially, followed by a fresh full-branch review, reduces coordination failures.

**Alternative: Subagent-driven execution.** Use a fresh implementer and spec/quality reviewers per task, with disjoint scopes only and controller verification of actual files/results. This costs more contexts and still requires serialized integration.

The user selects the method after reviewing this plan. Production migration/deployment/signing/promotion permission remains a separate gate even after implementation begins.
