/**
 * Single-flight session renewal (no imports, so the unit tests run it as is).
 *
 * `renew()` starts one refresh request; callers that ask while it is running share its answer, so
 * ten requests failing with 401 at once cause one POST /refresh, not ten (and a rotating refresh
 * token is never spent twice by the same page).
 *
 * The refresh answers one of three things:
 * - "ok": a new access token; the failed request is sent again.
 * - "expired" (HTTP 401 only): the session is over; `onSignedOut` runs once.
 * - "unavailable" (429, 5xx, offline): the session may well be fine. The user stays signed in,
 *   the caller gets its original error, and no new refresh is tried until `retryAfter` seconds
 *   have passed (the server's Retry-After, else a few seconds).
 */
export type RefreshResult = { state: "ok" } | { state: "expired" } | { state: "unavailable"; retryAfter?: number };

export async function classifyRefresh(send: () => Promise<Response>): Promise<RefreshResult> {
  try {
    const answer = await send();
    if (answer.ok) return { state: "ok" };
    if (answer.status === 401) return { state: "expired" };
    const wait = Number(answer.headers.get("retry-after"));
    return { state: "unavailable", retryAfter: Number.isFinite(wait) && wait > 0 ? wait : undefined };
  } catch {
    return { state: "unavailable" };
  }
}

const DEFAULT_BACKOFF_SECONDS = 5;

export function createRenewal(
  refresh: () => Promise<RefreshResult>,
  onSignedOut: () => void,
  now: () => number = () => Date.now()
): () => Promise<boolean> {
  let running: Promise<boolean> | null = null;
  let quietUntil = 0;
  return () => {
    if (running) return running;
    if (now() < quietUntil) return Promise.resolve(false); // backing off: keep the session, report the error
    running = refresh()
      .catch((): RefreshResult => ({ state: "unavailable" }))
      .then((result) => {
        if (result.state === "expired") onSignedOut();
        if (result.state === "unavailable") quietUntil = now() + (result.retryAfter ?? DEFAULT_BACKOFF_SECONDS) * 1000;
        return result.state === "ok";
      })
      .finally(() => {
        // Everyone who started together got this answer; the next expiry starts a new renewal.
        setTimeout(() => {
          running = null;
        }, 0);
      });
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
