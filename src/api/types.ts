export interface RateLimitHeaders {
  'x-ratelimit-limit'?: string;
  'x-ratelimit-remaining'?: string;
}

export interface ApiError {
  message: string;
}

export interface ValidationError extends ApiError {
  errors: Record<string, string[]>;
}

export const SERVICE_IDS = [
  'startru',
  'moretv',
  'premierone',
  'iviru',
  'kinopoiskru',
  'filmua',
  'souzmultru',
  'uzbektv',
  'pamg',
  'mediateka',
  'unicoplaycom',
  'mediatekafree',
] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export const BLOCK_TYPES = ['slider', 'list', 'list_horizontal', 'numeric', 'action_list', 'images', 'promo'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Block types that carry contentCard items, in the `block` (GET .../blocks/{id}) response's
 * own vocabulary. Note the `blockSummary` (GET /pages/{slug}) endpoint uses a DIFFERENT
 * vocabulary for the same types — it reports `list_horizontal`/`numeric` as
 * `small_list`/`counter` — so this set must never be used to filter `page.items` directly.
 */
export const TITLE_BLOCK_TYPES = new Set<BlockType>(['slider', 'list', 'list_horizontal', 'numeric', 'action_list']);

export interface BlockSummary {
  id: string;
  title: string;
  type: BlockType | 'small_list' | 'counter' | 'channel_group';
  block_url: string;
  count?: number;
  protected?: boolean;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  items: BlockSummary[];
}

export interface ContentCard {
  id: string;
  kind: 'movie' | 'series';
  service: string;
  title: string;
  description: string;
  year: string | null;
  genres: string[];
  runtime: number | null;
  ratings: { kinopoisk: number | null; imdb: number | null };
  images: { poster: string | null; landscape: string | null };
  playable: boolean;
  favorite: boolean;
  progress: null;
  details_url: string | null;
}

export interface ImageCard {
  image: string;
  link: string;
}

export interface Block {
  id: string;
  title: string;
  type: BlockType;
  count: number;
  items: Array<ContentCard | ImageCard>;
  block_data?: Record<string, unknown>;
}

export interface RadioCard {
  id: string;
  kind: 'radio' | 'channel';
  title: string;
  images: { logo: string | null; background: string | null };
  playable: boolean;
  favorite: boolean;
  capabilities: { archive: boolean; timeshift: boolean };
  access: { protected: boolean; hidden: boolean };
  play_url?: string;
}

export interface RadioGroupBlock {
  id: string;
  title: string;
  type: 'channel_group';
  count: number;
  protected: boolean;
  items: RadioCard[];
}

export interface ChannelStream {
  url: string;
}

export interface PlaybackStream {
  url: string;
  markers: Record<string, { start: number; end: number }> | null;
  vmap: null;
}

export interface LoginResponse {
  login: number;
  expire_at: number;
  packet: { id: number; title: string; type: string; share_links: null };
  security: string;
  services: string;
  settings: string;
}

export interface Service {
  id: ServiceId;
  type: 'video' | 'audio';
  name: string;
  description: string;
  status: 'available' | 'unavailable';
  images: {
    logo: { square: string | null; wide: string | null };
    poster: string | null;
    background: string | null;
  };
  access: { state: 'unsubscribed'; subscription_id: null };
  pages_url: null;
  credentials_url: null;
}

export interface Setting<T extends string | number> {
  value: T;
  allowed: Array<{ value: T; label: string }>;
}

export interface Settings {
  standard: Setting<string>;
  server: Setting<string>;
  timeshift: Setting<number>;
  catchup: { enabled: 0 | 1; delay: number; length: number };
}

export interface Episode {
  id: string | null;
  kind: 'episode';
  number: number;
  title: string;
  description: string | null;
  runtime: number | null;
  images: { landscape: string | null };
  progress: null;
  playable: boolean;
  play_url: string | null;
}

export interface Season {
  id: string;
  number: number | null;
  title: string;
  episode_count: number;
  episodes: Episode[];
}

export interface ContentDetails {
  id: string;
  service: string;
  kind: 'movie' | 'series';
  title: { original: string; display: string; short: string };
  description: { short: string; full: string };
  year: string | null;
  runtime: number | null;
  age_rating: number | null;
  genres: string[];
  countries: string[];
  directors: string[];
  actors: string[];
  ratings: { kinopoisk: number | null; imdb: number | null };
  images: { poster: string | null; landscape: string | null; logo: null; frames: string[] };
  playable: boolean;
  favorite: boolean;
  progress: {
    position: 0;
    duration: number | null;
    completed: false;
    updated_at: null;
    target: { id: string; kind: 'movie' | 'series' };
  };
  trailers: unknown[];
  seasons: Season[];
  play_url: string | null;
}
