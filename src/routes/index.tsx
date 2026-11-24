import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import { IngredientList } from "@/components/IngredientList";
import {
  HealthProfileWizard,
  ProfileBar,
  SourcesNote,
  VerdictBanner,
} from "@/components/HealthProfile";
import { analyze, loadProfile, saveProfile, type Profile } from "@/lib/health";
import { findSwaps, lookupByBarcode, type Product } from "@/lib/off";
import { addHistory, clearHistory, loadHistory, type HistoryItem } from "@/lib/history";
import {
  HistoryPanel,
  PhotoPanel,
  SearchPanel,
  ShareRow,
  SwapsPanel,
} from "@/components/ScanExtras";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SCN. — Scan any food label, decoded instantly" },
      {
        name: "description",
        content:
          "SCN. decodes food labels in seconds: ingredient lens, allergen alerts and a one-glance nutrition score for every product you scan.",
      },
      { property: "og:title", content: "SCN. — Scan any food label, decoded instantly" },
      {
        property: "og:description",
        content:
          "Ingredient lens, allergen alerts and a one-glance nutrition score for every product you scan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScnLanding,
});

type ScanState = "idle" | "requesting" | "live" | "found" | "not-found" | "error";

const SAMPLE_PRODUCTS: [Product, ...Product[]] = [
  {
    barcode: "0012345678905",
    nutrients: { su: 6, sa: 0.5, sf: 8 },
    name: "Organic Peanut Butter",
    score: "A-",
    scoreClass: "good",
    ingredients: [
      { name: "Roasted peanuts (98%)", flag: false },
      { name: "Palm oil", flag: true },
      { name: "Sea salt", flag: false },
      { name: "Stabiliser (mono- and diglycerides of fatty acids E471)", flag: false },
    ],
    allergens: [
      { name: "Peanuts", match: true },
      { name: "Tree nuts", match: false },
    ],
  },
  {
    barcode: "5012345678900",
    nutrients: { su: 22, sa: 0.3, sf: 3 },
    name: "Oat & Honey Granola Bar",
    score: "C",
    scoreClass: "warn",
    ingredients: [
      { name: "Oats", flag: false },
      { name: "Glucose syrup", flag: true },
      { name: "Palm oil", flag: true },
      { name: "Honey", flag: false },
      { name: "Sugar", flag: false },
      { name: "Rice flour", flag: false },
      { name: "Emulsifier (soy lecithin E322)", flag: false },
      { name: "Salt", flag: false },
      { name: "Raising agent (sodium bicarbonate E500)", flag: false },
      { name: "Natural flavouring", flag: false },
      { name: "Antioxidant (tocopherol-rich extract E306)", flag: false },
    ],
    allergens: [
      { name: "Gluten", match: true },
      { name: "Tree nuts", match: false },
    ],
  },
  {
    barcode: "5000112618572",
    nutrients: { su: 0, sa: 0.02, sf: 0 },
    categories: ["en:beverages", "en:sodas"],
    name: "Diet Cola",
    score: "C-",
    scoreClass: "warn",
    ingredients: [
      { name: "Carbonated water", flag: false },
      { name: "Colour (caramel E150d)", flag: false },
      { name: "Sweeteners (aspartame E951, acesulfame K E950)", flag: true },
      { name: "Acid (phosphoric acid E338)", flag: true },
      { name: "Natural flavourings", flag: false },
      { name: "Acidity regulator (sodium citrate E331)", flag: false },
      { name: "Caffeine", flag: false },
      { name: "Preservative (sodium benzoate E211)", flag: false },
    ],
    allergens: [{ name: "Phenylalanine source", match: true }],
  },
];

function RevealIcon({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setInView(true)),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="icon-wrap" ref={ref}>
      <div className={`reveal ${inView ? "in-view" : ""}`}>{children}</div>
      <div className={`scan-edge ${inView ? "in-view" : ""}`} aria-hidden="true" />
    </div>
  );
}

