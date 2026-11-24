import { verdictHead, type Analysis } from "@/lib/health";
import type { Product } from "@/lib/off";

const COLOR = ["#2F6B3C", "#B7791F", "#E23F26"];

// A link only works for real barcodes (not samples or photo scans).
export function shareUrl(p: Product): string | null {
  return p.source === "off" && typeof window !== "undefined"
    ? `${window.location.origin}/?code=${p.barcode}#demo`
    : null;
}

export function summaryText(p: Product, a: Analysis | null, who?: string): string {
  const lines = [`${p.name} — Nutri-Score ${p.score}`];
  if (a) {
    lines.push(`${verdictHead(a).replace(/^\S+\s/, "")}${who ? ` (for ${who})` : ""}`);
    a.reasons.slice(0, 3).forEach(([t]) => lines.push(`• ${t}`));
  }
  lines.push("Checked with SCN. — general guidance, not medical advice.");
  return lines.join("\n");
}

function wrap(x: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (x.measureText(line + w).width > max && line) {
      out.push(line.trim());
      line = "";
    }
    line += w + " ";
  }
  return [...out, line.trim()];
}

export async function cardBlob(p: Product, a: Analysis | null, who?: string): Promise<Blob | null> {
  const c = document.createElement("canvas");
  c.width = c.height = 1080;
  const x = c.getContext("2d");
  if (!x) return null;
  x.fillStyle = "#F4F6EF";
  x.fillRect(0, 0, 1080, 1080);
  x.fillStyle = "#12140F";
  x.font = "900 56px Archivo, Arial, sans-serif";
  x.fillText("SCN", 70, 110);
  x.fillStyle = "#E23F26";
  x.fillText(".", 70 + x.measureText("SCN").width, 110);
  x.fillStyle = "#12140F";
  x.font = "900 66px Archivo, Arial, sans-serif";
  let y = 240;
  wrap(x, p.name, 940)
    .slice(0, 3)
    .forEach((l) => {
      x.fillText(l, 70, y);
      y += 78;
    });
  x.fillStyle = "#5B6154";
  x.font = "500 34px Inter, Arial, sans-serif";
  x.fillText(`Nutri-Score ${p.score}`, 70, y + 10);
  y += 60;
  const col = a && !a.dataGap ? (COLOR[a.level] ?? "#5B6154") : "#5B6154";
  x.fillStyle = col;
  x.fillRect(70, y, 940, 130);
  x.fillStyle = "#FCFDF9";
  x.font = "900 46px Archivo, Arial, sans-serif";
  x.fillText(
    a ? verdictHead(a).replace(/^\S+\s/, "") : "Create a profile for personal warnings",
    100,
    y + 80,
  );
  y += 200;
  x.fillStyle = "#12140F";
  x.font = "400 32px Inter, Arial, sans-serif";
  (a?.reasons ?? []).slice(0, 3).forEach(([t]) =>
    wrap(x, `• ${t}`, 920)
      .slice(0, 2)
      .forEach((l) => {
        x.fillText(l, 70, y);
        y += 44;
      }),
  );
  x.fillStyle = "#5B6154";
  x.font = "400 26px Inter, Arial, sans-serif";
  x.fillText(`${who ? `Profile: ${who} · ` : ""}Checked with SCN. · not medical advice`, 70, 1020);
  return new Promise((r) => c.toBlob(r, "image/png"));
}
