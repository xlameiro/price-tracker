import { auth } from "@/auth";
import { ProgressiveSearchResults } from "@/components/search/progressive-search-results";
import { SearchBar } from "@/components/search/search-bar";
import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Metadata } from "next";
import Link from "next/link";

interface SearchPageProps {
  readonly searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  if (q?.trim()) {
    return {
      title: `"${q.trim()}" — ${APP_NAME}`,
      description: `Comparar precios de "${q.trim()}" en Amazon, Carrefour, El Corte Inglés, Alcampo, Eroski, MediaMarkt y PcComponentes.`,
    };
  }
  return { title: `Buscar — ${APP_NAME}` };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const hasQuery = query.length >= 3;

  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-foreground/10 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href={ROUTES.home}
            className="font-semibold tracking-tight hover:opacity-80"
          >
            {APP_NAME}
          </Link>
          <nav aria-label="Site navigation" className="flex items-center gap-4">
            <Link
              href={ROUTES.signIn}
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="maincontent"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-6 py-12"
      >
        <div className="mb-8">
          <h1 className="mb-4 text-2xl font-bold tracking-tight">
            Buscar mejor precio
          </h1>
          <SearchBar initialQuery={query} />
        </div>

        {hasQuery && (
          <ProgressiveSearchResults query={query} isAuthenticated={!!session} />
        )}

        {!hasQuery && (
          <p className="text-sm text-foreground/50">
            Escribe el nombre de un producto para ver los precios en todas las
            tiendas.
          </p>
        )}
      </main>

      <footer className="border-t border-foreground/10 px-6 py-6 text-center text-xs text-foreground/40">
        &copy; {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}
