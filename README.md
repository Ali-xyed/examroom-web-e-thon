# UnCooked

UnCooked supports administrator account management, examiner question banks, scheduled mixed-format exams, candidate enrollment, timed attempts, announcements, incident review, grading, and controlled publication of private results.

## Phase 2

Administrators can create accounts, assign roles, disable access, and reset passwords. Examiners can create and edit reusable questions by topic and difficulty, then copy questions into draft exams. Single-answer, multiple-select, and written questions are supported. Multiple-select uses exact-match marking with zero marks for a partial or incorrect selection. Written responses are manually graded between zero and the assigned maximum.

Use **Question bank and settings** on an exam to assign questions and enable stable question-order randomization. Published exam content is locked. Use **Monitor and grade** to refresh progress, review incidents, send announcements, grade submissions, and review aggregate scores. Result publication is blocked while active attempts or ungraded written responses remain. Candidates use **View result** to see their own published score.

Run `node --env-file=.env scripts/phase-two-smoke.mjs` for the mixed-format API verification.

## Local setup

1. Use Node.js 22 or newer and a Supabase project. Apply the migration in `supabase/migrations`.
2. In Supabase Authentication, create and confirm the fictional users below. Run `supabase/demo-roles.sql` to assign their application roles.
3. Copy `.env.example` to `.env` and enter the project URL, publishable key, and password used for the fictional accounts.
4. Run `npm run dev`. Open the local URL printed in the terminal.

| Role | Fictional account |
| --- | --- |
| Administrator | `admin@examroom.example` |
| Examiner | `examiner@examroom.example` |
| Candidate | `candidate@examroom.example` |
| Unenrolled candidate for access checks | `visitor@examroom.example` |

The password for the hosted demo is shared with the team privately.

## Verify Phase 1

1. Sign in as the examiner. Create a new exam with two questions and use a window that includes the current time. Enroll the candidate account, then publish.
2. Sign in as the visitor account. Verify the exam is absent and its direct URL is denied.
3. Sign in as the enrolled candidate. Open the exam, select an answer, flag it, and wait for the saved indicator. Refresh and check that both the answer and flag persist and the timer does not reset.
4. Review and submit. Reopen the exam and verify it shows the same receipt. Return to the examiner to check the roster.

`npm run smoke` exercises the hosted auth and database APIs. It creates fictional exam records and checks authorization, answer persistence, duplicate submissions, expiry, and late-write rejection. `npm run check` checks JavaScript syntax.

## Deploy

Import this repository into Vercel. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as build variables. Vercel runs `npm run build` and serves `dist`. Deployments only need the publishable key. Supabase Auth handles sessions, and the database checks roles, exam ownership, enrollment, and the attempt deadline on the server.
