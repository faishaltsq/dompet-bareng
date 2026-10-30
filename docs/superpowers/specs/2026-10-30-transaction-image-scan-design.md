# Transaction Image Scan: Revised Design

Status: proposed design for owner review, not implementation approval.

## Intent and scope

Make transaction entry faster by reading one uploaded receipt or payment screenshot, for either expense or income. The upload action must be clearly visible in the existing form. The user reviews the extracted amount, category and description, applies them explicitly, and still presses Save to create a transaction. Retain manual entry and attachment-only entry.

Use official DeepSeek only for image inference. Preserve existing text chat, mascot, invitation, widget, wallet-photo and historical transaction behavior. Antislop mode is DURING, selected in this conversation. This revision supersedes the design assumptions in `.hermes/plans/2026-10-30_074424-transaction-image-scan-deepseek.md`.

## Evidence and changes from the first plan

Repository baseline is clean `master`, commit `141ccac`. Existing tests: 28 files and 470 tests passing. TypeScript and proxy syntax checks passed during the structural audit. These checks do not prove the new feature.

The deployed public web bundle identifies Supabase project `uqsgnkgszlnpdfikubpq`, matching the accessible `keuangan-bersama` project. Read-only metadata queries confirmed:

- `transactions.amount` is `numeric(15,2)` and `image_url` exists. Transaction RLS is enabled. `receipt_path` is not present.
- `workspace-images` exists and is public, with no bucket size/MIME restrictions.
- Storage RLS is enabled, but policy `Allow upload` grants INSERT to PUBLIC for that bucket; anon also has table INSERT privilege. This is a real upload authorization gap, not merely an unverified setup comment.
- Storage contains 21 objects: 8 match the current wallet-image naming pattern, 2 match current receipt naming, and 11 have other legacy naming. Do not rename/delete those objects or restrict historical read paths based on guessed naming.
- No actual customer image, transaction content, credentials or provider balance was read. No production writes or billable inference were performed.

Additional local evidence:

- React Native Web Alert is a no-op. The form's Promise around its callbacks stays pending when receipt upload fails.
- The form navigates away before a boolean-returning transaction save completes. A resolved `false` bypasses its `.catch()`.
- iOS picker base64 may be JPEG even while asset MIME/URI/size describes the original PNG/HEIC file. Web returns the original file bytes and ignores native quality options.
- Category constants live in a UI-coupled TypeScript module. The server is CommonJS. Metro explicitly supports `.cjs`, so a small pure shared CommonJS module with TypeScript declarations is compatible with both.
- `expo-image-picker` and `expo-crypto` are installed; `expo-image-manipulator` is not. Do not silently depend on an absent resizer or promise that picker quality compresses web files.

Consequences: revise save behavior, introduce one pure shared input contract, add private storage for new receipts, and replace the known public INSERT policy with an authenticated equivalent. No major folder restructuring is needed.

## Architecture and ownership

```text
Existing transaction modal
  -> picker -> inspect actual image bytes -> local candidate
  -> authenticated existing /api/ai-chat, task=scan-transaction
       -> server validation -> official DeepSeek -> validated result
  -> review -> explicit Apply -> editable local draft
  -> explicit Save
       -> private receipt upload, if chosen
       -> existing workspace transaction writer, await confirmed success
  -> existing detail screen resolves private path to temporary signed URL

Pure shared transactionInput.cjs
  -> categories, whole-rupiah bounds, image-byte inspection, result validation
  -> used by frontend TypeScript and server CommonJS
```

Keep the existing transaction modal and AI endpoint. No scan route, OCR host, new native dependency, provider abstraction, queue or background job. A nullable receipt-path column and private bucket are the smallest additive change that does not publish new financial images through the existing public wallet-photo bucket.

### Significant decisions and tradeoffs

1. Reuse the existing proxy with a dedicated scan task. This avoids another authentication/transport stack, at the cost of requiring explicit dispatch before text-only validation.
2. Keep existing text model/config unchanged; fix scan inference to official `https://api.deepseek.com/chat/completions`, `deepseek-flash`. This avoids accidentally sending images to a text-only/configurable provider, at the cost of a deliberate code change for a future scan model change.
3. Share data/validation in one pure `.cjs` module plus `.d.cts`. This prevents category/amount drift across runtimes, at the cost of one declaration file. Keep old category exports through `lib/utils.ts`.
4. Store new receipts privately and retain historical public URLs. This needs an additive migration and detail-screen URL resolution, but does not break wallet photos or expose new images publicly. Old public objects are not retroactively private; old installed clients still use their legacy upload path until upgraded.
5. Limit images to 2 MiB of actual bytes, without automatic resizing. This fits the Vercel request boundary without a native rebuild. Large images must be re-exported smaller; automatic resizing and browser HEIC decoding are explicitly not delivered in this version.
6. Await save confirmation before navigation. The user waits for persistence, but a failed save leaves an editable draft instead of silently losing it.

## Functional contract

