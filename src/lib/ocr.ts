import { AL } from "@/lib/health";
import { isFlagged, splitIngredients, type Product } from "@/lib/off";

// Reads text from a photo in the browser (Tesseract.js). The image never leaves the device.
export async function readImage(file: File, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => m.status === "recognizing text" && onProgress?.(m.progress),
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

const num = (t: string, re: RegExp) => {
  const m = t.match(re);
  return m?.[1] ? parseFloat(m[1].replace(",", ".")) : undefined;
};

export function parseLabelText(text: string): Product {
  const t = text.replace(/\s+/g, " ").trim();
  const lower = t.toLowerCase();
  const m = t.match(
    /ingredients?\s*[:-]?\s*(.+?)(?:allergen|contains:|may contain|nutrition|storage|best before|$)/i,
  );
  const names = splitIngredients(m?.[1] ?? t);
  const allergens = AL.filter(([, , kw]) => kw.some((w) => lower.includes(w))).map(([, l]) => ({
    name: l.replace(/^\S+\s/, ""),
    match: true,
  }));
  const per100 = /100\s?(g|ml)/i.test(t);
  return {
    barcode: `photo-${Date.now()}`,
    name: "Product from photo",
    score: "N/A",
    scoreClass: "warn",
    source: "photo",
    nutrients: per100
      ? {
          su: num(t, /sugars?\D{0,12}(\d+(?:[.,]\d+)?)\s?g/i),
          sa: num(t, /salt\D{0,12}(\d+(?:[.,]\d+)?)\s?g/i),
          sf: num(t, /(?:saturat\w*|sat\.? fat)\D{0,12}(\d+(?:[.,]\d+)?)\s?g/i),
        }
      : undefined,
    ingredients: names.length
      ? names.map((name) => ({ name, flag: isFlagged(name) }))
      : [{ name: "No ingredients could be read", flag: false }],
    allergens: allergens.length ? allergens : [{ name: "None found in the text", match: false }],
  };
}
