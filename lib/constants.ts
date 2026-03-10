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
/**
 * Maps product category (lowercase) to the unit label used in per-unit price display.
 *
 * Values mean:
 *  "pañal" / "ud." / "toallita" → discrete item count  (€/pañal, €/ud., €/toallita)
 *  "g"  / "kg"                   → weight comparison     (€/kg)
 *  "ml" / "l"                    → volume comparison     (€/l)
 */
export const CATEGORY_UNIT_LABELS: Readonly<Record<string, string>> = {
  // ── Bebés ──────────────────────────────────────────────────────────────
  pañales: "pañal",
  toallitas: "toallita",
  "toallitas bebé": "toallita",
  "leche infantil": "ml",
  "leche maternizada": "ml",
  "papillas bebé": "g",
  papillas: "g",

  // ── Lácteos y bebidas frías ────────────────────────────────────────────
  leche: "ml",
  lácteos: "ml",
  yogur: "ud.",
  queso: "g",
  mantequilla: "g",
  nata: "ml",
  kéfir: "ml",
  "bebidas vegetales": "ml",
  bebidas: "ml",

  // ── Agua y refrescos ──────────────────────────────────────────────────
  agua: "L",
  refrescos: "ml",
  "bebidas carbonatadas": "ml",
  zumos: "ml",
  zumo: "ml",
  "agua con gas": "L",
  "bebidas energéticas": "ml",
  cerveza: "ml",
  vino: "ml",
  cava: "ml",
  sidra: "ml",
  "bebidas alcohólicas": "ml",
  licores: "ml",
  "bebidas calientes": "g",
  café: "g",
  infusiones: "g",

  // ── Aceites, salsas y condimentos ─────────────────────────────────────
  aceite: "ml",
  "aceite de oliva": "ml",
  vinagre: "ml",
  salsas: "ml",
  "salsas y condimentos": "ml",

  // ── Alimentación seca ─────────────────────────────────────────────────
  cereales: "g",
  pasta: "g",
  arroz: "g",
  legumbres: "g",
  "harina y levadura": "g",
  harina: "g",
  azúcar: "g",
  sal: "g",
  "frutos secos": "g",
  muesli: "g",
  "copos de avena": "g",
  galletas: "g",
  pan: "g",
  "pan de molde": "g",
  tostadas: "g",
  snacks: "g",
  "aperitivos y snacks": "g",
  chocolates: "g",
  "chocolates y dulces": "g",
  "helados y postres": "g",

  // ── Conservas y enlatados ─────────────────────────────────────────────
  conservas: "g",
  "conservas de pescado": "g",
  "conservas vegetales": "g",
  atún: "g",
  sardinas: "g",

  // ── Carne y pescado ───────────────────────────────────────────────────
  carne: "g",
  "carne y aves": "g",
  pollo: "g",
  ternera: "g",
  cerdo: "g",
  embutidos: "g",
  charcutería: "g",
  pescado: "g",
  "pescado y marisco": "g",
  marisco: "g",

  // ── Frutas y verduras ─────────────────────────────────────────────────
  frutas: "g",
  verduras: "g",
  "frutas y verduras": "g",
  "fruta fresca": "g",
  "verdura fresca": "g",

  // ── Mermeladas, mieles y untables ─────────────────────────────────────
  mermeladas: "g",
  mermelada: "g",
  miel: "g",

  // ── Higiene personal ──────────────────────────────────────────────────
  higiene: "ud.",
  "higiene personal": "ud.",
  gel: "ml",
  "gel de ducha": "ml",
  champú: "ml",
  acondicionador: "ml",
  "pasta de dientes": "ml",
  desodorante: "ml",
  crema: "ml",
  "crema corporal": "ml",
  "crema facial": "ml",
  jabón: "ml",
  compresas: "ud.",
  tampones: "ud.",
  "papel higiénico": "ud.",
  pañuelos: "ud.",
  "pañuelos faciales": "ud.",

  // ── Limpieza del hogar ────────────────────────────────────────────────
  limpieza: "ud.",
  "limpieza hogar": "ud.",
  "higiene del hogar": "ud.",
  detergente: "ml",
  "detergente ropa": "ml",
  "detergente lavavajillas": "ml",
  lavavajillas: "ml",
  suavizante: "ml",
  "lejía y desinfectantes": "ml",
  lejía: "ml",
  "limpiadores multiusos": "ml",
  "bolsas de basura": "ud.",
  "papel de cocina": "ud.",
};
