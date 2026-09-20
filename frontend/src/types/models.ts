/**
 * Ergonomic aliases over the generated OpenAPI schema.
 *
 * Do not hand-edit `api.d.ts` — it is generated from the live FastAPI schema:
 *     npm run gen:api        (backend must be running)
 *
 * Importing from here instead of writing `any` is what makes a backend contract
 * change show up as a compile error rather than a runtime 404.
 */
import type { components } from './api';

type Schemas = components['schemas'];

export type Series = Schemas['Series'];
export type SeriesCreate = Schemas['SeriesCreate'];
export type Episode = Schemas['Episode'];
export type EpisodeCreate = Schemas['EpisodeCreate'];
export type Actor = Schemas['Actor'];
export type ActorCreate = Schemas['ActorCreate'];
// Identity and per-user data now live in Firebase, not in this API. The user
// type comes from firebase/auth and profiles from services/userData.
export type FeaturedConfigResponse = Schemas['FeaturedConfigResponse'];
export type FeaturedConfigCreate = Schemas['FeaturedConfigCreate'];
// Watch history is Firestore's now — see WatchEntry in services/userData.

/** Aggregate returned by GET /series/stats (untyped dict on the backend). */
export interface SeriesStats {
    total: number;
    completed: number;
    ongoing: number;
    types: Record<string, number>;
}

/** Payload of GET /series/recommendations. */
export interface Recommendations {
    recommendations: Series[];
    because_you_watched: { base_series: Series; recommendations: Series[] } | null;
    is_personalized: boolean;
}
