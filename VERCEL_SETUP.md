# Deployment Setup — The Weekly Dish

The app is a **single Vercel project**: the React app in `web-app/` plus the
serverless API in `api/`. There is no separate backend anymore.

## Required Vercel environment variables

Set these in the Vercel project (Settings → Environment Variables). They are
**server-side only** — never prefix secrets with `REACT_APP_`.

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `api/ai.js` | Claude API key. **Server-side only.** This replaces the old OpenAI key. |
| `CLERK_SECRET_KEY` | auth on every protected endpoint, user count | Clerk secret key. |
| `UPSTASH_REDIS_REST_URL` | `api/kv.js` | From the Vercel Marketplace Redis (Upstash) integration. `KV_REST_API_URL` also works. |
| `UPSTASH_REDIS_REST_TOKEN` | `api/kv.js` | Redis token. `KV_REST_API_TOKEN` also works. |
| `SQUARE_ACCESS_TOKEN` | payments | Square secret. **Server-side only.** |
| `SQUARE_ENVIRONMENT` | payments | `sandbox` (default) or `production`. Set to `production` to take real payments. |
| `SQUARE_LOCATION_ID` | payments | Square location. |
| `SQUARE_SUBSCRIPTION_PLAN_ID` | payments | The Square subscription **plan variation** ID. |
| `UPC_DATABASE_KEY` | `api/barcode/[barcode].js` | Optional barcode fallback. |
| `SUBSCRIPTION_PORTAL_URL` | payments | Optional URL for the "manage subscription" button. |

### Frontend build-time vars (safe to expose — public only)

| Variable | Notes |
|---|---|
| `REACT_APP_CLERK_PUBLISHABLE_KEY` | Clerk publishable (public) key. |
| `REACT_APP_API_URL` | **Leave empty / unset.** The API is same-origin (`/api/...`). |
| `REACT_APP_SQUARE_APPLICATION_ID` | Public Square app ID (browser SDK). |
| `REACT_APP_SQUARE_LOCATION_ID` | Public Square location ID. |

> If a `REACT_APP_API_URL` pointing at `weekly-dish-api.vercel.app` is set in
> Vercel, delete it — the separate backend project is gone and all API calls now
> run on the main site.

## One-time actions before launch

1. **Rotate the OpenAI key** in the OpenAI dashboard — the previous key was
   compiled into an old public web bundle and must be treated as compromised.
   (The app no longer uses OpenAI.)
2. Provision the **Redis (Upstash)** integration and set its env vars.
3. Set `ANTHROPIC_API_KEY`.
4. For live payments: set `SQUARE_ENVIRONMENT=production` with production Square
   credentials, and test the subscription flow end-to-end in the Square sandbox
   first.

## Local development

```bash
cd web-app
npm install
npm start        # web app on http://localhost:3000
```

`web-app/.env` holds local, public build-time values only. Server-side secrets
are read from your Vercel environment (or a local `.env` in the project root
when running the functions locally with `vercel dev`).
