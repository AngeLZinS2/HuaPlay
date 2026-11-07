import api from './api';

export interface PublicCatalogData {
    heroFeatured: any | null;
    hasManagedHome: boolean;
    managedRows: Array<{ id: number; title: string; items: any[] }>;
    trending: any[];
    newReleases: any[];
    wuxiaRow: any[];
}

export const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const FETCH_TIMEOUT_MS = 15000;

let cachedPublicCatalog: { data: PublicCatalogData; timestamp: number } | null = null;
let inflightCatalogPromise: Promise<PublicCatalogData> | null = null;
let currentCacheGeneration = 0;
let inflightRequestId = 0;
let activeRequestId = 0;

export const formatSeriesItem = (item: any) => ({
    id: item.id,
    title: item.title,
    cover_image: item.cover_image,
    image: item.cover_image || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop',
    banner_image: item.banner_image,
    banner: item.banner_image,
    match: `${Math.min(99, 90 + ((Number(item.id) || 1) % 9))}% Relevante`, // Stable match percentage
    duration: `${item.release_year || '2024'}`,
    genre: item.genre || 'Dorama',
    description: item.description,
    trailer_url: item.trailer_url,
    release_year: item.release_year,
    cast: item.cast || 'Elenco não informado',
    moods: 'Envolvente, Emocionante',
});

export const formatSeriesList = (items: any[]) => (items || []).map(formatSeriesItem);

export function getCachedPublicCatalog(): { data: PublicCatalogData; isStale: boolean } | null {
    if (!cachedPublicCatalog) return null;
    const isStale = Date.now() - cachedPublicCatalog.timestamp > CATALOG_CACHE_TTL_MS;
    return { data: cachedPublicCatalog.data, isStale };
}

export function setCachedPublicCatalog(data: PublicCatalogData): void {
    cachedPublicCatalog = { data, timestamp: Date.now() };
}

export function clearCatalogCache(): void {
    cachedPublicCatalog = null;
    inflightCatalogPromise = null;
    currentCacheGeneration++;
}

export async function fetchPublicCatalogWithDedup(signal?: AbortSignal): Promise<PublicCatalogData> {
    if (!inflightCatalogPromise) {
        const generationAtStart = currentCacheGeneration;
        const internalController = new AbortController();
        const requestId = ++inflightRequestId;
        const timeoutId = setTimeout(() => {
            internalController.abort(new Error('Catalog fetch timeout'));
        }, FETCH_TIMEOUT_MS);

        const internalSignal = internalController.signal;

        const promise: Promise<PublicCatalogData> = (async () => {
            try {
                // Concurrent requests for hero and sections using internal timeout-controlled signal
                const [heroRes, sectionsRes] = await Promise.allSettled([
                    api.get('/series/hero-featured', { signal: internalSignal }),
                    api.get('/home/sections', { signal: internalSignal }),
                ]);

                // If completely aborted before finishing or between calls
                if (internalSignal.aborted) {
                    throw internalSignal.reason || new Error('Request aborted');
                }

                // Check if at least hero or sections succeeded; if not and aborted, fail
                const heroFeatured = heroRes.status === 'fulfilled' ? heroRes.value.data || null : null;
                let hasManagedHome = false;
                let managedRows: Array<{ id: number; title: string; items: any[] }> = [];
                let trending: any[] = [];
                let newReleases: any[] = [];
                let wuxiaRow: any[] = [];

                if (sectionsRes.status === 'fulfilled' && Array.isArray(sectionsRes.value.data) && sectionsRes.value.data.length > 0) {
                    hasManagedHome = true;
                    managedRows = sectionsRes.value.data.map((section: any) => ({
                        id: section.id,
                        title: section.title,
                        items: formatSeriesList(section.items || []),
                    }));
                } else {
                    // Fetch fallback catalog if sections not configured
                    const [allRes, wuxiaRes] = await Promise.allSettled([
                        api.get('/series/?limit=40', { signal: internalSignal }),
                        api.get('/series/?genre=Wuxia&limit=20', { signal: internalSignal }),
                    ]);

                    if (internalSignal.aborted) {
                        throw internalSignal.reason || new Error('Request aborted');
                    }

                    const anyFallbackOk = allRes.status === 'fulfilled' || wuxiaRes.status === 'fulfilled';
                    const anyInitialOk = heroRes.status === 'fulfilled' || sectionsRes.status === 'fulfilled';

                    // If total failure (everything rejected / network down / cancelled)
                    if (!anyFallbackOk && !anyInitialOk) {
                        throw new Error('Falha total ao buscar catálogo público');
                    }

                    if (allRes.status === 'fulfilled' && Array.isArray(allRes.value.data)) {
                        const allItems = formatSeriesList(allRes.value.data);
                        // Use deterministic sorting for stable image URLs and consistent browser cache
                        trending = allItems.slice(0, 18);
                        const sortedByYear = [...allItems].sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
                        newReleases = sortedByYear.slice(0, 18);
                    }

                    if (wuxiaRes.status === 'fulfilled' && Array.isArray(wuxiaRes.value.data)) {
                        wuxiaRow = formatSeriesList(wuxiaRes.value.data);
                    }
                }

                const catalogData: PublicCatalogData = {
                    heroFeatured,
                    hasManagedHome,
                    managedRows,
                    trending,
                    newReleases,
                    wuxiaRow,
                };

                // Only record fresh cache if this generation hasn't been invalidated
                if (generationAtStart === currentCacheGeneration) {
                    setCachedPublicCatalog(catalogData);
                }

                return catalogData;
            } finally {
                clearTimeout(timeoutId);
                if (activeRequestId === requestId) {
                    inflightCatalogPromise = null;
                }
            }
        })();

        activeRequestId = requestId;
        inflightCatalogPromise = promise;
    }

    const currentSharedPromise = inflightCatalogPromise;

    if (!signal) {
        return currentSharedPromise;
    }

    if (signal.aborted) {
        return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    }

    // Consumer cancellation cancels only the consumer's wait, without aborting the shared promise
    return new Promise<PublicCatalogData>((resolve, reject) => {
        const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            reject(signal.reason || new DOMException('Aborted', 'AbortError'));
        };

        signal.addEventListener('abort', onAbort);

        currentSharedPromise
            .then((data) => {
                signal.removeEventListener('abort', onAbort);
                resolve(data);
            })
            .catch((err) => {
                signal.removeEventListener('abort', onAbort);
                reject(err);
            });
    });
}
