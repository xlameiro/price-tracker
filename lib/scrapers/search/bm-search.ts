import { extractPackageSize } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const BASE_URL = "https://www.online.bmsupermercados.es";

interface BmProduct {
  productData: {
    name: string;
    url: string;
    imageURL: string;
  };
  priceData: {
    prices: Array<{
      value: {
        centAmount: number;
      };
    }>;
  };
}

interface BmApiResponse {
  products: BmProduct[];
}

function bmProductToResult(
  product: BmProduct,
  storeSlug: string,
  storeName: string,
): SearchResult | null {
  const productName = product.productData?.name?.trim();
  if (!productName) return null;
  const price = product.priceData?.prices?.[0]?.value?.centAmount;
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    storeSlug,
    storeName,
    productName,
    price,
    currency: "EUR",
    imageUrl: product.productData?.imageURL ?? null,
    productUrl: product.productData?.url ?? "",
    isAvailable: true,
    packageSize: extractPackageSize(productName),
  };
}

export class BmSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "bm";
  readonly storeName = "BM Supermercados";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    const url =
      `${BASE_URL}/api/rest/V1.0/catalog/product?page=1&limit=20&offset=0` +
      `&orderById=13&showProducts=true&showRecommendations=false&showRecipes=false` +
      `&q=${encodeURIComponent(query)}`;

    let data: BmApiResponse;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      });
      if (!response.ok) return [];
      data = (await response.json()) as BmApiResponse;
    } catch {
      return [];
    }

    return (data.products ?? [])
      .flatMap((p) => {
        const result = bmProductToResult(p, this.storeSlug, this.storeName);
        return result ? [result] : [];
      })
      .slice(0, 5);
  }
}
