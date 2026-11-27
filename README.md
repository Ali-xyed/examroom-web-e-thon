# UnCooked

UnCooked supports administrator account management, examiner question banks, scheduled mixed-format exams, candidate enrollment, timed attempts, announcements, incident review, grading, and controlled publication of private results.

## Phase 2

Administrators can create accounts, assign roles, disable access, and reset passwords. Examiners can create and edit reusable questions by topic and difficulty, then copy questions into draft exams. Single-answer, multiple-select, and written questions are supported. Multiple-select uses exact-match marking with zero marks for a partial or incorrect selection. Written responses are manually graded between zero and the assigned maximum.

Use **Question bank and settings** on an exam to assign questions and enable stable question-order randomization. Published exam content is locked. Use **Monitor and grade** to refresh progress, review incidents, send announcements, grade submissions, and review aggregate scores. Result publication is blocked while active attempts or ungraded written responses remain. Candidates use **View result** to see their own published score.

Run `node --env-file=.env scripts/phase-two-smoke.mjs` for the mixed-format API verification.

## Phase 3

Use **Bulk import** for JSON candidate-account imports as an administrator or question-bank imports as an examiner. Download the sample from the import screen. Up to 200 records are validated in one transaction, with a row number for failures and complete rollback on an invalid record.

Use **Preview as candidate** on an exam for a sandbox session. It performs local practice saves and creates no real attempt. **Question analytics** summarizes skipped and incorrect objective responses and average written marks from submitted attempts.

Candidates can download verified PDF reports from their published results. Examiners can download a PDF summary from the monitoring screen. Each candidate report has a verification code and URL. Public verification confirms authenticity and issue time without returning the candidate's name or score. Unpublishing or changing the issued score invalidates verification.

The exam workspace includes text-size and layout preferences, plus a scratchpad saved in the browser. Preferences and scratchpad storage are scoped to the signed-in account. The application caches its exam shell for offline refresh after a successful first load. Pending answers are saved locally and retried after reconnection. Revision numbers prevent an older retry from overwriting a newer accepted answer. The original server deadline remains authoritative, and local changes arriving after expiry are rejected.

The failure-resilience innovation addresses network interruptions and refreshes on the same browser. Recovery requires that the candidate has previously loaded the exam online and retained browser storage. A failed device's unsynchronized local work cannot be recovered on another device. PDF reports embed DejaVu Sans for accented names and paginate large summaries. Font coverage and script shaping depend on the embedded font and renderer.

Run `node --env-file=.env scripts/phase-three-smoke.mjs` for import, sandbox, revision, analytics, and report-verification checks. It uses the separate fictional `phase3-admin@examroom.example` QA account.

## Local setup

1. Use Node.js 22 and a Supabase project. Apply all migrations in `supabase/migrations` in filename order, then run `npm ci`.
2. In Supabase Authentication, create and confirm the four original fictional users below and `phase3-admin@examroom.example`. Run `supabase/demo-roles.sql` to assign their application roles. Set the same QA password on these accounts for the verification scripts.
3. Copy `.env.example` to `.env` and enter the project URL, publishable key, and password used for the fictional accounts.
4. Run `npm run dev`. Open the local URL printed in the terminal.
5. Optionally run `node --env-file=.env scripts/seed-demo.mjs` to create the judge demonstration accounts and four prepared exam states. This uses the configured QA administrator and only creates demo accounts and exams that do not already exist.

| Role | Fictional account |
| --- | --- |
| Administrator | `admin@examroom.example` |
| Examiner | `examiner@examroom.example` |
| Candidate | `candidate@examroom.example` |
| Unenrolled candidate for access checks | `visitor@examroom.example` |

### Hosted judge demonstration accounts

All four accounts below use the password `UnCooked-Demo-2026!`.

| Role | Account |
| --- | --- |
| Administrator | `demo-admin@uncooked.example` |
| Examiner | `demo-examiner@uncooked.example` |
| Candidate | `demo-candidate@uncooked.example` |
| Unenrolled candidate | `demo-visitor@uncooked.example` |

These accounts are fictional and intended for evaluation. Existing team test accounts are separate. Do not use the demonstration environment for real candidate information.

