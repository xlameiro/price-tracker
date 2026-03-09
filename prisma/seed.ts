import { db } from "@/lib/db";

// ─────────────────────────────────────────
// Stores — all 25 covered providers
// ─────────────────────────────────────────

const STORES = [
  // Supermercados e Hipermercados
  {
    name: "Mercadona",
    slug: "mercadona",
    type: "PHYSICAL" as const,
    websiteUrl: "https://tienda.mercadona.es",
    logoUrl: "https://logo.clearbit.com/mercadona.es",
    freeShippingThreshold: null,
    shippingNote: "Solo recogida en tienda",
    isActive: true,
  },
  {
    name: "Carrefour",
    slug: "carrefour",
    type: "BOTH" as const,
    websiteUrl: "https://www.carrefour.es",
    logoUrl: "https://logo.clearbit.com/carrefour.es",
    freeShippingThreshold: 30,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Alcampo",
    slug: "alcampo",
    type: "BOTH" as const,
    websiteUrl: "https://www.alcampo.es",
    logoUrl: "https://logo.clearbit.com/alcampo.es",
    freeShippingThreshold: 50,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "El Corte Inglés",
    slug: "elcorteingles",
    type: "BOTH" as const,
    websiteUrl: "https://www.elcorteingles.es",
    logoUrl: "https://logo.clearbit.com/elcorteingles.es",
    freeShippingThreshold: 30,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Hipercor",
    slug: "hipercor",
    type: "BOTH" as const,
    websiteUrl: "https://www.hipercor.es",
    logoUrl: "https://logo.clearbit.com/hipercor.es",
    freeShippingThreshold: 30,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Eroski / Vegalsa",
    slug: "eroski",
    type: "BOTH" as const,
    websiteUrl: "https://supermercado.eroski.es",
    logoUrl: "https://logo.clearbit.com/eroski.es",
    freeShippingThreshold: 49,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Aldi",
    slug: "aldi",
    type: "PHYSICAL" as const,
    websiteUrl: "https://www.aldi.es",
    logoUrl: "https://logo.clearbit.com/aldi.es",
    freeShippingThreshold: null,
    shippingNote: "Solo disponibilidad según catálogo",
    isActive: true,
  },
  {
    name: "Ahorramas",
    slug: "ahorramas",
    type: "BOTH" as const,
    websiteUrl: "https://www.ahorramas.com",
    logoUrl: "https://logo.clearbit.com/ahorramas.com",
    freeShippingThreshold: 50,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Gadis",
    slug: "gadis",
    type: "PHYSICAL" as const,
    websiteUrl: "https://www.gadis.es",
    logoUrl: "https://logo.clearbit.com/gadis.es",
    freeShippingThreshold: null,
    shippingNote: "Galicia y norte de España",
    isActive: true,
  },
  {
    name: "Froiz",
    slug: "froiz",
    type: "BOTH" as const,
    websiteUrl: "https://www.froiz.com",
    logoUrl: "https://logo.clearbit.com/froiz.com",
    freeShippingThreshold: 49,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "BM Supermercados",
    slug: "bm",
    type: "BOTH" as const,
    websiteUrl: "https://www.bmsupermercados.es",
    logoUrl: "https://logo.clearbit.com/bmsupermercados.es",
    freeShippingThreshold: 40,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Supermercados Familia",
    slug: "supermercado-familia",
    type: "PHYSICAL" as const,
    websiteUrl: "https://www.superfamilia.es",
    logoUrl: "https://logo.clearbit.com/superfamilia.es",
    freeShippingThreshold: null,
    shippingNote: null,
    isActive: true,
  },
  // Perfumerías y Parafarmacias
  {
    name: "Arenal",
    slug: "arenal",
    type: "BOTH" as const,
    websiteUrl: "https://www.arenal.net",
    logoUrl: "https://logo.clearbit.com/arenal.net",
    freeShippingThreshold: 29,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Primor",
    slug: "primor",
    type: "BOTH" as const,
    websiteUrl: "https://www.primor.eu",
    logoUrl: "https://logo.clearbit.com/primor.eu",
    freeShippingThreshold: 29,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "DosFarma",
    slug: "dosfarna",
    type: "ONLINE" as const,
    websiteUrl: "https://www.dosfarma.com",
    logoUrl: "https://logo.clearbit.com/dosfarma.com",
    freeShippingThreshold: 49,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Atida (MiFarma)",
    slug: "atida",
    type: "ONLINE" as const,
    websiteUrl: "https://www.mifarma.es",
    logoUrl: "https://logo.clearbit.com/mifarma.es",
    freeShippingThreshold: 39,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Farmaciasdirect",
    slug: "farmaciasdirect",
    type: "ONLINE" as const,
    websiteUrl: "https://www.farmaciasdirect.com",
    logoUrl: "https://logo.clearbit.com/farmaciasdirect.com",
    freeShippingThreshold: 39,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Farmavazquez",
    slug: "farmavazquez",
    type: "ONLINE" as const,
    websiteUrl: "https://www.farmavazquez.com",
    logoUrl: "https://logo.clearbit.com/farmavazquez.com",
    freeShippingThreshold: 39,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Viandvi",
    slug: "viandvi",
    type: "ONLINE" as const,
    websiteUrl: "https://www.viandvi.com",
    logoUrl: "https://logo.clearbit.com/viandvi.com",
    freeShippingThreshold: 29,
    shippingNote: null,
    isActive: true,
  },
  // Tiendas Online y Especializadas
  {
    name: "Amazon.es",
    slug: "amazon-es",
    type: "ONLINE" as const,
    websiteUrl: "https://www.amazon.es",
    logoUrl: "https://logo.clearbit.com/amazon.es",
    freeShippingThreshold: 0,
    shippingNote: "Gratis con Prime",
    isActive: true,
  },
  {
    name: "Nappy.es",
    slug: "nappy",
    type: "ONLINE" as const,
    websiteUrl: "https://www.nappy.es",
    logoUrl: "https://logo.clearbit.com/nappy.es",
    freeShippingThreshold: 59,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "Mas Pañales",
    slug: "maspanales",
    type: "ONLINE" as const,
    websiteUrl: "https://www.maspanales.es",
    logoUrl: "https://logo.clearbit.com/maspanales.es",
    freeShippingThreshold: 49,
    shippingNote: null,
    isActive: true,
  },
  {
    name: "PromoFarma",
    slug: "promofarma",
    type: "ONLINE" as const,
    websiteUrl: "https://www.promofarma.com",
    logoUrl: "https://logo.clearbit.com/promofarma.com",
    freeShippingThreshold: 59,
    shippingNote: null,
    isActive: true,
  },
];

