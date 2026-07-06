// Returns the current Clerk session token, used to authenticate API calls.
// Clerk exposes the active session on window.Clerk once ClerkProvider mounts,
// so services outside React can obtain a token without prop-drilling.
export async function getAuthToken() {
  try {
    return (await window.Clerk?.session?.getToken()) || null;
  } catch {
    return null;
  }
}