## Verify Phase 1

1. Sign in as the examiner. Create a new exam with two questions and use a window that includes the current time. Enroll the candidate account, then publish.
2. Sign in as the visitor account. Verify the exam is absent and its direct URL is denied.
3. Sign in as the enrolled candidate. Open the exam, select an answer, flag it, and wait for the saved indicator. Refresh and check that both the answer and flag persist and the timer does not reset.
4. Review and submit. Reopen the exam and verify it shows the same receipt. Return to the examiner to check the roster.

`npm run smoke` exercises the hosted auth and database APIs. It creates fictional exam records and checks authorization, answer persistence, duplicate submissions, expiry, and late-write rejection. `npm run check` checks JavaScript syntax.

## Deploy

Import this repository into Vercel. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as build variables. Vercel runs `npm run build` and serves `dist`. Deployments only need the publishable key. Supabase Auth handles sessions, and the database checks roles, exam ownership, enrollment, and the attempt deadline on the server.


## Submission

- Live application https://examroom-web-e-thon.vercel.app/
- Sign-in https://examroom-web-e-thon.vercel.app/login
- Source repository https://github.com/Ali-xyed/examroom-web-e-thon
- Runtime Node.js 22, browser JavaScript, Supabase Auth and PostgreSQL, Vercel static hosting. PDF generation uses locally bundled jsPDF and DejaVu Sans. No paid API is required.
- Original source migrations and version history are included. The repository is private, so judges need repository access or a source export through the submission process.

## Fifteen-minute demonstration

| Minutes | Demonstration |
| --- | --- |
| 0–2 | Open the homepage, sign in as the demo admin, show roles, account creation and the password toggle. |
| 2–4 | Sign in as the demo examiner. Open the draft preview exam, show the bank and assigned question types, then preview as candidate. |
| 4–8 | Use the demo candidate to open “Web fundamentals · take an exam”. Answer a question, flag it, change text size, and use the scratchpad. Disconnect the browser, change an answer, refresh, and reconnect before the deadline. Show pending status becoming saved and the original timer continuing. |
| 8–10 | Open “Written assessment · awaiting grading” as the examiner. Grade the response within its maximum, review totals, then publish. |
| 10–12 | Open “Web fundamentals · published result” as the candidate, download the PDF, and verify its code in a signed-out browser. |
| 12–14 | Show question analytics and import preview. Use the sample JSON and demonstrate an invalid row before confirming a valid import. |
| 14–15 | Show the unenrolled demo visitor has no assigned exams. Explain server timing, locked published question copies, exact-match multiple-select marking, and the offline recovery trade-off. |

The four demo exams are preloaded under the demo examiner and candidate. A real attempt can be submitted once. Create another fictional exam for repeated rehearsals. The server closes the demonstration windows after 72 hours from seeding. The development submission must be finalized before the organizer's deadline. Complete all commits, pushes, builds, and deployments before the cutoff.

## Verification and architecture

Run `npm run check`, `npm run build`, `npm run smoke`, `node --env-file=.env scripts/phase-two-smoke.mjs`, `node --env-file=.env scripts/phase-three-smoke.mjs`, and `npm run verify:final`. Integration checks create fictional records in the configured project. The QA admin defaults to `phase3-admin@examroom.example`; set `EXAMROOM_TEST_ADMIN_EMAIL` to another authorized QA administrator when needed. All QA actors need the password configured in `EXAMROOM_DEMO_PASSWORD`.

The browser calls one authenticated database RPC. The RPC checks account status, role, ownership, enrollment and timing. Private tables have RLS enabled and no direct client access. Earlier RPC versions are executable only internally. The separate public report RPC returns authenticity and issue time only. Supabase's security advisor flags these intentional SECURITY DEFINER entry points and the private tables with no client policies. Leaked-password screening is disabled on this project and remains an authentication configuration limitation.

Expiry is checked on each write and by a database worker every minute. Attempts retain the original exam questions and marks. Browser incidents are review signals. Monitoring is refreshed manually. Offline recovery requires the same browser storage after an initial online exam load. Unsynced work cannot be recovered on a failed device from another device.
