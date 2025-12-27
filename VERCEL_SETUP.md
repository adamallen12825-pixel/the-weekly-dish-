# Vercel Environment Variables Setup

## CRITICAL: Your API keys were getting revoked because they were hardcoded in your files!

This has been fixed. Now you MUST set up environment variables in Vercel properly.

## Required Environment Variables for Vercel

Go to your Vercel project → Settings → Environment Variables and add:

### For Backend API (backend/api/index.js)

```
ANTHROPIC_API_KEY=your-new-anthropic-key-here
SQUARE_ACCESS_TOKEN=your-square-token-here
OPENAI_API_KEY=your-openai-key-here (if still using)
SQUARE_LOCATION_ID=your-square-location-id
SQUARE_SUBSCRIPTION_PLAN_ID=your-plan-id
UPC_DATABASE_KEY=your-upc-key (optional)
```

### For Web App (web-app)

```
REACT_APP_ANTHROPIC_API_KEY=your-new-anthropic-key-here
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsudGhld2Vla2x5LWRpc2guY29tJA
REACT_APP_API_URL=https://weekly-dish-api.vercel.app
REACT_APP_SQUARE_APPLICATION_ID=your-square-app-id
REACT_APP_SQUARE_LOCATION_ID=your-square-location-id
REACT_APP_SQUARE_ACCESS_TOKEN=your-square-access-token
```

## How to Add Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click on **Settings** tab
4. Click on **Environment Variables** in the sidebar
5. For each variable:
   - Enter the **Name** (e.g., `ANTHROPIC_API_KEY`)
   - Enter the **Value** (your actual API key)
   - Select which environments: **Production**, **Preview**, and **Development** (check all three)
   - Click **Save**

## After Adding Variables

1. **Redeploy** your project:
   - Go to Deployments tab
   - Click the three dots on the latest deployment
   - Select "Redeploy"

   OR

   - Make any small change to your code and push to trigger a new deployment

2. The new deployment will have access to the environment variables

## Getting New API Keys

### Anthropic (Claude)
- Go to: https://console.anthropic.com/settings/keys
- Click "Create Key"
- Copy and paste into Vercel (never into code files!)

### OpenAI (if needed)
- Go to: https://platform.openai.com/api-keys
- Click "Create new secret key"
- Copy and paste into Vercel (never into code files!)

### Square
- Go to: https://developer.squareup.com/apps
- Select your app
- Get your access token from credentials section

## Why This Happened

Your API keys were hardcoded in these files:
- ✅ FIXED: `apiConfig.js` (line 3)
- ✅ FIXED: `backend/api/index.js` (lines 21, 45, 110)
- ✅ FIXED: `web-app/.env` (line 1)
- ✅ FIXED: `backend/.env` (line 6)
- ✅ FIXED: `web-app/src/services/gptService.js` (line 3)

When you deployed to Vercel with hardcoded keys:
1. OpenAI/Anthropic's bots scanned your deployed code
2. They detected the API keys
3. They automatically revoked them for security

## What's Been Fixed

1. ✅ All hardcoded keys removed from code
2. ✅ Code now ONLY reads from `process.env`
3. ✅ `.gitignore` updated to protect `.env` files
4. ✅ No more fallback keys in code

## NEVER DO THIS AGAIN

❌ **WRONG:**
```javascript
const API_KEY = process.env.API_KEY || 'sk-ant-api03-...'
```

✅ **CORRECT:**
```javascript
const API_KEY = process.env.API_KEY
```

## Verification

After setup, check your Vercel deployment logs to make sure there are no errors about missing environment variables.

If you see errors like "API key is undefined", it means the environment variable wasn't set correctly in Vercel.
