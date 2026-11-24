import type { Product } from "@/lib/off";

const KEY = "scn-history";
const MAX = 12;
export type HistoryItem = { product: Product; ts: number };

export function loadHistory(): HistoryItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function save(list: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}
export function addHistory(p: Product): HistoryItem[] {
  const list = [
    { product: p, ts: Date.now() },
    ...loadHistory().filter((h) => h.product.barcode !== p.barcode),
  ].slice(0, MAX);
  save(list);
  return list;
}
export function clearHistory(): HistoryItem[] {
  save([]);
  return [];
}
