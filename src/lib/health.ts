// Health-profile rules. Sources: NHS/UK FSA traffic-light criteria (per 100 g),
// WHO healthy-diet guidance, AHA sodium & saturated-fat limits, NHS caffeine-in-pregnancy
// advice, FDA/EFSA aspartame (PKU) labelling rules.
export type Profile = { name: string; al: string[]; co: string[]; di: string[] };
export type Nutr = { su?: number | undefined; sa?: number | undefined; sf?: number | undefined }; // sugars, salt, saturated fat per 100 g
export type Analyzable = {
  name: string;
  ingredients: { name: string; flag: boolean }[];
  allergens: { name: string; match: boolean }[];
  nutrients?: Nutr | undefined;
  categories?: string[] | undefined;
};
export type Analysis = {
  level: 0 | 1 | 2;
  reasons: [string, number][];
  cap: number | null;
  unit: "g" | "ml";
  dataGap: boolean;
};

export const verdictHead = (a: Analysis) =>
  a.dataGap
    ? "⚠ Not enough data to be sure"
    : (["✓ Looks fine for your profile", "⚠ Eat in moderation", "✕ Best not to eat this"][
        a.level
      ] ?? "");

export const isDrink = (p: Analyzable) =>
  (p.categories ?? []).some((c) => /(^|:)(beverages?|drinks?|sodas?|waters?|juices?)/.test(c));

export const AL: [string, string, string[]][] = [
  ["peanut", "🥜 Peanuts", ["peanut"]],
  [
    "tree",
    "🌰 Tree nuts",
    ["almond", "hazelnut", "cashew", "walnut", "pistachio", "pecan", "tree nut"],
  ],
  ["milk", "🥛 Milk", ["milk", "dairy", "lactose", "whey", "casein"]],
  ["egg", "🥚 Eggs", ["egg"]],
  ["gluten", "🌾 Gluten", ["gluten", "wheat", "barley", "rye"]],
  ["soy", "🫘 Soy", ["soy"]],
  ["fish", "🐟 Fish", ["fish"]],
  ["shell", "🦐 Shellfish", ["shellfish", "crustacean", "shrimp", "mollus"]],
  ["sesame", "🌿 Sesame", ["sesame"]],
];
export const CO: [string, string][] = [
  ["diabetes", "🩸 Diabetes"],
  ["bp", "❤️ High blood pressure"],
  ["heart", "🫀 Heart disease / high cholesterol"],
  ["kidney", "🧪 Kidney disease"],
  ["weight", "⚖️ Weight management"],
  ["pku", "🧬 Phenylketonuria (PKU)"],
  ["preg", "🤰 Pregnancy"],
];
export const DI: [string, string][] = [
  ["lowsugar", "🍬 Cut down sugar"],
  ["lowsalt", "🧂 Cut down salt"],
  ["noadd", "🚫 Avoid additives"],
  ["palm", "🌴 Avoid palm oil"],
];

const KEY = "scn-profile";
export function loadProfile(): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function analyze(prof: Profile, p: Analyzable): Analysis {
  const T = [
    p.name,
    ...p.ingredients.map((i) => i.name),
    ...p.allergens.filter((a) => a.match).map((a) => a.name),
  ]
    .join(" ")
    .toLowerCase();
  const m = p.nutrients ?? {};
  const drink = isDrink(p);
  const unit = drink ? "ml" : "g";
  const R = new Map<string, number>();
  const gaps = new Set<string>();
  const { co: c, di: d } = prof;
  let cap: number | null = null;
  const has = (r: RegExp) => r.test(T);
  const add = (l: number, t: string, g?: number) => {
    if (!R.has(t)) R.set(t, l);
    if (g) cap = cap ? Math.min(cap, g) : g;
  };
  // v = nutrient per 100 g/ml; hi/mid = NHS/FSA cut-offs (food or drink); bud = grams one serving may use
  const chk = (
    v: number | undefined,
    hi: number,
    mid: number,
    bud: number,
    lab: string,
    why: string,
  ) => {
    if (v == null || isNaN(v)) return void gaps.add(lab);
    if (v <= mid) return;
    const g = Math.round(((bud / v) * 100) / 5) * 5;
    if (g >= 100) return;
    const val = +v.toFixed(1);
    const L = v > hi ? "High" : "Medium";
    if (g < 20)
      add(
        2,
        `${L} in ${lab} (${val} g/100${unit}) — even a small portion uses up your daily allowance. ${why}`,
      );
    else add(1, `${L} in ${lab} (${val} g/100${unit}). ${why}`, g);
  };

  AL.forEach(([k, l, kw]) => {
    if (prof.al.includes(k) && kw.some((w) => T.includes(w)))
      add(2, `Contains ${l.replace(/^\S+\s/, "")} — you listed this allergy`);
  });
  if (prof.al.length && p.ingredients.every((i) => /^No ingredient/i.test(i.name)))
    add(
      1,
      "No ingredient list on file, so we can’t confirm it’s free of your allergens. Check the label.",
    );
  if (c.includes("diabetes") || c.includes("weight") || d.includes("lowsugar"))
    chk(
      m.su,
      drink ? 11.25 : 22.5,
      drink ? 2.5 : 5,
      6.25,
      "sugar",
      "WHO: free sugars ideally under 25 g a day (5% of energy); sugar raises blood glucose.",
    );
  const bp = c.includes("bp") || c.includes("kidney");
  if (bp || d.includes("lowsalt"))
    chk(
      m.sa,
      drink ? 0.75 : 1.5,
      0.3,
      bp ? 0.9 : 1.25,
      "salt",
      bp
        ? "AHA: ideal limit is 1,500 mg sodium (3.75 g salt) a day."
        : "WHO: under 5 g salt a day.",
    );
  const h = c.includes("heart");
  if (h || c.includes("weight"))
    chk(
      m.sf,
      drink ? 2.5 : 5,
      drink ? 0.75 : 1.5,
      h ? 3.3 : 5.5,
      "saturated fat",
      h
        ? "AHA: under 6% of calories (about 13 g a day) for cholesterol."
        : "WHO: under 10% of calories (about 22 g a day).",
    );
  if (gaps.size)
    add(
      1,
      `No ${[...gaps].join(" / ")} data for this product, so we couldn’t check it against your health profile. Check the label.`,
    );
  if (c.includes("pku") && has(/aspartame|phenylalanine/))
    add(2, "Contains aspartame / phenylalanine — people with PKU must avoid it (FDA, EFSA)");
  if (c.includes("preg") && has(/caffeine/))
    add(
      1,
      "Contains caffeine — NHS advises under 200 mg a day in pregnancy; check the amount on the label",
    );
  if (c.includes("kidney") && has(/phosphor/))
    add(1, "Phosphate additive — can burden the kidneys");
  if (d.includes("noadd") && has(/\be\d{3,4}\b|aspartame|msg|monosodium/))
    add(1, "Contains additives you chose to avoid");
  if (d.includes("palm") && has(/palm oil/)) add(1, "Contains palm oil, which you chose to avoid");

  const reasons = [...R].sort((a, b) => b[1] - a[1]);
  const gapTexts = new Set(
    [...R.keys()].filter((t) => /^No (ingredient list|.* data for this product)/.test(t)),
  );
  const real = reasons.filter(([t]) => !gapTexts.has(t));
  return {
    level: (reasons[0]?.[1] ?? 0) as 0 | 1 | 2,
    reasons,
    cap,
    unit,
    dataGap: reasons.length > 0 && real.length === 0,
  };
}
