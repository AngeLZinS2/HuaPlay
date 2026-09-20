/**
 * Kept for backwards compatibility with existing imports.
 * The Series type now comes from the generated OpenAPI schema instead of a
 * hand-maintained interface that could silently drift from the backend.
 */
export type { Series } from '../types/models';
export { getSeries, getSeriesById } from './api';
