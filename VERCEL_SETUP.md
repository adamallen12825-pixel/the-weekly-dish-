# Deployment Setup — The Weekly Dish

The app is a **single Vercel project**: the React app in `web-app/` plus the
serverless API in `api/`. There is no separate backend anymore.

## Required Vercel environment variables

Set these in the Vercel project (Settings → Environment Variables). They are
**server-side only** — never prefix secrets with `REACT_APP_`.

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `api/ai.js` | Claude API key. **Server-side only.** |
| `CLERK_SECRET_KEY` | auth on every protected endpoint, user count, account deletion | Clerk secret key. |
| `UPSTASH_REDIS_REST_URL` | all stored data, rate limits, share links | From the Vercel Marketplace Redis (Upstash) integration. `KV_REST_API_URL` also works. **Required**: the deployed API refuses to run without it rather than lose data. |
| `UPSTASH_REDIS_REST_TOKEN` | same | Redis token. `KV_REST_API_TOKEN` also works. |
| `SQUARE_ACCESS_TOKEN` | payments | Square secret. **Server-side only.** |
| `SQUARE_ENVIRONMENT` | payments | `sandbox` (default) or `production`. Set to `production` to take real payments. |
| `SQUARE_LOCATION_ID` | payments | Square location. |
| `SQUARE_SUBSCRIPTION_PLAN_ID` | payments | The Square subscription **plan variation** ID. The price lives in Square. |
| `UPC_DATABASE_KEY` | `api/barcode/[barcode].js` | Optional barcode fallback. |

### Optional settings

| Variable | Default | What it does |
|---|---|---|
| `AI_MODEL` | `claude-sonnet-5-5` | Which Claude model writes plans, lists and recipes. `claude-opus-5-5` gives the highest quality at roughly twice the cost per request. |
| `AI_LIMIT_MULTIPLIER` | `1` | Scales every per-user daily AI allowance (see `TASKS` in `api/_lib/ai/tasks.js`). `2` doubles them, `0.5` halves them. |
| `REQUIRE_SUBSCRIPTION` | off | Set to `true` to turn the paywall on: AI features then need an active subscription or an unexpired free trial. Leave unset during the free beta. |
| `FREE_TRIAL_DAYS` | `7` | Length of the free trial from sign-up, used only when `REQUIRE_SUBSCRIPTION=true`. `0` means no trial. |
| `SQUARE_TIMEZONE` | `America/Chicago` | Time zone Square uses for billing dates. |
| `APP_ORIGINS` | production + localhost | Comma-separated origins allowed to call the API from a browser. |

### Frontend build-time vars (safe to expose — public only)

| Variable | Notes |
|---|---|
| `REACT_APP_CLERK_PUBLISHABLE_KEY` | Clerk publishable (public) key. |
| `REACT_APP_API_URL` | **Leave empty / unset.** The API is same-origin (`/api/...`). |
| `REACT_APP_SQUARE_APPLICATION_ID` | Public Square app ID (browser SDK). |
| `REACT_APP_SQUARE_LOCATION_ID` | Public Square location ID. |
| `REACT_APP_SQUARE_ENVIRONMENT` | `production` when taking real payments; anything else loads Square's sandbox card form. Must match `SQUARE_ENVIRONMENT`. |

> If a `REACT_APP_API_URL` pointing at `weekly-dish-api.vercel.app` is set in
> Vercel, delete it — the separate backend project is gone and all API calls now
> run on the main site.

## Before you start charging

1. **Rotate the old OpenAI key** in the OpenAI dashboard if that has not been
   done: it was compiled into an old public web bundle and must be treated as
   compromised. (The app no longer uses OpenAI.)
2. Confirm the **Redis (Upstash)** integration and `ANTHROPIC_API_KEY` are set
   for Production.
3. **Test payments in the Square sandbox** end to end: subscribe with a
   [sandbox test card](https://developer.squareup.com/docs/devtools/sandbox/payments),
   check the Subscribe page shows "active", cancel, and check it shows the end
   date. Try subscribing twice: the second attempt must report that you are
   already subscribed.
4. In the Square Developer Dashboard add a **webhook subscription** for
   `subscription.updated` pointing at
   `https://www.theweekly-dish.com/api/payments/webhook`, so renewals, failed
   payments and cancellations reach the app promptly. (The app also re-checks
   each subscription with Square once a day as a safety net.)
5. Go live: set `SQUARE_ENVIRONMENT=production` and
   `REACT_APP_SQUARE_ENVIRONMENT=production` with the production Square
   credentials, then set `REQUIRE_SUBSCRIPTION=true` and redeploy.
6. Update the wording on the home page and Terms ("Currently in Beta - Free to
   use!") to match what you are charging.

## How the AI is protected

- The browser never sends a prompt. It names a task (`mealPlan`,
  `shoppingList`, `recipe`, ...) and sends the household's data; the prompts
  live in `api/_lib/ai/prompts.js`.
- Every account has a daily allowance per task and a per-minute burst limit.
  Failed requests are not counted.
- Replies use structured outputs, and code checks the result (seven days, the
  chosen meal types, the budget, avoided foods). If a check fails the model
  gets one correction pass naming exactly what was wrong.

## Tests

```bash
npm test                                   # API and AI logic (no network needed)
```

```bash
cd web-app && CI=true npm test -- --watchAll=false
```

End-to-end, in a real browser, with sign-in and the AI replaced by stand-ins:

```bash
npm run build --prefix web-app
```

```bash
node tests/e2e/server.js
```

```bash
node tests/e2e/smoke.js
```

## Local development

```bash
cd web-app
npm install
npm start        # web app on http://localhost:3000
```

`web-app/.env` holds local, public build-time values only. Server-side secrets
are read from your Vercel environment (or a local `.env` in the project root
when running the functions locally with `vercel dev`).
