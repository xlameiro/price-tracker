export const APP_NAME = "Comparador de Precios";
export const APP_DESCRIPTION =
  "Compara precios en supermercados, farmacias y tiendas online de España. Encuentra el mejor precio por unidad de cualquier producto.";
export const APP_VERSION = "0.1.0";

// Keep in sync with the number of active scrapers in lib/scrapers/search/index.ts
export const STORE_COUNT = 23;

export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const ROUTES = {
  home: "/",
  search: "/search",
  signIn: "/auth/sign-in",
  signUp: "/auth/sign-up",
  dashboard: "/dashboard",
  products: "/dashboard/products",
  alerts: "/dashboard/alerts",
  addProduct: "/dashboard/add",
  settings: "/dashboard/settings",
  status: "/status",
  productDetail: (slug: string) => `/products/${slug}`,
} as const;

export const API_ROUTES = {
  auth: "/api/auth",
  health: "/api/health",
  products: "/api/products",
  prices: "/api/prices",
  tracked: "/api/tracked",
  trackDiscover: "/api/tracked/discover",
  alerts: "/api/alerts",
  stores: "/api/stores",
  scrape: "/api/scrape",
  discover: "/api/discover",
  search: "/api/search",
  status: "/api/status",
} as const;

export const SCRAPE_CRON_SECRET = process.env.SCRAPE_CRON_SECRET ?? "";

export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 20,
  maxPageSize: 100,
} as const;

// ─────────────────────────────────────────
// Store catalogue — all 25 stores covered
// ─────────────────────────────────────────

export const STORE_CATEGORIES = {
  supermarket: "Supermercados e Hipermercados",
  pharmacy: "Perfumerías y Parafarmacias",
  online: "Tiendas Online y Especializadas",
} as const;

export type StoreCategory = keyof typeof STORE_CATEGORIES;

export const STORES = [
  // Supermercados
  {
    slug: "mercadona",
    name: "Mercadona",
    category: "supermarket" as StoreCategory,
  },
  {
    slug: "carrefour",
    name: "Carrefour",
    category: "supermarket" as StoreCategory,
  },
  {
    slug: "alcampo",
    name: "Alcampo",
    category: "supermarket" as StoreCategory,
  },
  {
    slug: "elcorteingles",
    name: "El Corte Inglés",
    category: "supermarket" as StoreCategory,
  },
  {
    slug: "hipercor",
    name: "Hipercor",
    category: "supermarket" as StoreCategory,
  },
  {
    slug: "eroski",
    name: "Eroski / Vegalsa",
    category: "supermarket" as StoreCategory,
  },
  { slug: "aldi", name: "Aldi", category: "supermarket" as StoreCategory },
  {
    slug: "ahorramas",
    name: "Ahorramas",
    category: "supermarket" as StoreCategory,
  },
  { slug: "gadis", name: "Gadis", category: "supermarket" as StoreCategory },
  { slug: "froiz", name: "Froiz", category: "supermarket" as StoreCategory },
  {
    slug: "bm",
    name: "BM Supermercados",
    category: "supermarket" as StoreCategory,
  },
  {
    slug: "supermercado-familia",
    name: "Supermercados Familia",
    category: "supermarket" as StoreCategory,
  },
  // Perfumerías y parafarmacias
  { slug: "arenal", name: "Arenal", category: "pharmacy" as StoreCategory },
  { slug: "primor", name: "Primor", category: "pharmacy" as StoreCategory },
  { slug: "dosfarna", name: "DosFarma", category: "pharmacy" as StoreCategory },
  {
    slug: "atida",
    name: "Atida (MiFarma)",
    category: "pharmacy" as StoreCategory,
  },
  {
    slug: "farmaciasdirect",
    name: "Farmaciasdirect",
    category: "pharmacy" as StoreCategory,
  },
  {
    slug: "farmavazquez",
    name: "Farmavazquez",
    category: "pharmacy" as StoreCategory,
  },
  { slug: "viandvi", name: "Viandvi", category: "pharmacy" as StoreCategory },
  // Online y especializadas
  { slug: "amazon-es", name: "Amazon.es", category: "online" as StoreCategory },
  { slug: "nappy", name: "Nappy.es", category: "online" as StoreCategory },
  {
    slug: "maspanales",
    name: "Mas Pañales",
    category: "online" as StoreCategory,
  },
  {
    slug: "promofarma",
    name: "PromoFarma",
    category: "online" as StoreCategory,
  },
] as const;

export type StoreSlug = (typeof STORES)[number]["slug"];

// Dodot Sensitive size variants (T3–T6, all seeded in DB)
export const DODOT_PRODUCTS = [
  {
    slug: "dodot-sensitive-t5",
    name: "Pañales Dodot Sensitive Talla 5",
    size: "T5",
    kgRange: "11-16 kg",
  },
] as const;

export type DodotSlug = (typeof DODOT_PRODUCTS)[number]["slug"];

// Maps a product category (lowercase) to the label used for per-unit price display
export const CATEGORY_UNIT_LABELS: Readonly<Record<string, string>> = {
  pañales: "pañal",
  leche: "ml",
  agua: "L",
  aceite: "ml",
  refrescos: "ml",
  conservas: "g",
  cereales: "g",
  pasta: "g",
  arroz: "g",
  lácteos: "ml",
};
