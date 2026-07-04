/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consumer-product ingredient breakdown, sourced live from the Open Facts family
 * of databases (food, beauty, and general products). Given a product name, find
 * the best match with an ingredient list and return its ingredients. Resolving
 * each ingredient to a chemical is done separately via the PubChem client.
 */

interface OpenFactsProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients?: Array<{ text?: string; id?: string; percent_estimate?: number; ingredients?: any[] }>;
  image_small_url?: string;
  image_url?: string;
}

const SOURCES = [
  { base: "https://world.openfoodfacts.org", label: "Open Food Facts", category: "Food & drink" },
  { base: "https://world.openbeautyfacts.org", label: "Open Beauty Facts", category: "Cosmetics & personal care" },
  { base: "https://world.openproductsfacts.org", label: "Open Products Facts", category: "General products" },
];

export interface ProductIngredient {
  name: string;
  percent?: number;
}

export interface ProductBreakdown {
  product: {
    name: string;
    brand: string;
    image: string;
    source: string;
    category: string;
    code: string;
    url: string;
  };
  ingredients: ProductIngredient[];
}

/** Recursively flatten Open Facts structured ingredients into leaf names. */
function flattenIngredients(list: OpenFactsProduct["ingredients"], out: ProductIngredient[] = []): ProductIngredient[] {
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (item?.ingredients?.length) {
      flattenIngredients(item.ingredients, out);
    } else if (item?.text) {
      out.push({ name: cleanName(item.text), percent: typeof item.percent_estimate === "number" ? Math.round(item.percent_estimate * 10) / 10 : undefined });
    }
  }
  return out;
}

/** Clean an ingredient label (strip allergen underscores, leading markers, stray brackets). */
function cleanName(raw: string): string {
  return raw
    .replace(/_/g, "")
    .replace(/^[\s\-–•]+/, "")
    .replace(/\s*\([^)]*%\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Parse a free-text ingredient list as a fallback when structured data is absent. */
function parseIngredientText(text: string): ProductIngredient[] {
  return text
    .replace(/\([^)]*\)/g, "") // drop parenthetical sub-lists to keep top level readable
    .split(/[,;.]/)
    .map((s) => cleanName(s))
    .filter((s) => s.length > 1 && s.length < 60)
    .map((name) => ({ name }));
}

function dedupe(items: ProductIngredient[]): ProductIngredient[] {
  const seen = new Set<string>();
  const out: ProductIngredient[] = [];
  for (const it of items) {
    const key = it.name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out.slice(0, 40);
}

function normalize(p: OpenFactsProduct, src: (typeof SOURCES)[number]): ProductBreakdown {
  let ingredients = flattenIngredients(p.ingredients);
  if (ingredients.length === 0 && p.ingredients_text) {
    ingredients = parseIngredientText(p.ingredients_text);
  }
  return {
    product: {
      name: p.product_name || "Unnamed product",
      brand: p.brands || "",
      image: p.image_small_url || p.image_url || "",
      source: src.label,
      category: src.category,
      code: p.code || "",
      url: p.code ? `${src.base}/product/${p.code}` : src.base,
    },
    ingredients: dedupe(ingredients),
  };
}

async function searchSource(base: string, q: string): Promise<OpenFactsProduct[]> {
  const url =
    `${base}/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=8&sort_by=popularity_key` +
    `&fields=code,product_name,brands,ingredients_text,ingredients,image_small_url,image_url`;
  const r = await fetch(url, { headers: { "User-Agent": "ChemStudio/1.0 (educational chemistry tool)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data: any = await r.json();
  return Array.isArray(data?.products) ? data.products : [];
}

/**
 * Search across the Open Facts databases for a product with a usable ingredient
 * list. Returns null when nothing with ingredients is found; throws when the
 * databases cannot be reached at all.
 */
export async function fetchProductBreakdown(q: string): Promise<ProductBreakdown | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;

  let reached = false;
  let lastError: unknown = null;

  for (const src of SOURCES) {
    try {
      const products = await searchSource(src.base, trimmed);
      reached = true;
      const withIngredients = products.find(
        (p) => (Array.isArray(p.ingredients) && p.ingredients.length > 0) || (p.ingredients_text && p.ingredients_text.trim().length > 0)
      );
      if (withIngredients) {
        const normalized = normalize(withIngredients, src);
        if (normalized.ingredients.length > 0) return normalized;
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!reached) {
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`The product databases are currently unreachable (${msg}). Check network access to openfoodfacts.org and try again.`);
  }
  return null; // reached the databases, but no matching product with ingredients
}
