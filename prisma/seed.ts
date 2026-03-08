import { db } from "@/lib/db";

const STORES = [
  {
    name: "Amazon.es",
    slug: "amazon-es",
    type: "ONLINE" as const,
    websiteUrl: "https://www.amazon.es",
    logoUrl: "https://logo.clearbit.com/amazon.es",
    isActive: true,
  },
  {
    name: "Carrefour",
    slug: "carrefour",
    type: "BOTH" as const,
    websiteUrl: "https://www.carrefour.es",
    logoUrl: "https://logo.clearbit.com/carrefour.es",
    isActive: true,
  },
  {
    name: "El Corte Inglés",
    slug: "elcorteingles",
    type: "BOTH" as const,
    websiteUrl: "https://www.elcorteingles.es",
    logoUrl: "https://logo.clearbit.com/elcorteingles.es",
    isActive: true,
  },
  {
    name: "PcComponentes",
    slug: "pccomponentes",
    type: "ONLINE" as const,
    websiteUrl: "https://www.pccomponentes.com",
    logoUrl: "https://logo.clearbit.com/pccomponentes.com",
    isActive: true,
  },
];

async function main() {
  console.log("Seeding stores...");

  for (const store of STORES) {
    const result = await db.store.upsert({
      where: { slug: store.slug },
      update: {},
      create: store,
    });
    console.log(`  ✓ ${result.name} (${result.slug})`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
