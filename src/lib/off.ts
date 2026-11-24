/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Nutr } from "@/lib/health";

export type Ingredient = { name: string; flag: boolean };
export type Allergen = { name: string; match: boolean };
export type Product = {
  barcode: string;
  name: string;
  score: string;
  scoreClass: "good" | "warn";
  ingredients: Ingredient[];
  allergens: Allergen[];
  nutrients?: Nutr | undefined;
  categories?: string[];
  source?: "off" | "sample" | "photo";
};
export type Hit = { code: string; name: string; brand?: string; score: string };

export const FLAG_KEYWORDS = [
  "palm oil",
  "aspartame",
  "glucose syrup",
  "high fructose",
  "msg",
  "monosodium glutamate",
  "sodium nitrite",
  "hydrogenated",
];
export const isFlagged = (n: string) =>
  FLAG_KEYWORDS.some((k) => n.toLowerCase().includes(k)) || /\bE\d{3,4}\b/i.test(n);
const RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
export const gradeRank = (s: string) => RANK[s.charAt(0).toUpperCase()] ?? 6;

export function scoreFromGrade(grade?: string): { score: string; scoreClass: "good" | "warn" } {
  const g = (grade || "").toUpperCase();
  if (g === "A" || g === "B") return { score: g, scoreClass: "good" };
  if (g === "C" || g === "D" || g === "E") return { score: g, scoreClass: "warn" };
  return { score: "N/A", scoreClass: "warn" };
}

/** Splits a label like "Chocolate (Sugar, Cocoa), Salt" into top-level ingredients. */
export function splitIngredients(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text.replace(/_/g, "").replace(/^\s*ingredients?\s*:?\s*/i, "")) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out
    .map((x) => x.trim().replace(/\.$/, ""))
    .filter((x) => x.length > 1)
    .slice(0, 60);
}

const FIELDS =
  "code,product_name,brands,nutriscore_grade,nutriments,allergens_tags,ingredients,ingredients_text,ingredients_text_en,categories_tags";

export function parseProduct(p: any, barcode: string): Product {
  const { score, scoreClass } = scoreFromGrade(p.nutriscore_grade);
  const text: string = p.ingredients_text_en || p.ingredients_text || "";
  const names: string[] = text
    ? splitIngredients(text)
    : (p.ingredients?.map((i: { text?: string }) => i.text).filter(Boolean) ?? []);
  const ingredients = names.map((name) => ({ name, flag: isFlagged(name) }));
  const allergens = (p.allergens_tags ?? []).map((t: string) => ({
    name: t
      .replace(/^en:/, "")
      .replace(/-/g, " ")
      .replace(/^\w/, (c: string) => c.toUpperCase()),
    match: true,
  }));
  return {
    barcode,
    name: p.product_name || "Unknown product",
    score,
    scoreClass,
    source: "off",
    categories: p.categories_tags ?? [],
    nutrients: {
      su: p.nutriments?.sugars_100g,
      sa: p.nutriments?.salt_100g,
      sf: p.nutriments?.["saturated-fat_100g"],
    },
    ingredients: ingredients.length
      ? ingredients
      : [{ name: "No ingredient data available", flag: false }],
    allergens: allergens.length ? allergens : [{ name: "None declared", match: false }],
  };
}

export async function lookupByBarcode(code: string): Promise<Product | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`,
  );
  if (!res.ok) throw new Error("Lookup failed");
  const d = await res.json();
  return d.status === 1 && d.product ? parseProduct(d.product, code) : null;
}

export async function searchProducts(q: string): Promise<Hit[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,brands,nutriscore_grade`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search failed");
  const d = await res.json();
  return (d.products ?? [])
    .filter((p: any) => p.code && p.product_name)
    .map((p: any) => ({
      code: p.code,
      name: p.product_name,
      brand: p.brands?.split(",")[0],
      score: scoreFromGrade(p.nutriscore_grade).score,
    }));
}

async function candidates(cat: string): Promise<Product[]> {
  const url = `https://world.openfoodfacts.org/api/v2/search?categories_tags=${encodeURIComponent(cat)}&fields=${FIELDS}&page_size=40&sort_by=unique_scans_n`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const d = await res.json();
  return (d.products ?? [])
    .filter((p: any) => p.code && p.product_name)
    .map((p: any) => parseProduct(p, p.code));
}

// Similar products (same Open Food Facts category) that fit better. `level` scores a product
// (0 fine, 1 caution, 2 avoid); a swap must be strictly better, and not a worse Nutri-Score.
export async function findSwaps(cur: Product, level: (p: Product) => number): Promise<Product[]> {
  const cats = (cur.categories ?? []).slice().reverse(); // most specific first
  const curLevel = level(cur);
  const seen = new Set<string>([cur.barcode]);
  const out: Product[] = [];
  for (const cat of cats.slice(0, 2)) {
    for (const p of await candidates(cat)) {
      if (seen.has(p.barcode)) continue;
      seen.add(p.barcode);
      if (level(p) < curLevel && gradeRank(p.score) <= Math.min(gradeRank(cur.score), 3))
        out.push(p);
    }
    if (out.length >= 3) break;
  }
  return out
    .sort((a, b) => level(a) - level(b) || gradeRank(a.score) - gradeRank(b.score))
    .slice(0, 3);
}