// ─────────────────────────────────────────
// Dodot Sensitive product variants
// ─────────────────────────────────────────

const DODOT_PRODUCTS = [
  {
    name: "Pañales Dodot Sensitive Talla 3",
    slug: "dodot-sensitive-t3",
    description: "Pañales Dodot Sensitive para bebés de 5 a 10 kg. Talla 3.",
    imageUrl:
      "https://www.dodot.es/content/dam/dodot/es/products/dodot-sensitive-t3.jpg",
    category: "pañales",
    brand: "Dodot",
    ean: "8006540791455",
    isActive: true,
  },
  {
    name: "Pañales Dodot Sensitive Talla 4",
    slug: "dodot-sensitive-t4",
    description: "Pañales Dodot Sensitive para bebés de 7 a 18 kg. Talla 4.",
    imageUrl:
      "https://www.dodot.es/content/dam/dodot/es/products/dodot-sensitive-t4.jpg",
    category: "pañales",
    brand: "Dodot",
    ean: "8006540791462",
    isActive: true,
  },
  {
    name: "Pañales Dodot Sensitive Talla 5",
    slug: "dodot-sensitive-t5",
    description: "Pañales Dodot Sensitive para bebés de 11 a 16 kg. Talla 5.",
    imageUrl:
      "https://www.dodot.es/content/dam/dodot/es/products/dodot-sensitive-t5.jpg",
    category: "pañales",
    brand: "Dodot",
    ean: "8006540791479",
    isActive: true,
  },
  {
    name: "Pañales Dodot Sensitive Talla 6",
    slug: "dodot-sensitive-t6",
    description: "Pañales Dodot Sensitive para bebés de más de 15 kg. Talla 6.",
    imageUrl:
      "https://www.dodot.es/content/dam/dodot/es/products/dodot-sensitive-t6.jpg",
    category: "pañales",
    brand: "Dodot",
    ean: "8006540791486",
    isActive: true,
  },
];

async function main() {
  console.log("Seeding stores...");

  for (const store of STORES) {
    const result = await db.store.upsert({
      where: { slug: store.slug },
      update: {
        name: store.name,
        websiteUrl: store.websiteUrl,
        freeShippingThreshold: store.freeShippingThreshold,
        shippingNote: store.shippingNote,
      },
      create: store,
    });
    console.log(`  ✓ ${result.name} (${result.slug})`);
  }

  console.log("\nSeeding Dodot products...");

  for (const product of DODOT_PRODUCTS) {
    const result = await db.product.upsert({
      where: { slug: product.slug },
      update: { name: product.name, description: product.description },
      create: product,
    });
    console.log(`  ✓ ${result.name}`);
  }

  console.log("\nSeeding complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
