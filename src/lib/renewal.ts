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
  if (response.status !== 401 || skip) return response;
  return (await renew()) ? send() : response;
}
