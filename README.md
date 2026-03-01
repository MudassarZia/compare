# Compare

**A free, open-source Chrome extension that instantly compares product prices across major retailers.** Visit any product page on Amazon, Walmart, Target, Best Buy, eBay, or Newegg — click one button and see who has it cheaper.

Built with a strict **$0 budget** constraint. No paid APIs, no servers, no subscriptions. Everything runs in your browser.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Supported Retailers](#supported-retailers)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Load the Extension in Chrome](#load-the-extension-in-chrome)
- [Configuration](#configuration)
  - [OpenRouter API Key (Recommended)](#openrouter-api-key-recommended)
  - [Supabase Shared Cache (Optional)](#supabase-shared-cache-optional)
  - [Extension Settings](#extension-settings)
- [Architecture](#architecture)
  - [High-Level Data Flow](#high-level-data-flow)
  - [Project Structure](#project-structure)
  - [Product Extraction Pipeline](#product-extraction-pipeline)
  - [Scraping Strategy](#scraping-strategy)
  - [AI Product Matching](#ai-product-matching)
  - [Cache Layer](#cache-layer)
- [Development](#development)
  - [Dev Server](#dev-server)
  - [Production Build](#production-build)
  - [Type Checking](#type-checking)
  - [Adding a New Retailer](#adding-a-new-retailer)
- [Rate Limits and Fair Use](#rate-limits-and-fair-use)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## How It Works

1. **You browse normally.** Visit a product page on any supported retailer.
2. **A "Compare Prices" button appears** in the bottom-right corner of the page.
3. **Click it.** The extension searches for the same product across all other retailers.
4. **A results panel slides in** showing competitor prices, savings percentages, match confidence scores, and direct links.

The comparison is entirely **user-initiated** — the extension never scrapes anything until you click the button. Product data is extracted passively from the page you're already viewing using structured data (JSON-LD) and DOM parsing.

---

## Supported Retailers

| Retailer | Extraction | Search Scraping |
|----------|-----------|----------------|
| Amazon | JSON-LD + DOM selectors (`#productTitle`, `.a-price`) | `/s?k={query}` |
| Walmart | `__NEXT_DATA__` JSON + DOM fallback | `/search?q={query}` |
| Target | DOM selectors (`[data-test]` attributes) | `/s?searchTerm={query}` |
| Best Buy | DOM selectors (`.sku-title`, `.priceView-customer-price`) | `/site/searchpage.jsp?st={query}` |
| eBay | JSON-LD + DOM selectors (`.x-price-primary`) | `/sch/i.html?_nkw={query}&LH_BIN=1` (Buy It Now only) |
| Newegg | DOM selectors (`.product-title`, `.price-current`) | `/p/pl?d={query}` |
| Google Shopping | N/A (aggregator only) | `/search?tbm=shop&q={query}` |

Google Shopping is used as the **primary meta-source** — a single search returns prices from multiple retailers, reducing the total number of requests needed. Direct retailer scrapers fill in gaps for any retailers not covered by Google Shopping results.

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **pnpm** (recommended) or npm
- **Google Chrome** (or any Chromium-based browser)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/compare.git
cd compare
pnpm install
```

Build the extension:

```bash
pnpm build
```

This produces a production-ready extension in `build/chrome-mv3-prod/`.

### Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `build/chrome-mv3-prod` folder inside the project directory
5. The Compare extension icon will appear in your toolbar

You're ready to go. Visit any product page on a supported retailer and look for the teal "Compare Prices" button in the bottom-right corner.

---

## Configuration

The extension works out of the box with zero configuration. The settings below unlock additional capabilities.

### OpenRouter API Key (Recommended)

An OpenRouter API key enables **AI-powered product matching**, which is significantly more accurate than the built-in word similarity fallback. OpenRouter offers a free tier with 20 requests/minute and 200 requests/day — more than enough for daily use.

1. Create a free account at [openrouter.ai](https://openrouter.ai)
2. Generate an API key
3. Open the extension's **Settings** page (click the extension icon, then "Settings")
4. Paste your key into the **OpenRouter API Key** field
5. Click **Save Settings**

Alternatively, for development, create a `.env.local` file in the project root:

```bash
PLASMO_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

**Without an API key**, the extension falls back to Jaccard word similarity for matching. This works, but may occasionally match the wrong product variant.

### Supabase Shared Cache (Optional)

Supabase provides an optional shared cache so that comparison results can be reused across sessions and users. The extension is **fully functional without Supabase** — all results are cached locally in Chrome's storage.

To enable the shared cache:

1. Create a free Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_create_comparisons.sql` via the Supabase SQL editor
3. In the extension settings, enter your **Supabase URL** and **Anon Key**

Or set them in `.env.local`:

```bash
PLASMO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

> **Note:** Supabase's free tier auto-pauses after 7 days of inactivity. The extension detects this and silently falls back to local-only caching — nothing breaks.

### Extension Settings

Open the settings page from the extension popup or navigate to the extension's options page directly.

| Setting | Default | Description |
|---------|---------|-------------|
| OpenRouter API Key | (empty) | Enables AI product matching |
| Supabase URL | (empty) | Optional shared cache endpoint |
| Supabase Anon Key | (empty) | Authentication for shared cache |
| Enabled Retailers | All 6 | Toggle which retailers to include in comparisons |
| Cache Duration | 4 hours | How long to keep results before refreshing |

---

## Architecture

### High-Level Data Flow

```
User visits product page
         |
         v
[Content Script: product-detector]
    |-- Extracts product data (JSON-LD -> DOM -> meta tags)
    |-- Renders floating "Compare Prices" button
         |
         | (user clicks button)
         v
[Background Service Worker]
    |-- Checks cache (local first, then Supabase)
    |-- On miss: scrapes Google Shopping (one request, multiple retailers)
    |-- Fills gaps with direct retailer scrapes
    |-- Matches products via AI (OpenRouter) or word similarity fallback
    |-- Caches results to local storage + Supabase
         |
         v
[Content Script: comparison-panel]
    |-- Renders results panel with competitor prices
    |-- Shows savings, confidence scores, and direct links
```

### Project Structure

```
src/
├── background/                   # Chrome service worker
│   ├── index.ts                  # Entry point
│   └── messages/
│       ├── compare-prices.ts     # Main comparison orchestrator
│       └── scrape-url.ts         # Single URL fetch handler
├── contents/                     # Content scripts (injected into pages)
│   ├── product-detector.tsx      # Detects products, shows Compare button
│   └── comparison-panel.tsx      # Renders comparison results panel
├── components/                   # React UI components
│   ├── CompareButton.tsx         # Floating action button
│   ├── ComparisonPanel.tsx       # Results panel with header/footer
│   ├── ComparisonCard.tsx        # Individual competitor result card
│   ├── LoadingSpinner.tsx        # Loading state indicator
│   └── ErrorBanner.tsx           # Error display component
├── core/
│   ├── extractors/               # Product data extraction from current page
│   │   ├── index.ts              # Extractor pipeline orchestrator
│   │   ├── json-ld.ts            # schema.org Product structured data
│   │   ├── amazon.ts             # Amazon-specific DOM selectors
│   │   ├── walmart.ts            # Walmart __NEXT_DATA__ + DOM
│   │   ├── target.ts             # Target DOM selectors
│   │   ├── bestbuy.ts            # Best Buy DOM selectors
│   │   ├── ebay.ts               # eBay DOM selectors
│   │   ├── newegg.ts             # Newegg DOM selectors
│   │   └── generic.ts            # Open Graph / meta tag fallback
│   ├── scrapers/                 # Cross-origin search scrapers
│   │   ├── index.ts              # Scraper registry
│   │   ├── google-shopping.ts    # Google Shopping aggregator
│   │   ├── amazon.ts             # Amazon search results parser
│   │   ├── walmart.ts            # Walmart search results parser
│   │   ├── target.ts             # Target search results parser
│   │   ├── bestbuy.ts            # Best Buy search results parser
│   │   ├── ebay.ts               # eBay search results parser
│   │   └── newegg.ts             # Newegg search results parser
│   ├── ai/                       # AI product matching
│   │   ├── openrouter.ts         # OpenRouter API client + model fallback
│   │   ├── prompts.ts            # System/user prompt templates
│   │   ├── rate-limiter.ts       # Token bucket rate limiter
│   │   └── fallback-matcher.ts   # Jaccard word similarity fallback
│   ├── cache/                    # Dual-layer caching
│   │   ├── cache-manager.ts      # Unified interface (local + remote)
│   │   ├── local-cache.ts        # Chrome storage with TTL
│   │   └── supabase-client.ts    # Optional Supabase REST client
│   └── scrape-queue.ts           # Rate-limited request queue
├── store/                        # Zustand state management
│   ├── comparison-store.ts       # Comparison state
│   └── settings-store.ts         # User preferences (persisted)
├── types/                        # TypeScript type definitions
│   ├── product.ts                # ProductData, ComparisonResult, retailers
│   ├── messages.ts               # Message request/response types
│   └── extractors.ts             # ProductExtractor interface
├── utils/                        # Shared utilities
│   ├── url-patterns.ts           # Retailer detection, URL parsing
│   ├── price-utils.ts            # Price parsing (US/EU), formatting
│   ├── delay.ts                  # Random human-like delays
│   └── logger.ts                 # Structured console logging
├── popup.tsx                     # Extension popup UI
├── options.tsx                   # Settings page UI
└── style.css                     # Tailwind CSS entry point
```

### Product Extraction Pipeline

When you visit a product page, the extension extracts product data using a 3-layer fallback chain:

1. **JSON-LD** (`application/ld+json`) — Parses schema.org `Product` structured data. This is the most reliable method because it's standardized and used across all major retailers. Extracts title, price, currency, image, brand, model, ratings, and reviews.

2. **Retailer-specific DOM selectors** — Each retailer has a dedicated extractor with CSS selectors tuned to its page structure. For example, Amazon uses `#productTitle` and `.a-price .a-offscreen`, while Walmart checks `__NEXT_DATA__` embedded JSON first. These are less stable than JSON-LD (retailers A/B test layouts) but serve as a reliable fallback.

3. **Generic meta tags** — Falls back to Open Graph tags (`og:title`, `product:price:amount`) and itemprop attributes. Works on any e-commerce site with basic meta tag support.

The extractor pipeline (`src/core/extractors/index.ts`) tries each layer in order and returns the first successful extraction.

### Scraping Strategy

Comparisons are performed by the background service worker, which has `host_permissions` to make cross-origin requests to all supported retailers.

The strategy prioritizes **minimal requests**:

1. **Google Shopping first** — A single search on Google Shopping returns prices from multiple retailers at once. This often covers 3-4 retailers in one request.
2. **Direct retailer scrapes** — Only retailers not found in Google Shopping results are scraped directly. The source product's own retailer is always skipped.
3. **Rate-limited queue** — All scrape requests go through a FIFO queue with a 5 requests/minute limit and random 2-5 second delays between requests to mimic human browsing patterns.

This means most comparisons require only **1-3 total HTTP requests** instead of scraping all 6 retailers individually.

### AI Product Matching

After gathering search results, the extension needs to determine which results are actually the **same product** (not accessories, cases, or different variants).

**With an OpenRouter API key**, the extension uses free LLMs through a model fallback chain:

| Priority | Model | Parameters |
|----------|-------|------------|
| 1st | `qwen/qwen3-235b-a22b:free` | 235B (MoE, 22B active) |
| 2nd | `meta-llama/llama-3.3-70b-instruct:free` | 70B |
| 3rd | `google/gemma-3-27b-it:free` | 27B |

The AI receives the source product title/brand/price and up to 10 candidate titles/prices (roughly 200-300 tokens per request). It returns a JSON response with match indices, confidence scores (0.0-1.0), and reasoning.

**Without an API key**, the extension uses Jaccard word similarity as a fallback. It tokenizes product titles, removes stopwords, and computes set intersection/union ratios. Results with less than 30% similarity are discarded.

### Cache Layer

Results are cached in two layers:

| Layer | Storage | TTL | Behavior |
|-------|---------|-----|----------|
| **Local** (primary) | `chrome.storage.local` | Configurable (default 4h) | Always available |
| **Supabase** (optional) | PostgreSQL via REST API | Configurable (default 4h) | Shared across users, auto-disables on failure |

**Read path:** Local cache checked first. On miss, Supabase is checked (if configured). Remote hits are backfilled into local cache.

**Write path:** Both layers are written in parallel via `Promise.allSettled` — neither blocks the other, and failures are silently absorbed.

The Supabase client uses **direct REST API calls** (no SDK) to keep the bundle size minimal. If Supabase becomes unreachable (e.g., free tier auto-pause), the `isAvailable` flag is set to `false` and all subsequent requests skip it entirely.

---

## Development

### Dev Server

Start the Plasmo dev server with hot-reload:

```bash
pnpm dev
```

This builds the extension to `build/chrome-mv3-dev/` and watches for changes. Load this folder as an unpacked extension in Chrome for live development.

### Production Build

```bash
pnpm build
```

Outputs to `build/chrome-mv3-prod/`. All JavaScript is minified and tree-shaken.

### Type Checking

```bash
npx tsc --noEmit
```

The project uses TypeScript strict mode with path aliases (`~src/*`).

### Adding a New Retailer

To add support for a new retailer:

1. **Add host permission** — In `package.json`, add the retailer's domain to `manifest.host_permissions`.

2. **Add content script match** — In both `src/contents/product-detector.tsx` and `src/contents/comparison-panel.tsx`, add the domain to the `matches` array.

3. **Create an extractor** — Add `src/core/extractors/{retailer}.ts` implementing the `ProductExtractor` interface:

   ```typescript
   import type { ProductExtractor } from "~types/extractors"

   export const myRetailerExtractor: ProductExtractor = {
     name: "MyRetailer DOM",
     canExtract: (url) => /myretailer\.com/.test(url),
     extract: (doc, url) => {
       // Parse product data from the page DOM
       // Return ProductData or null
     }
   }
   ```

4. **Register the extractor** — Import and add it to the array in `src/core/extractors/index.ts`.

5. **Create a scraper** — Add `src/core/scrapers/{retailer}.ts` implementing the `Scraper` interface:

   ```typescript
   import type { Scraper } from "./index"

   export const myRetailerScraper: Scraper = {
     key: "myretailer",
     buildSearchUrl: (query) => `https://www.myretailer.com/search?q=${encodeURIComponent(query)}`,
     parseSearchResults: (html) => {
       // Parse search result HTML and return ScrapedCandidate[]
     }
   }
   ```

6. **Register the scraper** — Import and add it to the map in `src/core/scrapers/index.ts`.

7. **Add retailer metadata** — In `src/types/product.ts`, add the retailer to the `RetailerKey` union type and the `RETAILERS` map.

8. **Add URL patterns** — In `src/utils/url-patterns.ts`, add a `RetailerPattern` entry with host pattern, product page regex, and identifier extractor.

---

## Rate Limits and Fair Use

The extension is designed for responsible, low-volume usage:

| Resource | Limit | Notes |
|----------|-------|-------|
| Web scraping | 5 requests / minute | Enforced by internal queue |
| Request delay | 2-5 seconds (random) | Human-like pacing between requests |
| OpenRouter AI | 15 requests / minute, 180 / day | Conservative buffer below free tier limits |
| Comparisons | ~66 / day (with AI) | Unlimited with fallback matcher |

All comparisons are **user-initiated only**. The extension never makes background requests, auto-refreshes, or scrapes without an explicit button click.

---

## Troubleshooting

**"Compare Prices" button doesn't appear**
- Make sure you're on a **product page**, not a search results or category page. The button only shows on individual product listings.
- Check that the retailer is in your enabled list (Settings page).
- Some product pages use heavy JavaScript rendering. Try waiting a few seconds and refreshing.

**"No competitor prices found"**
- The product may be too niche or use a title that doesn't match well across retailers.
- Some retailers may be blocking scrape requests (403/429 errors). Check the error notices in the results panel.
- Try again later — rate limits reset after 1 minute.

**AI matching seems inaccurate**
- Make sure you have an OpenRouter API key configured. Without it, the extension uses basic word similarity which is less accurate.
- The free AI models may occasionally misidentify product variants. Confidence scores below 50% should be treated with caution.

**Extension not loading after build**
- Make sure you're loading the `build/chrome-mv3-prod` directory (not the project root).
- Try removing and re-loading the extension in `chrome://extensions`.
- Check the browser console for error messages.

---

## Contributing

Contributions are welcome. Here are some areas where help would be especially valuable:

- **Retailer coverage** — Adding extractors and scrapers for additional retailers
- **Selector maintenance** — Retailers frequently change their DOM structure; keeping selectors up to date is an ongoing task
- **Internationalization** — Supporting non-US retailers and currencies
- **UI/UX improvements** — Better result presentation, dark mode, accessibility

Please open an issue before starting work on a major feature to discuss the approach.

---

## License

[MIT](LICENSE)
