export const APP_NAME = "Price Tracker";
export const APP_DESCRIPTION =
  "Compara precios de productos en las principales tiendas españolas y recibe alertas cuando baja el precio.";
export const APP_VERSION = "0.1.0";

export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const ROUTES = {
  home: "/",
  signIn: "/auth/sign-in",
  signUp: "/auth/sign-up",
  dashboard: "/dashboard",
  products: "/dashboard/products",
  alerts: "/dashboard/alerts",
  addProduct: "/dashboard/add",
  settings: "/dashboard/settings",
} as const;

export const API_ROUTES = {
  auth: "/api/auth",
  health: "/api/health",
  products: "/api/products",
  prices: "/api/prices",
  tracked: "/api/tracked",
  alerts: "/api/alerts",
  stores: "/api/stores",
  scrape: "/api/scrape",
} as const;

export const SCRAPE_CRON_SECRET = process.env.SCRAPE_CRON_SECRET ?? "";

export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 20,
  maxPageSize: 100,
} as const;

export const STORES = [
  { slug: "amazon-es", name: "Amazon.es" },
  { slug: "carrefour", name: "Carrefour" },
  { slug: "elcorteingles", name: "El Corte Inglés" },
  { slug: "pccomponentes", name: "PcComponentes" },
  { slug: "mercadona", name: "Mercadona" },
  { slug: "alcampo", name: "Alcampo" },
  { slug: "lidl", name: "Lidl" },
  { slug: "mediamarkt", name: "MediaMarkt" },
  { slug: "eroski", name: "Eroski" },
  { slug: "gadis", name: "Gadis" },
  { slug: "pepco", name: "Pepco" },
  { slug: "froiz", name: "Froiz" },
  { slug: "arenal", name: "Arenal" },
] as const;

export type StoreSlug = (typeof STORES)[number]["slug"];
