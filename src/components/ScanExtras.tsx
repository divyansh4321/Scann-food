import { useState } from "react";
import { analyze, type Profile } from "@/lib/health";
import { lookupByBarcode, searchProducts, type Hit, type Product } from "@/lib/off";
import { parseLabelText, readImage } from "@/lib/ocr";
import type { HistoryItem } from "@/lib/history";
import { cardBlob, shareUrl, summaryText } from "@/lib/share";

const dot = (profile: Profile | null, p: Product) =>
  profile
    ? ["ok", "warn", "bad"][analyze(profile, p).level]
    : p.scoreClass === "good"
      ? "ok"
      : "warn";

export function SearchPanel({
  onPick,
  onError,
}: {
  onPick: (p: Product) => void;
  onError: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    setHits(null);
    try {
      if (/^\d{8,14}$/.test(term)) {
        const p = await lookupByBarcode(term);
        if (p) onPick(p);
        else setHits([]);
      } else setHits(await searchProducts(term));
    } catch {
      onError("Couldn’t reach the product database. Check your connection and try again.");
    }
    setBusy(false);
  }
  async function pick(code: string) {
    setBusy(true);
    try {
      const p = await lookupByBarcode(code);
      if (p) {
        onPick(p);
        setHits(null);
        setQ("");
      }
    } catch {
      onError("Couldn’t load that product. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="xtra">
      <form className="searchbox" onSubmit={go}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a barcode number or product name"
          aria-label="Search by barcode or product name"
          inputMode="search"
        />
        <button className="btn btn-ghost" disabled={busy} type="submit">
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {hits && (
        <ul className="sr-list">
          {hits.length === 0 && (
            <li className="sr-empty">
              Nothing found. Try another spelling, the barcode, or a photo of the ingredient list.
            </li>
          )}
          {hits.map((h) => (
            <li key={h.code}>
              <button onClick={() => pick(h.code)}>
                <span>
                  {h.name}
                  {h.brand ? <em> · {h.brand}</em> : null}
                </span>
                <span className="mono">{h.score}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PhotoPanel({ onResult }: { onResult: (p: Product) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setStatus("Reading the label… 0%");
    try {
      setText(await readImage(f, (p) => setStatus(`Reading the label… ${Math.round(p * 100)}%`)));
      setStatus("");
    } catch {
      setStatus("Couldn’t read that photo. Try a sharper, well-lit shot of the ingredient list.");
    }
  }
  return (
    <details className="xtra photo">
      <summary>Not in the database? Read an ingredient list from a photo</summary>
      <p>
        Take a clear, well-lit photo of the ingredients (and the nutrition table if you can).
        Reading happens on your device — the photo isn’t uploaded.
      </p>
      <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
        Take or choose photo
        <input type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
      </label>
      {status && <p className="ocr-status">{status}</p>}
      {text !== null && (
        <>
          <p className="ocr-status">Check the text below and fix any mistakes before analysing:</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            aria-label="Text read from photo"
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              onResult(parseLabelText(text));
              setText(null);
            }}
          >
            Analyse this text
          </button>
        </>
      )}
    </details>
  );
}

export function SwapsPanel({
  swaps,
  profile,
  onPick,
}: {
  swaps: Product[] | null;
  profile: Profile | null;
  onPick: (p: Product) => void;
}) {
  if (!swaps || swaps.length === 0) return null;
  return (
    <div className="swaps">
      <p className="col-label">Better swaps in the same category</p>
      {swaps.map((p) => (
        <button key={p.barcode} className="swap" onClick={() => onPick(p)}>
          <i className={`lvl ${dot(profile, p)}`} />
          {p.image && <img className="thumb" src={p.image} alt="" loading="lazy" />}
          <span>{p.name}</span>
          <span className="mono">Score {p.score}</span>
        </button>
      ))}
    </div>
  );
}

export function HistoryPanel({
  items,
  profile,
  onPick,
  onClear,
}: {
  items: HistoryItem[];
  profile: Profile | null;
  onPick: (p: Product) => void;
  onClear: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="xtra hist">
      <div className="hist-head">
        <p className="col-label">Recent scans</p>
        <button onClick={onClear}>Clear</button>
      </div>
      <div className="hist-list">
        {items.map((h) => (
          <button key={h.product.barcode} className="swap" onClick={() => onPick(h.product)}>
            <i className={`lvl ${dot(profile, h.product)}`} />
            {h.product.image && (
              <img className="thumb" src={h.product.image} alt="" loading="lazy" />
            )}
            <span>{h.product.name}</span>
            <span className="mono">{h.product.score}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShareRow({ product, profile }: { product: Product; profile: Profile | null }) {
  const [msg, setMsg] = useState("");
  const a = profile ? analyze(profile, product) : null;
  const text = summaryText(product, a, profile?.name);
  const url = shareUrl(product);

  async function share() {
    try {
      if (navigator.share)
        await navigator.share({ title: "SCN. scan result", text, ...(url ? { url } : {}) });
      else {
        await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
        setMsg("Copied — paste it into a message.");
      }
    } catch {
      /* cancelled */
    }
  }
  async function image() {
    const blob = await cardBlob(product, a, profile?.name);
    if (!blob) return;
    const file = new File([blob], "scn-result.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] }))
        return void (await navigator.share({ files: [file], text }));
    } catch {
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "scn-result.png";
    link.click();
    setMsg("Image saved.");
  }
  return (
    <div className="share-row">
      <button className="btn btn-ghost" onClick={share}>
        Share result
      </button>
      <button className="btn btn-ghost" onClick={image}>
        Save as image
      </button>
      {msg && <span className="ocr-status">{msg}</span>}
    </div>
  );
}
