import "./style.css"

import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"

import type { RetailerKey } from "~types/product"
import { RETAILERS } from "~types/product"

const storage = new Storage({ area: "local" })

const ALL_RETAILERS: RetailerKey[] = ["amazon", "walmart", "target", "bestbuy", "ebay", "newegg"]

function Options() {
  const [openrouterKey, setOpenrouterKey] = useState("")
  const [supabaseUrl, setSupabaseUrl] = useState("")
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("")
  const [enabledRetailers, setEnabledRetailers] = useState<RetailerKey[]>(ALL_RETAILERS)
  const [cacheTtlHours, setCacheTtlHours] = useState(4)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const [key, url, anon, retailers, ttl] = await Promise.all([
      storage.get<string>("settings:openrouterApiKey"),
      storage.get<string>("settings:supabaseUrl"),
      storage.get<string>("settings:supabaseAnonKey"),
      storage.get<RetailerKey[]>("settings:enabledRetailers"),
      storage.get<number>("settings:cacheTtlHours")
    ])
    if (key) setOpenrouterKey(key)
    if (url) setSupabaseUrl(url)
    if (anon) setSupabaseAnonKey(anon)
    if (retailers) setEnabledRetailers(retailers)
    if (ttl) setCacheTtlHours(ttl)
  }

  async function save() {
    await Promise.all([
      storage.set("settings:openrouterApiKey", openrouterKey),
      storage.set("settings:supabaseUrl", supabaseUrl),
      storage.set("settings:supabaseAnonKey", supabaseAnonKey),
      storage.set("settings:enabledRetailers", enabledRetailers),
      storage.set("settings:cacheTtlHours", cacheTtlHours)
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleRetailer(key: RetailerKey) {
    setEnabledRetailers((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="flex items-center gap-2 mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900">Compare Settings</h1>
        </div>

        <div className="space-y-6">
          {/* OpenRouter API Key */}
          <Section title="OpenRouter API Key" description="Required for AI-powered product matching. Get a free key at openrouter.ai">
            <input
              type="password"
              value={openrouterKey}
              onChange={(e) => setOpenrouterKey(e.target.value)}
              placeholder="sk-or-..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            {!openrouterKey && (
              <p className="text-xs text-amber-600 mt-1">
                Without an API key, product matching uses basic word similarity (less accurate).
              </p>
            )}
          </Section>

          {/* Supabase (Optional) */}
          <Section title="Supabase (Optional)" description="Shared cache for faster results. Extension works fully without this.">
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent mb-2"
            />
            <input
              type="password"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="Anon key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </Section>

          {/* Retailers */}
          <Section title="Enabled Retailers" description="Choose which retailers to include in price comparisons.">
            <div className="grid grid-cols-2 gap-2">
              {ALL_RETAILERS.map((key) => {
                const retailer = RETAILERS[key]
                const enabled = enabledRetailers.includes(key)
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      enabled
                        ? "border-teal-300 bg-teal-50"
                        : "border-gray-200 bg-white"
                    }`}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleRetailer(key)}
                      className="accent-teal-600"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: retailer.color }}
                    />
                    <span className="text-sm text-gray-700">{retailer.name}</span>
                  </label>
                )
              })}
            </div>
          </Section>

          {/* Cache TTL */}
          <Section title="Cache Duration" description="How long to keep comparison results before refreshing.">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={24}
                value={cacheTtlHours}
                onChange={(e) => setCacheTtlHours(Number(e.target.value))}
                className="flex-1 accent-teal-600"
              />
              <span className="text-sm text-gray-700 w-16 text-right">
                {cacheTtlHours} hour{cacheTtlHours !== 1 ? "s" : ""}
              </span>
            </div>
          </Section>

          {/* Save Button */}
          <button
            onClick={save}
            className="w-full bg-teal-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-teal-700 transition-colors">
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-0.5">{title}</h2>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      {children}
    </div>
  )
}

export default Options
