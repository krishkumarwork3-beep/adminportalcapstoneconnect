/**
 * Single-flight session renewal (no imports, so the unit tests run it as is).
 *
 * `renew()` starts one refresh request; callers that ask while it is running share its answer, so
 * ten requests failing with 401 at once cause one POST /refresh, not ten (and a rotating refresh
 * token is never spent twice by the same page). When it fails, `onSignedOut` runs once.
 */
export function createRenewal(refresh: () => Promise<boolean>, onSignedOut: () => void): () => Promise<boolean> {
  let running: Promise<boolean> | null = null;
  return () => {
    if (!running) {
      running = refresh()
        .catch(() => false)
        .then((ok) => {
          if (!ok) onSignedOut();
          return ok;
        })
        .finally(() => {
          // Everyone who started together got this answer; the next expiry starts a new renewal.
          setTimeout(() => {
            running = null;
          }, 0);
        });
    }
    return running;
  };
}

/**
 * Sends a request; on 401 renews once and sends it again once. `skip` is for requests that are
 * themselves about signing in, where 401 is the answer, not an expired token.
 */
export async function sendWithRenewal(send: () => Promise<Response>, renew: () => Promise<boolean>, skip = false): Promise<Response> {
  const response = await send();
  if (response.status !== 401 || skip || !maySignedIn()) return response;
  return (await renew()) ? send() : response;
}


/**
 * Whether this browser has signed in (a boolean, never a token: the session itself lives only in
 * httpOnly cookies). A visitor who never signed in has no refresh cookie, so their 401s are not
 * renewed at all (no pointless POST /refresh); a signed-in page whose 15-minute access token ran
 * out renews as usual. Shared by every tab of the site; cleared on log-out and failed renewals.
 */
const SIGNED_IN = "capconnect_signed_in";

export function rememberSignedIn(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN, "1");
    else localStorage.removeItem(SIGNED_IN);
  } catch {
    // storage unavailable (private mode): renewals are then tried on every 401, which still works
  }
}

export function maySignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN) !== null;
  } catch {
    return true;
  }
}
