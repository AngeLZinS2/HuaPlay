/**
 * Native <video> playback for Pixeldrain sources.
 *
 * DISABLED: Pixeldrain blocks hotlinking on free accounts. A browser always
 * sends "Sec-Fetch-Site: cross-site" on a cross-origin media request and that
 * header cannot be altered from JavaScript, so the direct file URL answers 403
 * ({"value":"hotlink_detected"}) for every visitor. Server-side tools like curl
 * do not send the header, which is why it appeared to work when tested outside
 * a browser.
 *
 * Their own /u/ page still works inside an iframe, so that is what we use.
 * Set this to true only if the account hosting the files has Pixeldrain Pro,
 * which is what lifts the hotlink restriction.
 */
export const PREFER_NATIVE_PIXELDRAIN = false;