- One static JPEG/PNG/WebP image, one candidate transaction, whole rupiah only. No PDF, camera capture, line-item splitting, batch import, currency conversion or inferred transaction date.
- Selected expense/income type is authoritative. Category must belong to that type. Unknown category becomes `Lainnya`; use exact existing category strings.
- Valid create/scan amount is an integer from 1 through 9,999,999,999,999 inclusive. Validate at server inference boundary, client response boundary and transaction create writer. Do not alter historical cents data or redesign edit flows.
- The normalized payload's decoded bytes determine MIME, extension and byte size. Never trust metadata alone. Use the same bytes for scan, selected attachment preview and upload; an original URI may only be used before normalization.
- Maximum image bytes: 2,097,152; maximum base64 characters: 2,796,204; maximum scan JSON body: 3,145,728 bytes. Reject empty/invalid base64, invalid signatures and unsupported/animated inputs before billable inference where detectable. DeepSeek still performs full image decoding; a magic-byte check is not a full decoder.
- Missing base64 from the picker is a visible recoverable error, not permission to guess bytes/MIME. Keep manual entry available. Native JPEG base64 from a HEIC source is accepted as JPEG; unsupported original browser HEIC is rejected with actionable copy.
- Image selection defaults to `allowsEditing: false` so a crop cannot silently discard the total of a long receipt. Web opens the picker directly from the user action; do not insert a network/permission wait ahead of opening it. Request platform permissions only when actually required.
- Candidate selection and processing never write to Storage or transactions. Explicit Apply fills amount/category/description and selects the candidate as an attachment. Attach-only selects it without inference and without changing manual fields.
- Changing image/type, logout/account change, workspace change or unmount cancels/invalidates prior scan results. Removing a selected attachment does not erase accepted/manual fields.

## AI request and result

The client sends only `task`, selected `transactionType`, and `{mimeType, base64}` to the existing authenticated endpoint. Existing text clients omit `task` and keep the original payload/response. Reject unknown tasks and client-supplied model/host/prompt/URL overrides.

The server controls the extraction prompt. Treat text inside the image as untrusted document content, never executable instructions. Ask for final paid/received total, not subtotal, balance, tendered cash, change or reference number. Ambiguous documents must not produce an invented amount.

Internal model result is a discriminated JSON object:

```ts
type ModelScanResult =
  | { status: 'recognized'; currency: 'IDR'; amount: number; category: string; description: string }
  | { status: 'unrecognized'; reason: 'unreadable' | 'ambiguous' | 'unsupported_currency' };
```

Only recognized IDR results can become the public success envelope `{transaction: {amount, category, description}}`. Description is a string of at most 300 characters. Reject empty/malformed/truncated output and contradictory result shapes. A currency field validates what the model reported, not independent proof of the document's currency.

Use user-message text plus an inline image block, `detail: 'original'`, `response_format: {type: 'json_object'}`, `thinking: {type: 'disabled'}`, `stream: false`, and `max_tokens: 512`. No Files API or public intermediary image URL.

Map errors to stable codes: 400 invalid request/task, 401 session required, 413 too large, 415 unsupported image, 422 unrecognized result, 502 upstream failure/invalid output, 504 timeout. Do not expose provider error bodies or log images, raw extracted text, signed URLs or keys. Bound auth and inference work so the total server path finishes within the existing 60-second client timeout; use 10 seconds for scan authentication and 40 seconds for inference, clearing timers. Existing text timeout/config behavior remains unchanged. No automatic billable retries.

## Storage and compatibility

Create private bucket `transaction-receipts` with 2 MiB and JPEG/PNG/WebP limits. Add nullable `public.transactions.receipt_path text`. Keep `image_url` unchanged for old records and old clients.

New object path: `<workspace UUID>/<uploader UUID>/<transaction UUID>.<jpg|png|webp>`. Insert with `upsert: false`. Validate the whole canonical path before casts/policy checks; reject extra segments, encoded separators and traversal.

- INSERT: authenticated current workspace member, uploader segment equals auth UID.
- SELECT/sign: authenticated current workspace member only.
- UPDATE: not granted; images are immutable per save intent.
- DELETE: authenticated current workspace member, and no transaction references the object. Delete a transaction first, then attempt object cleanup. Cleanup failure must not misreport a successful transaction deletion as failure.
- A CHECK on transactions requires a non-null receipt path to match that row's workspace, user and transaction IDs and one permitted extension, with `image_url IS NULL`. Do not rewrite existing transaction RLS or role capabilities.

Replace only known legacy `Allow upload` with authenticated INSERT for `workspace-images`. Preserve its existing bucket condition, public reads and authenticated legacy writer compatibility; do not add UPDATE/DELETE privileges or restrict historical path names. Inventory policies again before application; stop on unexplained drift rather than deleting unknown policies. This closes anonymous legacy upload, not all authenticated legacy storage abuse.

New detail rendering prefers receipt_path. Resolve through the user-scoped Supabase client with a 300-second signed URL. Never persist signed URLs to transactions or AsyncStorage. Clear resolved URLs on identity/workspace changes; refresh when expired on viewing/zoom/retry. Keep image loading/error/retry separate from whether the transaction exists. Legacy image_url remains readable. A signed URL already issued remains usable until expiry; membership revocation prevents new signing, not immediate invalidation of an existing URL.

