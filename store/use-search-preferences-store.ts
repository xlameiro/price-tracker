import { create } from "zustand";
import { persist } from "zustand/middleware";

type SortBy = "unit" | "total";

interface SearchPreferencesState {
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
}

export const useSearchPreferencesStore = create<SearchPreferencesState>()(
  persist(
    (set) => ({
      sortBy: "unit",
      setSortBy: (sortBy) => set({ sortBy }),
    }),
    { name: "search-preferences" },
  ),
);
