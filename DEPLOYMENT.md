# Deploying TrueHire

Three deployable pieces:

| Piece | Platform | Root directory |
|---|---|---|
| React frontend | Vercel | `frontend` |
| Express API (auth, DB, storage, email) | Render | `backend/express-service` |
| FastAPI AI service (Gemini + LangGraph) | Render | `backend/fastapi-service` |

Postgres and file storage are already hosted on Supabase — nothing to deploy there.

---

## ⚠️ Read this before you scale anything

**Both backend services must run on exactly ONE instance each.**

They keep live interview state in process memory:

- FastAPI: `fake_users_db`, `oa_sessions`, `candidate_assessments`, and the interview agent's sessions
- Express: `inFlightReports`, the map that stops a report being generated and emailed twice

With two or more instances a candidate's requests land on a process that has never
seen their session. It shows up as intermittent `No candidate profile found` /
`No active OA session` errors, and duplicate report emails.

**Render's free tier also spins a service down after ~15 minutes of inactivity.**
When it wakes, that in-memory state is gone — a candidate mid-assessment loses
their attempt, and the first request after sleep takes ~50s. For anything beyond
a demo, use a paid instance type, and move the live session state into Postgres.

---

## Order matters

The services reference each other by URL, so deploy backends first, then the
frontend, then come back and fill in the cross-references.

---

## 1. The shared JWT secret

Express **signs** the tokens; FastAPI only **verifies** them. If the two services
hold different secrets, every AI round fails with a 401.

Use the `JWT_SECRET` already in `backend/express-service/.env` (the same value is
now in `backend/.env`). Paste that one value into **both** Render services,
byte-identical — copy-paste it, don't retype it.

> Both local `.env` files used to hold *different* secrets. It only worked
> because FastAPI read Express's `.env` off disk at startup — a dev-only hack
> that is now correctly disabled in production. They have since been synced.

If you ever want production isolated from your laptop, generate a separate secret
for Render only:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Changing the secret invalidates existing login tokens, so users just log in again.

---

## 2. Deploy the two backends on Render

The repo has a `render.yaml` blueprint that defines both services.

1. Push this branch to GitHub.
2. Render → **New** → **Blueprint** → select the repo.
3. Render reads `render.yaml` and prompts for every secret marked `sync: false`.

Fill them in:

**truehire-api (Express)**

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Supabase pooler string (port `5432`) |
| `JWT_SECRET` | the secret from step 1 |
| `SUPABASE_URL` | from Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | the **service_role** key (server-only, never public) |
| `EMAIL_USER` | your Gmail address |
| `EMAIL_PASS` | Gmail **App Password**, not your account password |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `CLIENT_URL` | leave blank for now — step 4 |
| `FASTAPI_URL` | leave blank for now — step 3 |

**truehire-ai (FastAPI)**

| Variable | Value |
|---|---|
| `JWT_SECRET` | the **same** secret from step 1 |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GITHUB_TOKEN` | GitHub PAT, `public_repo` scope |
| `ALLOWED_ORIGINS` | leave blank for now — step 4 |

`ENVIRONMENT=production` is already set in the blueprint. It disables the dev
secret fallback, so the service will refuse to boot if `JWT_SECRET` is missing —
that is intentional.

---

## 3. Wire Express → FastAPI

Once both are live, copy the FastAPI service URL
(`https://truehire-ai.onrender.com`) into **truehire-api**'s `FASTAPI_URL`, then
redeploy it.

---

## 4. Deploy the frontend on Vercel

1. Vercel → **Add New Project** → import the repo.
2. **Root Directory: `frontend`** ← easy to miss; the build fails without it.
3. Framework preset auto-detects Vite. `vercel.json` handles SPA routing so deep
   links like `/dashboard/report/:id` don't 404 on refresh.
4. Set environment variables:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://truehire-api.onrender.com` |
| `VITE_FASTAPI_URL` | `https://truehire-ai.onrender.com` |
| `VITE_GOOGLE_CLIENT_ID` | your Google OAuth client ID |

> `VITE_*` values are **baked into the public bundle at build time**. Never put a
> secret here. They are also only read at build time — changing one requires a
> redeploy, not just a restart.
>
> If you forget `VITE_FASTAPI_URL`, the bundle silently falls back to
> `http://localhost:8000` and the Technical/HR rounds fail in a confusing way.

---

## 5. Close the CORS loop

Now that you have the Vercel URL, go back to Render:

**truehire-api** → `CLIENT_URL` = `https://your-app.vercel.app`
(comma-separate to allow several)

**truehire-ai** → `ALLOWED_ORIGINS` = `https://your-app.vercel.app`

Both services need it: the browser calls Express for auth/reports **and** calls
FastAPI directly for the Technical/HR rounds.

To allow Vercel's per-commit preview URLs as well:

- **truehire-api** → `CLIENT_ORIGIN_REGEX` = `^https://.*\.vercel\.app$`
- **truehire-ai** → `ALLOWED_ORIGIN_REGEX` = `https://.*\.vercel\.app`

Redeploy both.

---

## 6. Update Google OAuth

Google Cloud Console → Credentials → your OAuth client → **Authorized JavaScript
origins** → add `https://your-app.vercel.app`. Sign-in fails with
`redirect_uri_mismatch` until you do.

---

## Database migrations

The project is now on Prisma **migrations** rather than `db push`.

- `prisma/migrations/0_init` is a baseline generated from the existing schema and
  already marked as applied on the live database.
- Render runs `prisma migrate deploy` on every deploy (via `npm run build`), so
  schema changes ship automatically.

To change the schema from now on:

```bash
cd backend/express-service
# edit prisma/schema.prisma
npx prisma migrate dev --name describe_your_change   # local: writes a migration
git add prisma/migrations && git commit              # commit it; Render applies it
```

Do **not** go back to `prisma db push` on a database that has real data — it
resolves drift by dropping things.

---

## Verifying a deploy

```bash
curl https://truehire-api.onrender.com/          # {"success":true,...}
curl https://truehire-ai.onrender.com/           # {"status":"ok"}
```

Then in the app: sign up → upload a résumé → start the OA. If the OA generates
questions, the full React → Express → FastAPI → Gemini chain and the shared JWT
secret are all working.

---

## Known gaps worth fixing next

1. **In-memory interview state** (see the warning at the top) — the main
   correctness limit. `RoundResult` already persists OA questions and results;
   the candidate profile and the agent's live Q&A are what remain.
2. **OTPs are stored in plaintext** and generated with `Math.random()`, which is
   not cryptographically secure. Use `crypto.randomInt`, store a hash, and rate
   limit verification — 6 digits is brute-forceable.
3. **Expired `PendingUser` / `PasswordResetOTP` rows are never cleaned up.** They
   are deleted on success, but abandoned signups accumulate forever and each one
   holds an email address's unique slot.
