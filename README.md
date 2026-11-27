# ExamRoom — React + Tailwind Conversion

This is the full React + Tailwind rewrite of the original UnCooked/ExamRoom project.

## Project Structure

```
examroom-react/
├── frontend/          # React + Vite + Tailwind CSS
├── backend/           # Express MVC (datesheet email API)
└── migrations/        # Supabase SQL migrations (unchanged)
```

> **Backend note:** The business logic (exam management, auth, RPC, roles) stays in Supabase exactly as before — no migration changes needed. The Express backend only handles the datesheet email endpoint, which requires SMTP credentials that cannot run in Supabase Edge Functions without extra config.

---

## Frontend (`frontend/`)

**Stack:** React 18, React Router v6, Vite, Tailwind CSS v3

### Setup

```bash
cd frontend
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_API_URL
npm install
npm run dev
```

### Build

```bash
npm run build
# Output: dist/
```

### Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `VITE_API_URL` | Express backend base URL (e.g. `http://localhost:4000`) |

---

## Backend (`backend/`)

**Stack:** Node.js 22, Express 4, nodemailer

The backend is an MVC Express server with one route:

- `POST /api/datesheet` — sends exam datesheet emails to enrolled candidates

### Setup

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, EMAIL_* vars
npm install
npm run dev
```

### MVC Structure

```
backend/src/
├── server.js                        # Express app entry point
├── routes/
│   └── datesheet.js                 # Route definitions
└── controllers/
    └── datesheetController.js       # Business logic + email composition
```

---

## Migrations (`migrations/`)

All 7 original Supabase SQL migrations are copied here verbatim. Apply them in filename order to a fresh Supabase project:

```
20261127000100_phase_one.sql
20261127000200_phase_two.sql
20261127000300_expiry_worker.sql
20261127000400_phase_three.sql
20261127000500_final_validation.sql
20261127000600_candidate_directory.sql
20261127000700_integrity_fairness_disputes.sql
```

---

## Routing

| URL | Description |
|---|---|
| `/` | Landing page |
| `/login` | Sign-in page |
| `/verify?verify=CODE` | Public report verification |
| `/workspace` | Dashboard (role-aware home) |
| `/workspace/create` | Create new exam (examiner) |
| `/workspace/manage/:id` | Manage exam (examiner) |
| `/workspace/bank` | Question bank (examiner) |
| `/workspace/users` | User management (admin) |
| `/workspace/import` | Bulk JSON import |
| `/workspace/monitor/:id` | Monitor & grade (examiner) |
| `/workspace/analytics/:id` | Question analytics |
| `/workspace/sandbox/:id` | Preview as candidate |
| `/workspace/result/:id` | View result (candidate) |
| `/workspace/disputes/:id` | Dispute queue |
| `/workspace/audit/:id` | Audit log |
| `/workspace/fairness/:id` | Balanced papers |
| `/workspace/datesheet/:id` | Datesheet email |
| `/exam/:id` | Take exam (candidate) |

---

## What Changed vs Original

| Aspect | Before | After |
|---|---|---|
| UI framework | Vanilla JS + DOM manipulation | React 18 + JSX components |
| Styling | Custom CSS (styles.css, site.css, refinements.css) | Tailwind CSS v3 (design tokens preserved) |
| Routing | Hash-based (`#manage/id`) | React Router v6 (`/workspace/manage/id`) |
| Bundler | Custom Node.js build script | Vite |
| Backend | Vercel serverless (`api/datesheet.js`) | Express MVC (`backend/src/`) |
| Database/Auth | Supabase (unchanged) | Supabase (unchanged) |
| Migrations | In `supabase/migrations/` | Copied to `migrations/` (unchanged) |
| PDF generation | jsPDF loaded dynamically | Same (jsPDF loaded on demand) |
| Offline resilience | localStorage + IndexedDB | Same logic ported to React hooks |
| Service Worker | sw.js | Vite PWA plugin can be added optionally |
