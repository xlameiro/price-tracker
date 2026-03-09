import { searchAllStores } from "../lib/scrapers/search";

async function main() {
  console.log("Running searchAllStores (all scrapers)...");
  const results = await searchAllStores("Pañales Dodot Sensitive Talla 5");
  console.log(`\nTotal after filter: ${results.length}`);
  for (const r of results) {
    console.log(
      `  ${r.storeSlug.padEnd(20)} ${r.price}€  pkg=${String(r.packageSize ?? "?").padStart(3)}  ${r.productName.slice(0, 55)}`,
    );
  }
}

void main();
