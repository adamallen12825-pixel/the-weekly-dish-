# Social Authentication Setup for Clerk

## Steps to Enable Apple and Facebook Sign-In

### 1. Access Clerk Dashboard
Go to https://dashboard.clerk.com and sign in to your account.

### 2. Navigate to Social Connections
- Select your application (The Weekly Dish)
- Go to "User & Authentication" → "Social Connections"

### 3. Enable Apple Sign-In
1. Click on "Apple" in the list of providers
2. Toggle the switch to enable Apple authentication
3. You'll need to provide:
   - **Services ID**: Your Apple Services ID (e.g., com.theweeklydish.web)
   - **Team ID**: Your Apple Developer Team ID
   - **Key ID**: Your Sign in with Apple Key ID
   - **Private Key**: Your .p8 private key file content

   If you don't have these yet:
   - Go to https://developer.apple.com
   - Create a Services ID for "Sign in with Apple"
   - Configure the domain (theweekly-dish.com) and return URL
   - Download the private key

4. Save the configuration

### 4. Enable Facebook Sign-In
1. Click on "Facebook" in the list of providers
2. Toggle the switch to enable Facebook authentication
3. You'll need to provide:
   - **App ID**: Your Facebook App ID
   - **App Secret**: Your Facebook App Secret

   If you don't have these yet:
   - Go to https://developers.facebook.com
   - Create a new app (or use existing)
   - Choose "Consumer" as the app type
   - Add "Facebook Login" product
   - Configure OAuth Redirect URI: https://your-clerk-frontend-api.clerk.accounts.dev/v1/oauth_callback
   - Get your App ID and App Secret from Settings → Basic

4. Save the configuration

### 5. Configure OAuth Redirect URIs

#### For Apple:
Add these URLs in Apple Developer Console:
- Domain: theweekly-dish.com
- Return URLs: 
  - https://your-clerk-frontend-api.clerk.accounts.dev/v1/oauth_callback
  - https://theweekly-dish.com/auth-redirect

#### For Facebook:
Add these in Facebook App Settings → Facebook Login → Settings:
- Valid OAuth Redirect URIs:
  - https://your-clerk-frontend-api.clerk.accounts.dev/v1/oauth_callback
  - https://theweekly-dish.com/auth-redirect

### 6. Test the Integration
1. Deploy the latest code to Vercel
2. Visit https://theweekly-dish.com/sign-in
3. You should see buttons for:
   - Continue with Apple
   - Continue with Facebook
   - Continue with Google (if already enabled)

### 7. Production Checklist
- [ ] Apple Services ID created and configured
- [ ] Apple private key uploaded to Clerk
- [ ] Facebook App created and approved
- [ ] Facebook App ID and Secret added to Clerk
- [ ] OAuth redirect URLs configured for both providers
- [ ] Custom sign-in/sign-up components deployed
- [ ] Tested sign-in flow for both providers

## Notes
- The custom sign-in components (CustomSignIn.js and CustomSignUp.js) are already configured with proper styling
- Social buttons will automatically appear once enabled in Clerk dashboard
- The redirect URL after sign-in is set to `/auth-redirect` which handles profile setup