## Save, retry and concurrent changes

Repository search confirms app/modal.tsx is the only addTransaction caller. Replace its insufficient boolean result with an explicit saved/failed/unknown outcome in the existing writer and update that one caller; do not add a parallel save service. Add an optional explicit save identity containing stable transaction UUID plus expected user/workspace IDs. Generate UUID using already-installed expo-crypto. Failed means a definitive preflight/database rejection with no commit; unknown means transport ambiguity and must not be presented as proof that nothing was saved.

Freeze a submission snapshot, acquire synchronous save guard, validate, upload selected receipt if necessary, and await transaction persistence. Navigate/vibrate only after a saved outcome. Definitive failure and upload rejection preserve the editable draft; an unknown outcome preserves a frozen intent with a user-initiated status-check/retry action that reuses its UUID and fields. Do not unlock conflicting edits or offer save-without-image after a possibly committed insert. No Alert callback Promise on the new form path; render inline `Coba upload lagi`, `Simpan tanpa gambar`, `Batal` actions after a known upload failure before any transaction insert.

Use the same UUID for retries of an unchanged save snapshot. Reconcile ambiguous network failures by querying that exact row scoped to its original user/workspace before another insert. A confirmed matching row means success, not a second transaction. Never overwrite a conflicting row. If outcome is unknown, keep the submission snapshot pending and do not invite editing into a conflicting identity. After confirmed non-commit the user may edit and start a fresh intent. Use a known uploaded path again rather than re-uploading on each retry.

The writer must check expected identity before network writes and before UI/cache commits. On workspace/account drift, do not insert through a new closure or restore old rows into the new workspace. Scope optimistic rollback to its own UUID; never replace the whole transaction list with a captured previous list. Handle thrown network errors as well as returned Supabase errors. If a request already committed before identity changed, do not claim it was rolled back; suppress stale UI and reconcile when that workspace is opened again.

Best-effort cleanup is allowed only for newly uploaded unreferenced objects owned by the current save intent. Never remove a confirmed attached object on a timeout or uncertain commit. Explicit cancel/replacement after a known non-commit can clean up; an app crash can leave a private orphan. Automated retention/garbage collection is not part of this feature and no zero-orphan guarantee is made.

## Visual direction and antislop

Design Read: existing transaction-entry form for personal/shared-wallet users, warm caramel/cream visual language, ENERGY 2 / RHYTHM 1 / MOTION 1.

- Full-width `Upload & scan gambar` action after expense/income switch and before amount, minimum height 48 logical pixels. Clear secondary `Lampirkan saja` action with at least 44 logical pixel target.
- Primary caramel outline/text on existing light surface distinguishes draft assistance; the filled Save action remains the final persistence action. Preserve established type colors, typography and radius. No new logo, illustration, palette, badges or decorative animation.
- Small truthful explanatory text identifies DeepSeek processing and that results need review. Keep UI copy in Indonesian/English translations, without em dashes or invented accuracy/security/retention claims.
- No initial amount autofocus hiding the upload action. Explicit editing still opens the keyboard.
- Render empty, selecting, processing, review, error and saving states, with real retry/remove/apply/cancel behavior. Provide visible labels, focus, native accessibility roles, status announcements and web pointer/disabled affordances. Escape/back must not discard a saving intent silently.
- Use reserved preview dimensions, readable total/category, containment for long notes, text scaling and 320/390/768/desktop widths. Measure contrast; do not assume all existing color pairs pass. Correct only touched controls, not global theme design.
- Follow system reduced-motion preference for new motion. Do not add a theme toggle or expand the shipped theme scope; verify the existing system light/dark navigation context does not make new controls unreadable.

## Proof and release

Pure tests prove validation; rendered tests prove state transitions and callback wiring; local PostgreSQL proves policies/migration behavior. Mocked AI output never proves receipt-reading accuracy. Require authorized real-image inference and user-scoped Storage API checks before production acceptance.

Deploy schema/storage first, backward-compatible API second, then upgraded frontend/native-compatible OTA. No deployment, production migration, billable call or test data mutation is authorized by this design document alone. Older clients keep text chat and legacy image behavior. For rollback, roll client behavior back first, preserve additive schema/private objects, and never restore anonymous uploads as a routine rollback step.

Sources consulted: official Expo SDK 57 ImagePicker docs; installed Expo ImagePicker web/iOS source; official DeepSeek vision, JSON and thinking guides; Supabase Storage RLS and createSignedUrl references; Vercel Function body limits. Live metadata and local probes are described above, separately from future acceptance tests.

Explicit omissions: bulk/PDF/camera import, automatic image resizing, browser HEIC decoding, retroactive migration of public legacy images, generic provider frameworks, permanent rate-limiting infrastructure, background cleanup, a global theme rewrite, and changes to unrelated QR/widget/mascot logic. Record these limits in release notes; do not disguise them as implemented capabilities.
