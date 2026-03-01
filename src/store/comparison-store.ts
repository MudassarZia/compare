import { create } from "zustand"
import type { ComparisonResult, ProductData } from "~types/product"

interface ComparisonState {
  currentProduct: ProductData | null
  comparison: ComparisonResult | null
  isLoading: boolean
  error: string | null
  panelOpen: boolean

  setProduct: (product: ProductData) => void
  setComparison: (result: ComparisonResult) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  togglePanel: () => void
  openPanel: () => void
  closePanel: () => void
  reset: () => void
}

export const useComparisonStore = create<ComparisonState>((set) => ({
  currentProduct: null,
  comparison: null,
  isLoading: false,
  error: null,
  panelOpen: false,

  setProduct: (product) => set({ currentProduct: product }),
  setComparison: (result) => set({ comparison: result, panelOpen: true, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  reset: () =>
    set({
      currentProduct: null,
      comparison: null,
      isLoading: false,
      error: null,
      panelOpen: false
    })
}))
