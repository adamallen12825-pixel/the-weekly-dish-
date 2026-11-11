// Returns the current Clerk session token, used to authenticate API calls.
// Clerk exposes the active session on window.Clerk once ClerkProvider mounts,
// so services outside React can obtain a token without prop-drilling.
//
// Right after a page load Clerk may still be starting up. Waiting briefly for
// it avoids sending requests without a token (which the API rejects and which
// used to look like "your data is missing").
const READY_TIMEOUT_MS = 8000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getAuthToken() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const clerk = window.Clerk;
    if (clerk && clerk.loaded) {
      if (!clerk.session) return null; // Clerk is ready and nobody is signed in.
      try {
        return (await clerk.session.getToken()) || null;
      } catch {
        return null;
      }
    }
    await sleep(100);
  }
  return null;
}
