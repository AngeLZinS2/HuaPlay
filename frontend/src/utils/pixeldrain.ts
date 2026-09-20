/**
 * Pixeldrain serves the raw file at /api/file/{id} with Accept-Ranges: bytes and
 * permissive CORS, so a plain <video> element can play and seek it. That is what
 * makes real playback progress possible for ~94% of the catalog — unlike Drive
 * and Mega, whose embeds expose no player API at all.
 */

/** Extracts the file id from any Pixeldrain URL shape we store. */
export function getPixeldrainId(url: string | null | undefined): string | null {
    if (!url) return null;
    const match = url.match(/pixeldrain\.com\/(?:u|api\/file)\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
}

export function isPixeldrainUrl(url: string | null | undefined): boolean {
    return getPixeldrainId(url) !== null;
}

/** Direct media URL playable by a native <video> element. */
export function toPixeldrainDirect(url: string | null | undefined): string | null {
    const id = getPixeldrainId(url);
    return id ? `https://pixeldrain.com/api/file/${id}` : null;
}
