import { create } from "zustand"
import { Storage } from "@plasmohq/storage"

import type { RetailerKey } from "~types/product"

const storage = new Storage({ area: "local" })

interface SettingsState {
  openrouterApiKey: string
  supabaseUrl: string
  supabaseAnonKey: string
  enabledRetailers: RetailerKey[]
  cacheTtlHours: number

  setOpenrouterApiKey: (key: string) => void
  setSupabaseUrl: (url: string) => void
  setSupabaseAnonKey: (key: string) => void
  setEnabledRetailers: (retailers: RetailerKey[]) => void
  setCacheTtlHours: (hours: number) => void
  loadSettings: () => Promise<void>
}

const DEFAULT_RETAILERS: RetailerKey[] = [
  "amazon",
  "walmart",
  "target",
  "bestbuy",
  "ebay",
  "newegg"
]

export const useSettingsStore = create<SettingsState>((set) => ({
  openrouterApiKey: "",
  supabaseUrl: "",
  supabaseAnonKey: "",
  enabledRetailers: DEFAULT_RETAILERS,
  cacheTtlHours: 4,

  setOpenrouterApiKey: (key) => {
    set({ openrouterApiKey: key })
    storage.set("settings:openrouterApiKey", key)
  },

  setSupabaseUrl: (url) => {
    set({ supabaseUrl: url })
    storage.set("settings:supabaseUrl", url)
  },

  setSupabaseAnonKey: (key) => {
    set({ supabaseAnonKey: key })
    storage.set("settings:supabaseAnonKey", key)
  },

  setEnabledRetailers: (retailers) => {
    set({ enabledRetailers: retailers })
    storage.set("settings:enabledRetailers", retailers)
  },

  setCacheTtlHours: (hours) => {
    set({ cacheTtlHours: hours })
    storage.set("settings:cacheTtlHours", hours)
  },

  loadSettings: async () => {
    const [openrouterApiKey, supabaseUrl, supabaseAnonKey, enabledRetailers, cacheTtlHours] =
      await Promise.all([
        storage.get<string>("settings:openrouterApiKey"),
        storage.get<string>("settings:supabaseUrl"),
        storage.get<string>("settings:supabaseAnonKey"),
        storage.get<RetailerKey[]>("settings:enabledRetailers"),
        storage.get<number>("settings:cacheTtlHours")
      ])

    set({
      openrouterApiKey: openrouterApiKey || "",
      supabaseUrl: supabaseUrl || "",
      supabaseAnonKey: supabaseAnonKey || "",
      enabledRetailers: enabledRetailers || DEFAULT_RETAILERS,
      cacheTtlHours: cacheTtlHours ?? 4
    })
  }
}))
