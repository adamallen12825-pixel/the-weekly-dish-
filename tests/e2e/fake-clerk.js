// A minimal stand-in for the Clerk browser SDK, injected before the app loads
// in end-to-end tests. It presents one signed-in user whose session token the
// test server accepts. Set window.__E2E_SIGNED_OUT = true for a signed-out run.
(() => {
  const signedOut = Boolean(window.__E2E_SIGNED_OUT);
  const userId = window.__E2E_USER_ID || 'user_e2e';
  const user = signedOut
    ? null
    : {
        id: userId,
        firstName: 'Sam',
        lastName: 'Tester',
        fullName: 'Sam Tester',
        primaryEmailAddress: { emailAddress: 'sam@example.com' },
        emailAddresses: [{ emailAddress: 'sam@example.com' }],
        publicMetadata: {},
        unsafeMetadata: {},
        update: async () => user,
        reload: async () => user,
        delete: async () => {},
      };
  const session = signedOut
    ? null
    : { id: 'sess_e2e', status: 'active', user, getToken: async () => `test-token:${userId}`, lastActiveToken: null };
  const listeners = [];
  const state = () => ({ client: clerk.client, session, user, organization: null });
  const noop = () => {};
  const mount = (label) => (node) => {
    if (node) node.textContent = label;
  };

  const clerk = {
    loaded: false,
    status: 'loading',
    version: '5.99.0',
    sdkMetadata: { name: 'e2e', version: '0' },
    user,
    session,
    organization: null,
    client: { sessions: session ? [session] : [], signedInSessions: session ? [session] : [], signIn: {}, signUp: {} },
    isSignedIn: !signedOut,
    load: async () => {
      clerk.loaded = true;
      clerk.status = 'ready';
      listeners.forEach((listener) => listener(state()));
    },
    addListener: (listener) => {
      listeners.push(listener);
      listener(state());
      return noop;
    },
    on: noop,
    off: noop,
    signOut: async () => {
      window.__E2E_SIGNED_OUT_CALLED = true;
    },
    navigate: async (to) => {
      window.location.assign(to);
    },
    setActive: async () => {},
    mountUserButton: mount('[account]'),
    unmountUserButton: noop,
    mountSignIn: mount('[sign-in form]'),
    unmountSignIn: noop,
    mountSignUp: mount('[sign-up form]'),
    unmountSignUp: noop,
    buildSignInUrl: () => '/sign-in',
    buildSignUpUrl: () => '/sign-up',
    buildAfterSignInUrl: () => '/auth-redirect',
    buildAfterSignUpUrl: () => '/auth-redirect',
    buildUrlWithAuth: (url) => url,
    __unstable__updateProps: async () => {},
    __internal_getOption: () => undefined,
    telemetry: { record: noop, recordLog: noop, isEnabled: false, isDebug: false },
  };
  window.Clerk = clerk;
})();
