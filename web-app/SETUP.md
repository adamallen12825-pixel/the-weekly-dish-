# The Weekly Dish - Environment Setup

## Required Environment Variables

You MUST set these environment variables for the app to work:

### 1. OpenAI API Key (REQUIRED)
```
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Clerk Keys (Already Set)
```
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsudGhld2Vla2x5LWRpc2guY29tJA
```

## Setting Environment Variables

### For Local Development

Create a `.env.local` file in the `web-app` folder:
```bash
# web-app/.env.local
REACT_APP_OPENAI_API_KEY=sk-...your_actual_openai_key_here
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsudGhld2Vla2x5LWRpc2guY29tJA
```

### For Vercel Production

1. Go to your Vercel Dashboard
2. Select your project "The Weekly Dish"
3. Go to Settings → Environment Variables
4. Add these variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| REACT_APP_OPENAI_API_KEY | sk-...your_key | Production |
| REACT_APP_CLERK_PUBLISHABLE_KEY | pk_live_Y2xlcmsudGhld2Vla2x5LWRpc2guY29tJA | Production |

## Getting Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Log in or create an account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)
5. Add it to Vercel environment variables

## Important Notes

- The key MUST start with `sk-` for OpenAI
- In React apps, environment variables MUST start with `REACT_APP_`
- After adding to Vercel, you need to redeploy for changes to take effect
- Never commit API keys to git

## Verify It's Working

After setting up, check the browser console. If you see:
- "API error 401" = Invalid API key
- "API error 404" = Wrong endpoint or model
- "API error 429" = Rate limit exceeded
- No error = Working correctly!