function ProductImage({ product }: { product: Product }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [product.barcode]);
  if (product.image && !broken) {
    return (
      <img
        className="pm-img"
        src={product.image}
        alt={`Photo of ${product.name}`}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="pm-img pm-ph" aria-hidden="true">
      {product.source === "photo" ? "📷" : "📦"}
    </div>
  );
}
function ScnLanding() {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [swaps, setSwaps] = useState<Product[] | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    // Shared link: /?code=<barcode>
    const code = new URLSearchParams(window.location.search).get("code");
    if (code && /^\d{6,14}$/.test(code)) {
      setWizardOpen(false);
      lookupByBarcode(code)
        .then((p) => (p ? openProduct(p) : setScanState("not-found")))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSwaps(null);
    if (!product || product.source !== "off" || !product.categories?.length) return;
    const level = (p: Product) =>
      profile ? analyze(profile, p).level : p.scoreClass === "good" ? 0 : 1;
    if (level(product) < 1) return;
    let live = true;
    findSwaps(product, level)
      .then((r) => live && setSwaps(r))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [product, profile]);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    if (!p) {
      const t = setTimeout(() => setWizardOpen(true), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  function stopCamera() {
    readerRef.current?.reset();
    const stream = videoRef.current?.srcObject as MediaStream | null | undefined;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function openProduct(p: Product) {
    stopCamera();
    setProduct(p);
    setScannedCode(p.barcode);
    setScanState("found");
    if (p.source !== "sample") setHistory(addHistory(p));
  }

  async function handleDecoded(code: string) {
    stopCamera();
    setScannedCode(code);
    try {
      const found = await lookupByBarcode(code);
      if (found) openProduct(found);
      else setScanState("not-found");
    } catch {
      setErrorMessage("Couldn't reach the product database. Check your connection and try again.");
      setScanState("error");
    }
  }

  function showError(m: string) {
    setErrorMessage(m);
    setScanState("error");
  }

  async function startScan() {
    setErrorMessage(null);
    setScanState("requesting");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("insecure"), { name: "InsecureContext" });
      }
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      setScanState("live");
      // Let React show the <video> before the stream attaches (needed on iPhones).
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      // Ask for the back camera directly; this also works before the browser reveals device labels.
      await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (result) => {
          if (result) handleDecoded(result.getText());
          // "No barcode in this frame yet" errors are expected and ignored.
        },
      );
    } catch (err) {
      console.error(err);
      stopCamera();
      const name = (err as { name?: string })?.name;
      const msg =
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera permission was blocked. Tap the lock or camera icon in your browser’s address bar, allow Camera for this site, then try again."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "No camera was found on this device. You can type a barcode or search by name instead."
            : name === "NotReadableError" || name === "AbortError"
              ? "The camera is busy. Close other apps or tabs using it, then try again."
              : name === "InsecureContext"
                ? "The camera needs a secure (https://) page. Open the site from its https:// address in Safari or Chrome."
                : "Couldn’t start the camera. If you opened this link inside another app (Instagram, WhatsApp…), open it in Safari or Chrome instead.";
      setErrorMessage(msg);
      setScanState("error");
    }
  }

  function tryAgain() {
    setProduct(null);
    setScannedCode(null);
    setScanState("idle");
  }

  function selectSample(p: Product) {
    openProduct({ ...p, source: "sample" });
  }

  useEffect(() => stopCamera, []);

  const modalRef = useRef<HTMLDivElement>(null);
  const modalOpen = scanState === "found" && !!product;
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !wizardOpen && tryAgain();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, wizardOpen]);
  useEffect(() => {
    modalRef.current?.scrollTo({ top: 0 });
  }, [product?.barcode]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="scn-root">
      <style>{`
        .scn-root{
          --bg:#F4F6EF; --bg-alt:#EAEEE1; --ink:#12140F; --ink-deep:#1B1D14; --muted:#5B6154;
          --red:#E23F26; --green:#2F6B3C; --hair:#D8DCCD; --paper:#FCFDF9;
          background:var(--bg); color:var(--ink); font-family:'Inter',sans-serif;
          position:relative; overflow-x:hidden;
        }
        .scn-root *{box-sizing:border-box;}
        .scn-root a{color:inherit; text-decoration:none;}
        .scn-root :focus-visible{outline:2px solid var(--red); outline-offset:3px;}
        .mono{font-family:'JetBrains Mono',monospace;}
        .kicker{font-size:13px; color:var(--muted); font-weight:500; margin-bottom:10px;}
        .kicker b{color:var(--red); font-weight:600;}

        .bg-layer{position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden;}
        .bg-barcode{
          position:absolute; inset:-10% -20%;
          background-image:repeating-linear-gradient(90deg,
            rgba(18,20,15,.05) 0px, rgba(18,20,15,.05) 2px, transparent 2px, transparent 6px,
            rgba(18,20,15,.05) 6px, rgba(18,20,15,.05) 7px, transparent 7px, transparent 14px,
            rgba(18,20,15,.05) 14px, rgba(18,20,15,.05) 18px, transparent 18px, transparent 22px);
          background-size:220px 100%;
          animation:drift 26s linear infinite;
        }
        @keyframes drift{ from{transform:translateX(0);} to{transform:translateX(-220px);} }
        .bg-radar{
          position:absolute; top:-30%; right:-15%; width:70vw; height:70vw; border-radius:50%;
          background:conic-gradient(from 0deg, transparent 0deg, rgba(226,63,38,.09) 25deg, transparent 60deg, transparent 360deg);
          animation:spin 18s linear infinite;
        }
        @keyframes spin{ to{ transform:rotate(360deg); } }
        .bg-chip{
          position:absolute; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.03em;
          color:var(--muted); opacity:0; white-space:nowrap; animation:chipFloat 18s ease-in-out infinite;
        }
        @keyframes chipFloat{
          0%{opacity:0; transform:translateY(24px);} 10%{opacity:.4;} 85%{opacity:.4;}
          100%{opacity:0; transform:translateY(-32px);}
        }
        @media (prefers-reduced-motion: reduce){
          .bg-barcode, .bg-radar, .bg-chip, .beam, .reveal, .scan-edge { animation: none !important; transition: none !important; }
        }

        .scn-root > header, .scn-root > main, .scn-root > footer{position:relative; z-index:1;}

        header{position:fixed; top:0; left:0; right:0; z-index:100; display:flex; justify-content:space-between; align-items:center; padding:22px 32px; background:rgba(244,246,239,.82); backdrop-filter:blur(8px); border-bottom:1px solid transparent; transition:border-color .2s, background .2s;}
        .logo{font-family:'Archivo',sans-serif; font-weight:900; font-size:19px;}
        .logo b{color:var(--red);}
        nav.side{display:flex; align-items:center; gap:26px;}
        nav.side a{font-size:14px; color:var(--muted); transition:color .2s;}
        nav.side a:hover{color:var(--ink);}
        .nav-cta{font-size:13px; padding:9px 16px; border:1px solid var(--ink); border-radius:3px; color:var(--ink); transition:background .2s, color .2s;}
        .nav-cta:hover{background:var(--ink); color:var(--paper);}
        .menu-btn{display:none; flex-direction:column; gap:5px; background:none; border:0; padding:6px; cursor:pointer;}
        .menu-btn span{width:22px; height:2px; background:var(--ink); display:block;}
        @media (max-width:760px){
          nav.side{display:none;}
          .menu-btn{display:flex;}
        }
        .mobile-menu{position:fixed; inset:0; z-index:99; background:var(--paper); display:flex; flex-direction:column; justify-content:center; gap:28px; padding:32px; transform:translateY(-100%); transition:transform .35s cubic-bezier(.7,0,.2,1);}
        .mobile-menu.open{transform:translateY(0);}
        .mobile-menu a{font-family:'Archivo',sans-serif; font-weight:700; font-size:32px; text-transform:lowercase;}
        .mobile-menu .close-btn{position:absolute; top:22px; right:28px; background:none; border:0; font-size:28px; cursor:pointer; color:var(--ink);}

        .hero{min-height:100svh; display:flex; flex-direction:column; justify-content:center; padding:120px 32px 80px; border-bottom:1px solid var(--hair);}
        .hero-inner{max-width:1100px;}
        .hero h1{font-family:'Archivo',sans-serif; font-weight:900; font-size:clamp(42px,7.6vw,96px); line-height:.98; letter-spacing:-.01em; margin:18px 0 28px;}
        .hero h1 .accent{color:var(--red);}
        .hero p.sub{font-size:clamp(16px,2vw,19px); color:var(--muted); max-width:560px; line-height:1.55; margin-bottom:40px;}
        .cta-row{display:flex; gap:16px; flex-wrap:wrap;}
        .btn{font-size:14px; font-weight:600; padding:15px 24px; border-radius:3px; display:inline-flex; align-items:center; gap:10px; transition:all .2s; border:1px solid var(--hair); cursor:pointer;}
        .btn-primary{background:var(--red); color:#FCFDF9; border-color:var(--red);}
        .btn-primary:hover{background:#c73621;}
        .btn-ghost{color:var(--ink); background:var(--paper);}
        .btn-ghost:hover{border-color:var(--ink);}
        .btn:disabled{opacity:.6; cursor:default;}

        .problem{padding:120px 32px; background:var(--ink-deep); color:var(--paper); border-bottom:1px solid var(--hair);}
        .problem-inner{max-width:1040px; margin:0 auto; display:grid; grid-template-columns:1.1fr .9fr; gap:64px; align-items:center;}
        .problem h2{font-family:'Archivo',sans-serif; font-weight:900; font-size:clamp(28px,3.6vw,46px); line-height:1.12; margin:0 0 20px;}
        .problem p{color:#C7CBBC; font-size:16px; line-height:1.65; max-width:460px;}
        .problem p + p{margin-top:14px;}
        .compare{background:#0F110C; border:1px solid #2A2D22; border-radius:4px; padding:24px; font-family:'JetBrains Mono',monospace; font-size:13px;}
        .compare .row{display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-bottom:1px solid #2A2D22;}
        .compare .row:last-child{border-bottom:none;}
        .compare .printed{color:#9CA292;}
        .compare .meaning{color:#FCFDF9; text-align:right;}
        @media (max-width:860px){ .problem-inner{grid-template-columns:1fr;} .problem p{max-width:none;} }

        .feature{display:grid; grid-template-columns:1fr 1fr; min-height:84vh; border-bottom:1px solid var(--hair); align-items:center;}
        .feature.alt{background:var(--bg-alt);}
        .feature.reverse .feature-visual{order:2;}
        .feature-text{padding:64px 56px;}
        .feature-visual{position:relative; display:flex; align-items:center; justify-content:center; min-height:84vh; overflow:hidden; padding:40px;}
        .feature .step{font-size:13px; color:var(--muted); margin-bottom:8px;}
        .feature h2{font-family:'Archivo',sans-serif; font-weight:900; font-size:clamp(30px,4vw,52px); line-height:1.02; margin:0 0 20px;}
        .feature p{color:var(--muted); font-size:16px; max-width:420px; line-height:1.6;}
        .tag-row{display:flex; gap:8px; flex-wrap:wrap; margin-top:24px;}
        .tag{font-family:'JetBrains Mono',monospace; font-size:11px; border:1px solid var(--hair); background:var(--paper); padding:6px 10px; border-radius:2px; color:var(--muted);}
        .icon-wrap{width:100%; max-width:320px; aspect-ratio:1/1; position:relative;}
        .icon-wrap svg{width:100%; height:100%; display:block;}
        .reveal{clip-path:inset(0 100% 0 0); transition:clip-path 1s cubic-bezier(.7,0,.2,1); width:100%; height:100%;}
        .reveal.in-view{clip-path:inset(0 0 0 0);}
        .scan-edge{position:absolute; top:0; bottom:0; width:2px; background:var(--red); box-shadow:0 0 12px 2px rgba(226,63,38,.5); left:0%; transition:left 1s cubic-bezier(.7,0,.2,1);}
        .scan-edge.in-view{left:100%;}
        @media (max-width:860px){
          .feature{grid-template-columns:1fr;}
          .feature.reverse .feature-visual{order:0;}
          .feature-visual, .feature-text{min-height:auto; padding:48px 28px;}
        }

        .demo{padding:110px 32px; border-bottom:1px solid var(--hair); display:flex; flex-direction:column; align-items:center; text-align:center;}
        .demo h2{font-family:'Archivo',sans-serif; font-weight:900; font-size:clamp(30px,4.6vw,58px); margin:0 0 16px;}
        .demo p.lead{color:var(--muted); max-width:520px; margin-bottom:44px; line-height:1.6;}
        .demo-stage{width:100%; max-width:820px; background:var(--paper); border:1px solid var(--hair); border-radius:6px; padding:36px; position:relative; overflow:hidden; box-shadow:0 20px 60px -30px rgba(18,20,15,.25);}
        .scan-window{position:relative; background:#0F110C; border:1px solid var(--hair); border-radius:4px; height:200px; display:flex; align-items:center; justify-content:center; overflow:hidden; margin-bottom:24px;}
        .scan-window .product-label{font-family:'JetBrains Mono',monospace; font-size:13px; color:#9CA292;}
        .scan-video{width:100%; height:100%; object-fit:cover;}
        .reticle{position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:68%; height:58%; border:2px solid rgba(226,63,38,.85); border-radius:4px; box-shadow:0 0 0 2000px rgba(0,0,0,.35) inset; pointer-events:none;}
        .scan-window .beam{position:absolute; left:0; right:0; height:3px; top:0; background:linear-gradient(90deg, transparent, var(--red), transparent); box-shadow:0 0 20px 4px rgba(226,63,38,.7); opacity:0;}
        .scan-window.scanning .beam{animation:beam-run 1.4s linear infinite;}
        @keyframes beam-run{ 0%{top:0; opacity:1;} 100%{top:100%; opacity:1;} }
        .scan-error{margin-bottom:24px; font-size:14px; color:var(--muted); display:flex; flex-direction:column; align-items:center; gap:12px; max-width:420px; margin-left:auto; margin-right:auto;}
        .result{text-align:left; opacity:0; transform:translateY(8px); transition:opacity .4s, transform .4s;}
        .result.show{opacity:1; transform:translateY(0);}
        .result-head{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:20px; flex-wrap:wrap; gap:10px;}
        .result-head h3{font-family:'Archivo',sans-serif; font-size:21px;}
        .score{font-family:'JetBrains Mono',monospace; font-size:13px; padding:6px 12px; border-radius:2px;}
        .score.good{background:rgba(47,107,60,.10); color:var(--green); border:1px solid rgba(47,107,60,.35);}
        .score.warn{background:rgba(226,63,38,.10); color:var(--red); border:1px solid rgba(226,63,38,.35);}
        .result-grid{display:grid; grid-template-columns:1fr; gap:24px; text-align:left; margin-top:22px;}
        .result-col p.col-label{font-size:12px; color:var(--muted); font-weight:600; margin:0 0 10px;}
        .result-col ul{list-style:none; padding:0; margin:0;}
        .result-col li{font-size:14px; padding:8px 0; border-bottom:1px solid var(--hair); display:flex; justify-content:space-between; gap:10px;}
        .flag{color:var(--red); font-family:'JetBrains Mono',monospace; font-size:11px;}
        .ok{color:var(--green); font-family:'JetBrains Mono',monospace; font-size:11px;}
        @media (max-width:640px){ .result-grid{grid-template-columns:1fr;} }
        .disclaimer{margin-top:20px; font-size:12px; color:var(--muted);}
        .sample-row{display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:32px; padding-top:28px; border-top:1px solid var(--hair);}
        .sample-row .sample-label{width:100%; font-size:12px; color:var(--muted); margin-bottom:6px;}
        .sample-btn{font-size:13px; padding:9px 15px; border:1px solid var(--hair); border-radius:3px; color:var(--muted); background:transparent; cursor:pointer; transition:all .2s;}
        .sample-btn:hover{border-color:var(--red); color:var(--ink);}

        .manifesto{padding:130px 32px; border-bottom:1px solid var(--hair); display:flex; justify-content:center;}
        .manifesto blockquote{max-width:780px; font-family:'Archivo',sans-serif; font-weight:700; font-size:clamp(23px,3.2vw,38px); line-height:1.3; text-align:center; margin:0;}
        .manifesto blockquote .accent{color:var(--red);}

        .faq{padding:110px 32px; border-bottom:1px solid var(--hair); background:var(--bg-alt);}
        .faq-inner{max-width:760px; margin:0 auto;}
        .faq-inner h2{font-family:'Archivo',sans-serif; font-weight:900; font-size:clamp(28px,3.6vw,44px); margin:0 0 44px;}
        .faq-item{border-bottom:1px solid var(--hair); padding:22px 0;}
        .faq-item summary{cursor:pointer; font-weight:600; font-size:16px; list-style:none; display:flex; justify-content:space-between; gap:16px; align-items:center;}
        .faq-item summary::-webkit-details-marker{display:none;}
        .faq-item summary::after{content:"+"; font-size:20px; color:var(--muted); flex-shrink:0;}
        .faq-item[open] summary::after{content:"–";}
        .faq-item p{color:var(--muted); font-size:15px; line-height:1.6; margin:14px 0 0; max-width:620px;}

        footer{padding:64px 32px 40px; display:flex; flex-direction:column; gap:40px;}
        .footer-top{display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:24px;}
        .footer-top h2{font-family:'Archivo',sans-serif; font-weight:900; font-size:clamp(28px,4vw,46px); max-width:600px; line-height:1.08; margin:0;}
        .footer-bottom{display:flex; justify-content:space-between; flex-wrap:wrap; gap:16px; border-top:1px solid var(--hair); padding-top:24px; font-size:13px; color:var(--muted);}
        .footer-links{display:flex; gap:20px;}
        .footer-links a:hover{color:var(--ink);}

        .pm{position:fixed;inset:0;z-index:250;background:rgba(18,20,15,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:pmfade .2s}
        @keyframes pmfade{from{opacity:0}}
        .pm-card{position:relative;width:100%;max-width:720px;max-height:92vh;overflow-y:auto;background:var(--paper);border-radius:8px;padding:28px;text-align:left;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);animation:pop .35s cubic-bezier(.2,.8,.2,1)}
        .pm-close{position:sticky;top:0;float:right;z-index:3;width:36px;height:36px;margin:-8px -8px 0 8px;border-radius:50%;border:1px solid var(--hair);background:var(--paper);font-size:22px;line-height:1;cursor:pointer;color:var(--ink)}
        .pm-top{display:flex;gap:18px;align-items:center;margin-bottom:20px}.pm-top h3{font-family:'Archivo',sans-serif;font-size:22px;line-height:1.15;margin:0 0 6px}.pm-top .kicker{margin:0 0 6px}.pm-brand{font-size:13px;color:var(--muted);margin:0 0 10px}
        .pm-img{width:112px;height:112px;flex-shrink:0;border:1px solid var(--hair);border-radius:6px;background:#fff;object-fit:contain}.pm-ph{display:flex;align-items:center;justify-content:center;font-size:44px;background:var(--bg)}
        .thumb{width:34px;height:34px;object-fit:contain;border-radius:3px;background:#fff;border:1px solid var(--hair);flex-shrink:0}
        @media (max-width:640px){.pm{padding:0;align-items:flex-end}.pm-card{max-height:94vh;border-radius:16px 16px 0 0;padding:20px 18px calc(24px + env(safe-area-inset-bottom,0px))}.pm-img{width:84px;height:84px}.pm-top h3{font-size:19px}}

        .ing-wrap{margin:4px 0 0}.ing-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}.ing-head .col-label{font-size:12px;color:var(--muted);font-weight:600;margin:0}
        .ing-tabs{display:flex;border:1px solid var(--hair);border-radius:3px;overflow:hidden}.ing-tabs button{font-size:12px;padding:6px 12px;background:var(--paper);border:0;cursor:pointer;color:var(--muted)}.ing-tabs button.on{background:var(--ink);color:var(--paper)}
        .ing-note{font-size:12px;color:var(--muted);margin:0 0 10px}.ing-list{list-style:none;margin:0;padding:0}.ing{padding:10px 0;border-bottom:1px solid var(--hair)}
        .ing-name{display:flex;justify-content:space-between;gap:10px;font-size:14px;font-weight:500}
        .ing-ex{margin:8px 0 0 12px;padding:8px 12px;border-left:3px solid var(--hair);background:var(--bg);border-radius:0 3px 3px 0}.ing-ex.unk{border-left-color:#B7791F}
        .ing-ex-h{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px}.ing-ex p{margin:4px 0 0;font-size:13px;color:var(--muted);line-height:1.5}.ing-ex p.watch{color:#9B2412}
        .kind{font-family:'JetBrains Mono',monospace;font-size:10px;padding:2px 7px;border:1px solid var(--hair);border-radius:2px;color:var(--muted);background:var(--paper)}

        .xtra{margin-top:18px;text-align:left}
        .searchbox{display:flex;gap:10px}.searchbox input{flex:1;min-width:0;font-size:15px;padding:12px 14px;border:1px solid var(--hair);border-radius:3px;background:var(--bg);font-family:inherit}.searchbox input:focus{outline:none;border-color:var(--red)}
        .sr-list{list-style:none;margin:10px 0 0;padding:0;border:1px solid var(--hair);border-radius:4px;overflow:hidden}.sr-list li{border-bottom:1px solid var(--hair)}.sr-list li:last-child{border-bottom:0}.sr-list button{width:100%;display:flex;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--paper);border:0;cursor:pointer;font-size:14px;text-align:left;color:var(--ink)}.sr-list button:hover{background:var(--bg)}.sr-list em{color:var(--muted);font-style:normal}.sr-empty{padding:12px 14px;font-size:14px;color:var(--muted)}
        .photo{border:1px dashed var(--hair);border-radius:4px;padding:14px 16px}.photo summary{cursor:pointer;font-size:14px;font-weight:600}.photo p{font-size:13px;color:var(--muted);line-height:1.5}.photo textarea{width:100%;font-family:'JetBrains Mono',monospace;font-size:12px;padding:10px;border:1px solid var(--hair);border-radius:3px;margin:8px 0 12px;background:var(--bg)}.ocr-status{font-size:13px;color:var(--muted);margin:10px 0 0}
        .swaps{margin:22px 0 4px}.swap{width:100%;display:flex;align-items:center;gap:10px;padding:11px 12px;margin-bottom:6px;border:1px solid var(--hair);border-radius:3px;background:var(--paper);cursor:pointer;font-size:14px;text-align:left;color:var(--ink)}.swap:hover{border-color:var(--ink)}.swap span:first-of-type{flex:1}.swap .mono{font-size:12px;color:var(--muted)}.lvl{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:var(--muted)}.lvl.ok{background:var(--green)}.lvl.warn{background:#B7791F}.lvl.bad{background:var(--red)}
        .hist-head{display:flex;justify-content:space-between;align-items:center}.hist-head .col-label{font-size:12px;color:var(--muted);font-weight:600;margin:0 0 8px}.hist-head button{background:none;border:0;color:var(--muted);font-size:12px;cursor:pointer;text-decoration:underline}
        .share-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:20px}
        .profbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px;padding:12px 16px;border:1px solid var(--hair);border-radius:4px;background:var(--bg);font-size:13px;color:var(--muted);text-align:left}.profbar b{color:var(--ink)}.profbar button{font-size:12px;padding:7px 12px;border:1px solid var(--ink);background:none;border-radius:3px;cursor:pointer;color:var(--ink)}.profbar button:hover{background:var(--ink);color:var(--paper)}
        .vd{border-radius:4px;padding:18px 20px;margin-bottom:22px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;border:1px solid}.vd b{font-family:'Archivo',sans-serif;font-size:20px}.vd ul{margin:0;padding-left:18px;font-size:14px;line-height:1.5}.vd span{font-size:14px}.vd small{font-size:11px;opacity:.7}.vd.bad{background:rgba(226,63,38,.09);border-color:rgba(226,63,38,.45);color:#9B2412}.vd.warn{background:rgba(183,121,31,.10);border-color:rgba(183,121,31,.45);color:#7A4F0B}.vd.ok{background:rgba(47,107,60,.09);border-color:rgba(47,107,60,.4);color:var(--green)}.vd.info{background:var(--bg);border-color:var(--hair);color:var(--ink)}.vd .cap{font-weight:600}
        .wz{position:fixed;inset:0;z-index:300;background:rgba(18,20,15,.55);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:20px}.wz.open{display:flex}.wz-card{width:100%;max-width:560px;max-height:92vh;overflow:auto;background:var(--paper);border-radius:8px;padding:28px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);animation:pop .35s cubic-bezier(.2,.8,.2,1)}@keyframes pop{from{opacity:0;transform:translateY(16px) scale(.97)}}.wz-bar{height:4px;background:var(--hair);border-radius:4px;overflow:hidden;margin-bottom:26px}.wz-bar i{display:block;height:100%;background:var(--red);transition:width .4s}.wz-step{animation:slide .35s ease}@keyframes slide{from{opacity:0;transform:translateX(24px)}}.wz-card h3{font-family:'Archivo',sans-serif;font-weight:900;font-size:clamp(24px,4vw,32px);line-height:1.1;margin:0 0 8px}.wz-s{color:var(--muted);font-size:15px;margin:0 0 22px}.chips{display:flex;flex-wrap:wrap;gap:10px}.chip{font-size:14px;padding:11px 16px;border:1px solid var(--hair);background:var(--bg);border-radius:30px;cursor:pointer;color:var(--ink);transition:all .15s}.chip:hover{border-color:var(--ink);transform:translateY(-1px)}.chip.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}span.chip{cursor:default}.wz-in{width:100%;font-size:20px;padding:14px 16px;border:2px solid var(--hair);border-radius:4px;background:var(--bg);font-family:inherit}.wz-in:focus{outline:none;border-color:var(--red)}.wz-nav{display:flex;justify-content:space-between;gap:12px;margin-top:28px}.wz-note{font-size:12px;color:var(--muted);margin-top:18px}
        .mobile-menu button.mm-link{background:none;border:0;padding:0;text-align:left;cursor:pointer;color:inherit;font-family:'Archivo',sans-serif;font-weight:700;font-size:32px;text-transform:lowercase;}
      `}</style>

      <div className="bg-layer" aria-hidden="true">
        <div className="bg-barcode" />
        <div className="bg-radar" />
        <div className="bg-chip" style={{ top: "16%", left: "10%", animationDelay: "0s" }}>
          E466 · stabiliser
        </div>
        <div className="bg-chip" style={{ top: "60%", left: "72%", animationDelay: "6s" }}>
          0.4g salt / 100g
        </div>
        <div className="bg-chip" style={{ top: "80%", left: "22%", animationDelay: "12s" }}>
          gluten: clear
        </div>
      </div>

      <header>
        <div className="logo">
          SCN<b>.</b>
        </div>
        <nav className="side" aria-label="Section navigation">
          <a href="#problem">Why</a>
          <a href="#scan">How it works</a>
          <a href="#demo">Scan</a>
          <a href="#faq">FAQ</a>
          <button
            className="nav-cta"
            style={{ background: "none", cursor: "pointer" }}
            onClick={() => setWizardOpen(true)}
          >
            Health profile
          </button>
          <a href="#demo" className="nav-cta">
            Try it
          </a>
        </nav>
        <button
          className="menu-btn"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}>
        <button className="close-btn" aria-label="Close menu" onClick={closeMenu}>
          ×
        </button>
        <a href="#problem" onClick={closeMenu}>
          why
        </a>
        <a href="#scan" onClick={closeMenu}>
          how it works
        </a>
        <a href="#demo" onClick={closeMenu}>
          scan
        </a>
        <a href="#faq" onClick={closeMenu}>
          faq
        </a>
        <button
          className="mm-link"
          onClick={() => {
            closeMenu();
            setWizardOpen(true);
          }}
        >
          health profile
        </button>
      </div>

      <HealthProfileWizard
        open={wizardOpen}
        initial={profile}
        onClose={() => setWizardOpen(false)}
        onSave={(p) => {
          saveProfile(p);
          setProfile(p);
          setWizardOpen(false);
        }}
      />

      <main>
        <section className="hero">
          <div className="hero-inner">
            <p className="kicker">
              <b>SCN.</b> — food intelligence, in your pocket
            </p>
            <h1>
              Point your phone.
              <br />
              Know what's <span className="accent">really</span> inside.
            </h1>
            <p className="sub">
              One camera pass turns any barcode, label or ingredient list into a plain-language read
              on what you're about to eat — additives decoded, allergens flagged, no guesswork.
            </p>
            <div className="cta-row">
              <a href="#demo" className="btn btn-primary">
                Try the demo scan
              </a>
              <a href="#scan" className="btn btn-ghost">
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section className="problem" id="problem">
          <div className="problem-inner">
            <div>
              <h2>Ingredient lists aren't written for you.</h2>
              <p>
                They're written to satisfy a regulation, in the smallest legal font, using names
                chemists recognise and nobody else does.
              </p>
              <p>
                SCN. doesn't summarise the marketing on the front of the pack — it reads the actual
                panel on the back, and tells you what it means.
              </p>
            </div>
            <div className="compare">
              <div className="row">
                <span className="printed">Sodium benzoate (E211)</span>
                <span className="meaning">Preservative</span>
              </div>
              <div className="row">
                <span className="printed">Maltodextrin</span>
                <span className="meaning">Filler / thickener</span>
              </div>
              <div className="row">
                <span className="printed">Natural flavouring</span>
                <span className="meaning">Unspecified source</span>
              </div>
              <div className="row">
                <span className="printed">Soy lecithin</span>
                <span className="meaning">Emulsifier</span>
              </div>
            </div>
          </div>
        </section>

        <section className="feature" id="scan">
          <div className="feature-text">
            <p className="step">Step 1 of 4</p>
            <h2>Barcode scan</h2>
            <p>
              Aim your camera at any barcode, pack, or nutrition panel. Recognition runs on-device —
              answers land in under a second, no typing, no searching.
            </p>
            <div className="tag-row">
              <span className="tag">EAN / UPC</span>
              <span className="tag">Nutrition panel OCR</span>
              <span className="tag">On-device decode</span>
            </div>
          </div>
          <div className="feature-visual">
            <RevealIcon>
              <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
                <rect
                  x="20"
                  y="60"
                  width="260"
                  height="180"
                  rx="4"
                  fill="none"
                  stroke="#D8DCCD"
                  strokeWidth="2"
                />
                <g fill="#12140F">
                  <rect x="50" y="90" width="4" height="120" />
                  <rect x="60" y="90" width="2" height="120" />
                  <rect x="68" y="90" width="6" height="120" />
                  <rect x="80" y="90" width="2" height="120" />
                  <rect x="88" y="90" width="4" height="120" />
                  <rect x="98" y="90" width="2" height="120" />
                  <rect x="106" y="90" width="8" height="120" />
                  <rect x="120" y="90" width="2" height="120" />
                  <rect x="128" y="90" width="4" height="120" />
                  <rect x="138" y="90" width="6" height="120" />
                  <rect x="150" y="90" width="2" height="120" />
                  <rect x="158" y="90" width="4" height="120" />
                  <rect x="168" y="90" width="2" height="120" />
                  <rect x="176" y="90" width="8" height="120" />
                  <rect x="190" y="90" width="2" height="120" />
                  <rect x="198" y="90" width="4" height="120" />
                  <rect x="208" y="90" width="6" height="120" />
                  <rect x="220" y="90" width="2" height="120" />
                  <rect x="228" y="90" width="4" height="120" />
                  <rect x="238" y="90" width="2" height="120" />
                </g>
                <line
                  x1="20"
                  y1="150"
                  x2="280"
                  y2="150"
                  stroke="#E23F26"
                  strokeWidth="2"
                  opacity="0.85"
                />
              </svg>
            </RevealIcon>
          </div>
        </section>

        <section className="feature alt reverse" id="lens">
          <div className="feature-text">
            <p className="step">Step 2 of 4</p>
            <h2>Ingredient lens</h2>
            <p>
              Every E-number and additive gets decoded into what it's actually for — thickener,
              preservative, colour — so the label reads like a sentence, not a chemistry exam.
            </p>
            <div className="tag-row">
              <span className="tag">Plain-language decode</span>
              <span className="tag">Source-linked</span>
            </div>
          </div>
          <div className="feature-visual">
            <RevealIcon>
              <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
                <g fontFamily="JetBrains Mono, monospace" fontSize="13" fill="#5B6154">
                  <text x="40" y="70">
                    Water, Sugar, Cocoa (12%),
                  </text>
                  <text x="40" y="95">
                    Milk Powder, Emulsifier
                  </text>
                  <text x="40" y="120" fill="#12140F">
                    (Soy Lecithin), Salt,
                  </text>
                  <text x="40" y="145">
                    Natural Flavouring,
                  </text>
                  <text x="40" y="170" fill="#12140F">
                    Stabiliser (E466)
                  </text>
                </g>
                <rect
                  x="30"
                  y="150"
                  width="220"
                  height="24"
                  fill="none"
                  stroke="#E23F26"
                  strokeWidth="1.5"
                />
              </svg>
            </RevealIcon>
          </div>
        </section>

        <section className="feature" id="alert">
          <div className="feature-text">
            <p className="step">Step 3 of 4</p>
            <h2>Allergen alert</h2>
            <p>
              Set what you personally react to once. From then on, a match surfaces as an immediate
              red flag — before the item ever reaches the trolley.
            </p>
            <div className="tag-row">
              <span className="tag">Personal profile</span>
              <span className="tag">14 EU allergens</span>
              <span className="tag">Cross-contact notes</span>
            </div>
          </div>
          <div className="feature-visual">
            <RevealIcon>
              <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
                <polygon
                  points="150,55 260,235 40,235"
                  fill="none"
                  stroke="#E23F26"
                  strokeWidth="3"
                />
                <line
                  x1="150"
                  y1="115"
                  x2="150"
                  y2="180"
                  stroke="#E23F26"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="150" cy="205" r="4" fill="#E23F26" />
              </svg>
            </RevealIcon>
          </div>
        </section>

        <section className="feature alt reverse" id="score">
          <div className="feature-text">
            <p className="step">Step 4 of 4</p>
            <h2>Nutrition score</h2>
            <p>
              Sugar, salt, fat and processing level collapse into one plain read: good to go, fine
              occasionally, or worth swapping. Skip the table, keep the decision.
            </p>
            <div className="tag-row">
              <span className="tag">One-glance rating</span>
              <span className="tag">Better swaps</span>
            </div>
          </div>
          <div className="feature-visual">
            <RevealIcon>
              <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
                <circle cx="150" cy="150" r="95" fill="none" stroke="#D8DCCD" strokeWidth="14" />
                <circle
                  cx="150"
                  cy="150"
                  r="95"
                  fill="none"
                  stroke="#2F6B3C"
                  strokeWidth="14"
                  strokeDasharray="597"
                  strokeDashoffset="150"
                  strokeLinecap="round"
                  transform="rotate(-90 150 150)"
                />
                <text
                  x="150"
                  y="160"
                  textAnchor="middle"
                  fontFamily="Archivo, sans-serif"
                  fontWeight="900"
                  fontSize="42"
                  fill="#12140F"
                >
                  B+
                </text>
              </svg>
            </RevealIcon>
          </div>
        </section>

        <section className="demo" id="demo">
          <p className="kicker">Live scan</p>
          <h2>Scan a real product</h2>
          <p className="lead">
            Opens your back camera and reads any barcode in view, checked live against the Open Food
            Facts database — works on real products, not just a fixed demo set.
          </p>

          <div className="demo-stage">
            <ProfileBar profile={profile} onOpen={() => setWizardOpen(true)} />
            <div className={`scan-window ${scanState === "live" ? "scanning" : ""}`}>
              <video
                ref={videoRef}
                className="scan-video"
                style={{ display: scanState === "live" ? "block" : "none" }}
                muted
                autoPlay
                playsInline
              />
              {scanState !== "live" && (
                <span className="product-label mono">
                  {scanState === "requesting" ? "Requesting camera…" : "Camera idle"}
                </span>
              )}
              {scanState === "live" && <div className="beam" />}
              {scanState === "live" && <div className="reticle" aria-hidden="true" />}
            </div>

            {(scanState === "idle" || scanState === "requesting") && (
              <button
                className="btn btn-primary"
                style={{ marginBottom: 8 }}
                onClick={startScan}
                disabled={scanState === "requesting"}
              >
                {scanState === "requesting" ? "Starting camera…" : "Scan this product"}
              </button>
            )}

            {scanState === "live" && (
              <button className="btn btn-ghost" style={{ marginBottom: 8 }} onClick={tryAgain}>
                Cancel scan
              </button>
            )}

            {scanState === "error" && (
              <div className="scan-error">
                <p>{errorMessage}</p>
                <button className="btn btn-ghost" onClick={tryAgain}>
                  Try again
                </button>
              </div>
            )}

            {scanState === "not-found" && (
              <div className="scan-error">
                <p>No product found for barcode {scannedCode} in Open Food Facts.</p>
                <button className="btn btn-ghost" onClick={tryAgain}>
                  Scan another
                </button>
              </div>
            )}

            <SearchPanel onPick={openProduct} onError={showError} />
            <PhotoPanel onResult={openProduct} />

            {product && scanState === "found" && (
              <div
                className="pm"
                role="dialog"
                aria-modal="true"
                aria-label={`${product.name} details`}
                onClick={(e) => e.target === e.currentTarget && tryAgain()}
              >
                <div className="pm-card" ref={modalRef}>
                  <button className="pm-close" onClick={tryAgain} aria-label="Close">
                    ×
                  </button>
                  <div className="result show">
                    <div className="pm-top">
                      <ProductImage product={product} />
                      <div>
                        <p className="kicker">Scan result</p>
                        <h3>{product.name}</h3>
                        {product.brand && <p className="pm-brand">{product.brand}</p>}
                        <span className={`score ${product.scoreClass}`}>
                          Score: {product.score}
                        </span>
                      </div>
                    </div>
                    <VerdictBanner
                      profile={profile}
                      product={product}
                      onOpen={() => setWizardOpen(true)}
                    />
                    <IngredientList ingredients={product.ingredients} />
                    <div className="result-grid">
                      <div className="result-col">
                        <p className="col-label">Allergens declared</p>
                        <ul>
                          {product.allergens.map((a) => (
                            <li key={a.name}>
                              <span>{a.name}</span>
                              <span className={a.match ? "flag" : "ok"}>
                                {a.match ? "Present" : "Clear"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <SwapsPanel swaps={swaps} profile={profile} onPick={openProduct} />
                    <ShareRow product={product} profile={profile} />
                    <p className="disclaimer">
                      {product.source === "photo"
                        ? "Read from your photo — text recognition can make mistakes, so check against the label. Not medical or dietary advice."
                        : product.source === "sample"
                          ? "Sample data for demonstration — not medical or dietary advice."
                          : "Live data from Open Food Facts — not medical or dietary advice."}
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 20 }}
                      onClick={tryAgain}
                    >
                      Scan another
                    </button>
                  </div>
                </div>
              </div>
            )}

            <HistoryPanel
              items={history}
              profile={profile}
              onPick={openProduct}
              onClear={() => setHistory(clearHistory())}
            />

            <div className="sample-row" role="group" aria-label="No camera handy? Try a sample">
              <span className="sample-label">No camera handy? Try a sample instead</span>
              {SAMPLE_PRODUCTS.map((p) => (
                <button key={p.barcode} className="sample-btn" onClick={() => selectSample(p)}>
                  {p.name.split(" ").slice(0, 2).join(" ")}
                </button>
              ))}
            </div>
            <SourcesNote />
          </div>
        </section>

        <section className="manifesto" id="manifesto">
          <blockquote>
            You shouldn't need a chemistry degree to eat breakfast.{" "}
            <span className="accent">Every label has a plain answer</span> — we just point the
            camera and read it out loud.
          </blockquote>
        </section>

        <section className="faq" id="faq">
          <div className="faq-inner">
            <h2>Questions worth answering upfront</h2>

            <details className="faq-item">
              <summary>Is the nutrition score medical advice?</summary>
              <p>
                No. It's a quick, plain-language summary of sugar, salt, fat and processing level —
                useful for everyday choices, not a substitute for guidance from a doctor or
                dietitian, especially if you're managing a health condition.
              </p>
            </details>

            <details className="faq-item">
              <summary>Does scanning work without an internet connection?</summary>
              <p>
                Reading the barcode itself happens on-device and works offline. Looking up the
                product's details requires a connection, since that data comes live from the Open
                Food Facts database rather than being stored on your phone.
              </p>
            </details>

            <details className="faq-item">
              <summary>How reliable is the allergen match?</summary>
              <p>
                It's only as accurate as the manufacturer's declared data on file. For severe
                allergies, always check the physical label too — cross-contact warnings in
                particular aren't consistently reported across products.
              </p>
            </details>

            <details className="faq-item">
              <summary>What happens if a product isn't found?</summary>
              <p>
                Open Food Facts is large but community-maintained, so fresh produce, loose items,
                and small regional brands are sometimes missing. You'll see a clear "not found"
                message rather than a guess.
              </p>
            </details>

            <details className="faq-item">
              <summary>Is my scan history or health profile stored anywhere?</summary>
              <p>
                Your health profile and your last 12 scans are saved only in this browser, on your
                device — never on our servers. Photos of ingredient lists are read on your device
                and aren't uploaded. You can clear your history any time, or clear your browser data
                to remove everything.
              </p>
            </details>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-top">
          <h2>
            Start scanning
            <br />
            what you eat.
          </h2>
          <a href="#demo" className="btn btn-primary">
            Scan your first product
          </a>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SCN. — Food Intelligence</span>
          <div className="footer-links">
            <a href="#problem">Why</a>
            <a href="#scan">How it works</a>
            <a href="#demo">Scan</a>
            <a href="#faq">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
