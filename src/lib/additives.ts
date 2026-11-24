// Plain-language notes for common additives and ingredients. Purposes follow the EU/UK
// additive classes (E-numbers); "watch" notes only state widely documented labelling rules
// or well-known sensitivities, not opinions.
export type Kind =
  | "colour"
  | "preservative"
  | "antioxidant"
  | "emulsifier"
  | "thickener"
  | "acidity"
  | "sweetener"
  | "enhancer"
  | "raising"
  | "anticaking"
  | "glazing"
  | "flavour"
  | "sugar"
  | "fat"
  | "starch"
  | "other";
export type Explained = {
  id: string;
  code?: string;
  label: string;
  kind: Kind;
  plain: string;
  watch?: string;
  unknown?: boolean;
};

export const KIND_LABEL: Record<Kind, string> = {
  colour: "Colour",
  preservative: "Preservative",
  antioxidant: "Antioxidant",
  emulsifier: "Emulsifier",
  thickener: "Thickener / stabiliser",
  acidity: "Acidity regulator",
  sweetener: "Sweetener",
  enhancer: "Flavour enhancer",
  raising: "Raising agent",
  anticaking: "Anti-caking",
  glazing: "Glazing agent",
  flavour: "Flavouring",
  sugar: "Sugar-type ingredient",
  fat: "Fat / oil",
  starch: "Starch / filler",
  other: "Additive",
};

type Def = {
  id: string;
  codes: string[];
  names: string[];
  label: string;
  kind: Kind;
  plain: string;
  watch?: string;
};
const D = (
  id: string,
  codes: string,
  names: string,
  label: string,
  kind: Kind,
  plain: string,
  watch?: string,
): Def => ({
  id,
  codes: codes ? codes.split(" ") : [],
  names: names ? names.split("|") : [],
  label,
  kind,
  plain,
  ...(watch ? { watch } : {}),
});
const KIDS =
  "In the EU/UK, foods with this dye must warn it may affect activity and attention in children.";
const POLY = "Large amounts can have a laxative effect.";
const SULPH =
  "Can trigger symptoms in some people with asthma or sulphite sensitivity; it must be declared as an allergen.";

const DEFS: Def[] = [
  D("curcumin", "100", "curcumin", "Curcumin", "colour", "Yellow colour made from turmeric."),
  D(
    "riboflavin",
    "101",
    "riboflavin",
    "Riboflavin (vitamin B2)",
    "colour",
    "Vitamin B2, used here to give a yellow colour.",
  ),
  D("tartrazine", "102", "tartrazine", "Tartrazine", "colour", "Synthetic yellow dye.", KIDS),
  D(
    "quinoline",
    "104",
    "quinoline yellow",
    "Quinoline yellow",
    "colour",
    "Synthetic yellow dye.",
    KIDS,
  ),
  D("sunset", "110", "sunset yellow", "Sunset yellow FCF", "colour", "Synthetic orange dye.", KIDS),
  D(
    "carmoisine",
    "122",
    "carmoisine|azorubine",
    "Carmoisine",
    "colour",
    "Synthetic red dye.",
    KIDS,
  ),
  D("ponceau", "124", "ponceau", "Ponceau 4R", "colour", "Synthetic red dye.", KIDS),
  D("allura", "129", "allura red", "Allura red AC", "colour", "Synthetic red dye.", KIDS),
  D(
    "carmine",
    "120",
    "carmine|cochineal",
    "Carmine (cochineal)",
    "colour",
    "Red colour made from crushed insects, so not vegetarian or vegan.",
  ),
  D(
    "brilliantblue",
    "133",
    "brilliant blue",
    "Brilliant blue FCF",
    "colour",
    "Synthetic blue dye.",
  ),
  D("chlorophyll", "140 141", "chlorophyll", "Chlorophyll", "colour", "Green colour from plants."),
  D(
    "caramel",
    "150a 150b 150c 150d 150",
    "caramel colour|caramel color",
    "Caramel colour",
    "colour",
    "Brown colour made by heating sugars. It adds colour, not sweetness.",
  ),
  D(
    "carotene",
    "160a",
    "carotene",
    "Carotenes",
    "colour",
    "Orange-yellow colour, from carrots and other plants.",
  ),
  D(
    "annatto",
    "160b",
    "annatto",
    "Annatto",
    "colour",
    "Orange colour from the seeds of a tropical plant.",
  ),
  D(
    "paprika",
    "160c",
    "paprika extract",
    "Paprika extract",
    "colour",
    "Red-orange colour from peppers.",
  ),
  D(
    "beetroot",
    "162",
    "beetroot red|betanin",
    "Beetroot red",
    "colour",
    "Red-pink colour from beetroot.",
  ),
  D(
    "anthocyanin",
    "163",
    "anthocyanin",
    "Anthocyanins",
    "colour",
    "Red-purple colours from fruit and vegetables.",
  ),
  D(
    "tio2",
    "171",
    "titanium dioxide",
    "Titanium dioxide",
    "colour",
    "White colouring.",
    "No longer permitted as a food additive in the EU since 2022.",
  ),
  D(
    "ironoxide",
    "172",
    "iron oxide",
    "Iron oxides",
    "colour",
    "Mineral colours (yellow, red, black).",
  ),
  D(
    "sorbic",
    "200 202",
    "sorbic acid|potassium sorbate",
    "Sorbic acid / sorbates",
    "preservative",
    "Stops mould and yeast so food lasts longer.",
  ),
  D(
    "benzoate",
    "210 211 212 213",
    "benzoic acid|sodium benzoate|potassium benzoate",
    "Benzoates",
    "preservative",
    "Stops mould and bacteria, mostly in drinks and sauces.",
  ),
  D(
    "sulphite",
    "220 221 222 223 224 225 226 227 228",
    "sulphite|sulfite|sulphur dioxide|sulfur dioxide|metabisulphite",
    "Sulphites",
    "preservative",
    "Keeps food from spoiling or browning, common in dried fruit and wine.",
    SULPH,
  ),
  D(
    "nisin",
    "234",
    "nisin",
    "Nisin",
    "preservative",
    "A natural antibacterial made by bacteria, used in cheese.",
  ),
  D(
    "nitrite",
    "249 250",
    "sodium nitrite|potassium nitrite",
    "Nitrites",
    "preservative",
    "Cures meat, keeps it pink and stops dangerous bacteria.",
    "Used in processed meat, which health bodies advise eating only in small amounts.",
  ),
  D(
    "nitrate",
    "251 252",
    "sodium nitrate|potassium nitrate",
    "Nitrates",
    "preservative",
    "Cures meat and some cheeses; the body can turn it into nitrite.",
    "Used in processed meat, which health bodies advise eating only in small amounts.",
  ),
  D("aceticacid", "260", "acetic acid", "Acetic acid", "acidity", "The sour part of vinegar."),
  D(
    "lacticacid",
    "270",
    "lactic acid",
    "Lactic acid",
    "acidity",
    "Gives a mild sour taste; also helps preserve.",
  ),
  D(
    "propionate",
    "280 281 282 283",
    "propionate|propionic acid",
    "Propionates",
    "preservative",
    "Stops mould, mostly in bread and baked goods.",
  ),
  D(
    "vitc",
    "300 301 302",
    "ascorbic acid|sodium ascorbate",
    "Ascorbic acid (vitamin C)",
    "antioxidant",
    "Vitamin C, added to stop food going brown or stale.",
  ),
  D(
    "tocopherol",
    "306 307 308 309",
    "tocopherol",
    "Tocopherols (vitamin E)",
    "antioxidant",
    "Vitamin E, stops fats and oils going rancid.",
  ),
  D(
    "erythorbic",
    "315 316",
    "erythorbic",
    "Erythorbic acid",
    "antioxidant",
    "Works like vitamin C to keep colour and freshness.",
  ),
  D(
    "bha",
    "320",
    "butylated hydroxyanisole",
    "BHA",
    "antioxidant",
    "Synthetic antioxidant that stops fats going rancid.",
  ),
  D(
    "bht",
    "321",
    "butylated hydroxytoluene",
    "BHT",
    "antioxidant",
    "Synthetic antioxidant that stops fats going rancid.",
  ),
  D(
    "citricacid",
    "330",
    "citric acid",
    "Citric acid",
    "acidity",
    "The sour acid found in lemons; adds tang and helps preserve.",
  ),
  D(
    "citrates",
    "331 332 333",
    "sodium citrate|potassium citrate|calcium citrate",
    "Citrates",
    "acidity",
    "Salts of citric acid that control acidity.",
  ),
  D(
    "lecithin",
    "322",
    "lecithin",
    "Lecithin",
    "emulsifier",
    "Keeps oil and water mixed. Usually made from soy or sunflower.",
  ),
  D(
    "lactates",
    "325 326 327",
    "sodium lactate|calcium lactate|potassium lactate",
    "Lactates",
    "acidity",
    "Salts of lactic acid that control acidity and help preserve.",
  ),
  D(
    "tartaric",
    "334 335 336",
    "tartaric acid",
    "Tartaric acid",
    "acidity",
    "A fruit acid (found in grapes) that adds sourness.",
  ),
  D(
    "phosphoricacid",
    "338",
    "phosphoric acid",
    "Phosphoric acid",
    "acidity",
    "Gives colas their sharp tang.",
  ),
  D(
    "phosphates",
    "339 340 341 450 451 452",
    "phosphate",
    "Phosphates",
    "acidity",
    "Help texture and moisture; also control acidity and keep powders loose.",
  ),
  D("malic", "296", "malic acid", "Malic acid", "acidity", "The sour acid found in apples."),
  D(
    "alginate",
    "400 401 402 403 404",
    "alginate|alginic acid",
    "Alginates",
    "thickener",
    "Thickener from seaweed.",
  ),
  D("agar", "406", "agar", "Agar", "thickener", "Plant-based gelling agent from seaweed."),
  D(
    "carrageenan",
    "407",
    "carrageenan",
    "Carrageenan",
    "thickener",
    "Thickener from seaweed, common in dairy and plant milks.",
  ),
  D(
    "locust",
    "410",
    "locust bean gum|carob gum",
    "Locust bean gum",
    "thickener",
    "Thickener from carob seeds.",
  ),
  D("guar", "412", "guar gum", "Guar gum", "thickener", "Thickener from guar beans."),
  D(
    "arabic",
    "414",
    "gum arabic|acacia",
    "Gum arabic",
    "thickener",
    "Thickener from acacia tree sap.",
  ),
  D(
    "xanthan",
    "415",
    "xanthan",
    "Xanthan gum",
    "thickener",
    "Thickener made by fermenting sugar; keeps sauces smooth.",
  ),
  D("gellan", "418", "gellan", "Gellan gum", "thickener", "Gelling agent made by fermentation."),
  D(
    "glycerol",
    "422",
    "glycerol|glycerine|glycerin",
    "Glycerol",
    "other",
    "Keeps food moist and slightly sweet.",
  ),
  D(
    "polysorbate",
    "432 433 434 435 436",
    "polysorbate",
    "Polysorbates",
    "emulsifier",
    "Keep oil and water mixed.",
  ),
  D("pectin", "440", "pectin", "Pectin", "thickener", "Gelling agent from fruit, used in jams."),
  D(
    "cellulose",
    "460 461 463 464 466",
    "cellulose",
    "Cellulose gums",
    "thickener",
    "Plant-fibre thickeners that add body and stop separation.",
  ),
  D(
    "mdg",
    "471 472a 472b 472c 472d 472e 472f",
    "mono- and diglycerides|mono and diglycerides|mono-and diglycerides|monoglycerides",
    "Mono- and diglycerides",
    "emulsifier",
    "Fat-based emulsifier that keeps texture smooth and soft.",
  ),
  D(
    "polyglycerol",
    "475",
    "polyglycerol",
    "Polyglycerol esters",
    "emulsifier",
    "Emulsifier that improves smoothness.",
  ),
  D(
    "sslactylate",
    "481 482",
    "stearoyl lactylate",
    "Stearoyl lactylates",
    "emulsifier",
    "Emulsifier that makes bread softer and fluffier.",
  ),
  D(
    "bicarb",
    "500",
    "sodium bicarbonate|baking soda|bicarbonate of soda|sodium hydrogen carbonate",
    "Sodium bicarbonate",
    "raising",
    "Baking soda, makes baked goods rise.",
  ),
  D(
    "carbonates",
    "501 503 504",
    "ammonium carbonate|potassium carbonate",
    "Carbonates",
    "raising",
    "Raising agents and acidity controllers.",
  ),
  D(
    "calciumchloride",
    "509",
    "calcium chloride",
    "Calcium chloride",
    "other",
    "Keeps canned vegetables and fruit firm.",
  ),
  D(
    "silica",
    "551 552",
    "silicon dioxide|silica",
    "Silicon dioxide",
    "anticaking",
    "Stops powders clumping.",
  ),
  D(
    "magstearate",
    "470b 572",
    "magnesium stearate",
    "Magnesium stearate",
    "anticaking",
    "Stops powders sticking together or to machinery.",
  ),
  D("co2", "290", "carbon dioxide", "Carbon dioxide", "other", "The gas that makes drinks fizzy."),
  D(
    "msg",
    "621",
    "monosodium glutamate|msg",
    "Monosodium glutamate (MSG)",
    "enhancer",
    "Boosts savoury ‘umami’ taste.",
    "A small number of people report sensitivity to it.",
  ),
  D(
    "glutamates",
    "620 622 623 624 625",
    "glutamate",
    "Glutamates",
    "enhancer",
    "Boost savoury ‘umami’ taste.",
  ),
  D(
    "nucleotides",
    "627 631 635",
    "guanylate|inosinate|ribonucleotides",
    "Flavour-enhancing nucleotides",
    "enhancer",
    "Boost savoury taste, often alongside MSG.",
  ),
  D("beeswax", "901", "beeswax", "Beeswax", "glazing", "Wax coating for a shine; not vegan."),
  D(
    "carnauba",
    "903",
    "carnauba",
    "Carnauba wax",
    "glazing",
    "Plant wax coating for a glossy finish.",
  ),
  D(
    "shellac",
    "904",
    "shellac",
    "Shellac",
    "glazing",
    "Glossy coating made from an insect secretion; not vegan.",
  ),
  D(
    "sorbitol",
    "420",
    "sorbitol",
    "Sorbitol",
    "sweetener",
    "A sugar alcohol that sweetens with fewer calories than sugar.",
    POLY,
  ),
  D(
    "mannitol",
    "421",
    "mannitol",
    "Mannitol",
    "sweetener",
    "A sugar alcohol that sweetens with fewer calories than sugar.",
    POLY,
  ),
  D(
    "isomalt",
    "953",
    "isomalt",
    "Isomalt",
    "sweetener",
    "A sugar alcohol used in sugar-free sweets.",
    POLY,
  ),
  D(
    "maltitol",
    "965",
    "maltitol",
    "Maltitol",
    "sweetener",
    "A sugar alcohol used in sugar-free sweets and chocolate.",
    POLY,
  ),
  D("lactitol", "966", "lactitol", "Lactitol", "sweetener", "A sugar alcohol sweetener.", POLY),
  D(
    "xylitol",
    "967",
    "xylitol",
    "Xylitol",
    "sweetener",
    "A sugar alcohol sweetener, common in chewing gum.",
    POLY,
  ),
  D(
    "erythritol",
    "968",
    "erythritol",
    "Erythritol",
    "sweetener",
    "A sugar alcohol with almost no calories.",
  ),
  D(
    "acesulfame",
    "950",
    "acesulfame",
    "Acesulfame K",
    "sweetener",
    "Artificial sweetener, many times sweeter than sugar.",
  ),
  D(
    "aspartame",
    "951 962",
    "aspartame",
    "Aspartame",
    "sweetener",
    "Artificial sweetener, about 200 times sweeter than sugar.",
    "People with PKU (phenylketonuria) must avoid it; products carry a phenylalanine warning.",
  ),
  D("cyclamate", "952", "cyclamate", "Cyclamate", "sweetener", "Artificial sweetener."),
  D("saccharin", "954", "saccharin", "Saccharin", "sweetener", "Artificial sweetener."),
  D(
    "sucralose",
    "955",
    "sucralose",
    "Sucralose",
    "sweetener",
    "Artificial sweetener made from sugar.",
  ),
  D(
    "stevia",
    "960",
    "steviol|stevia",
    "Steviol glycosides (stevia)",
    "sweetener",
    "Sweetener extracted from stevia leaves.",
  ),
  D("neotame", "961", "neotame", "Neotame", "sweetener", "Artificial sweetener."),
  D(
    "modstarch",
    "",
    "modified starch",
    "Modified starch",
    "starch",
    "Starch treated to thicken or stabilise food. It’s still a starch, just changed so it behaves better in cooking or storage.",
  ),
  D(
    "maltodextrin",
    "",
    "maltodextrin",
    "Maltodextrin",
    "starch",
    "A processed starch that acts as a filler or thickener. It digests quickly, like sugar.",
  ),
  D(
    "glucosesyrup",
    "",
    "glucose syrup|glucose-fructose|fructose syrup|corn syrup|high fructose",
    "Glucose / fructose syrup",
    "sugar",
    "A liquid sugar made from starch; counts as added sugar.",
  ),
  D("dextrose", "", "dextrose", "Dextrose", "sugar", "Another name for glucose, a simple sugar."),
  D(
    "invert",
    "",
    "invert sugar",
    "Invert sugar",
    "sugar",
    "Sugar broken into glucose and fructose; sweeter and keeps food moist.",
  ),
  D(
    "palmoil",
    "",
    "palm oil|palm fat",
    "Palm oil",
    "fat",
    "A cheap vegetable fat high in saturated fat, used for texture and shelf life.",
  ),
  D(
    "hydrogenated",
    "",
    "hydrogenated",
    "Hydrogenated fat",
    "fat",
    "Oil solidified by processing; may contain unhealthy trans fats. Check the label.",
  ),
  D(
    "vegoil",
    "",
    "vegetable oil|vegetable fat",
    "Vegetable oil / fat",
    "fat",
    "The label doesn’t say which plant oil is used.",
  ),
  D(
    "flavouring",
    "",
    "natural flavouring|natural flavour|flavouring|flavoring|flavour",
    "Flavouring",
    "flavour",
    "Added taste. ‘Natural’ means from natural sources, but the exact source isn’t named.",
  ),
  D(
    "yeastextract",
    "",
    "yeast extract",
    "Yeast extract",
    "enhancer",
    "Savoury flavour from yeast; naturally contains glutamates.",
  ),
];

const BY_CODE = new Map<string, Def>();
DEFS.forEach((d) => d.codes.forEach((c) => BY_CODE.set(c, d)));

const MODSTARCH = DEFS.find((d) => d.id === "modstarch")!;
const toExplained = (d: Def, code?: string): Explained => ({
  id: d.id,
  ...(code ? { code } : {}),
  label: d.label,
  kind: d.kind,
  plain: d.plain,
  ...(d.watch ? { watch: d.watch } : {}),
});

/** Finds every additive / notable ingredient mentioned in one ingredient entry. */
export function explain(text: string): Explained[] {
  const out = new Map<string, Explained>();
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/\be\s?(\d{3,4})([a-i]?)\b/g)) {
    const num = m[1] ?? "";
    const full = num + (m[2] ?? "");
    const code = `E${full.toUpperCase().replace(/(\d)([A-I])$/, "$1$2")}`;
    const def =
      BY_CODE.get(full) ?? BY_CODE.get(num) ?? (/^14\d\d$/.test(num) ? MODSTARCH : undefined);
    if (def) out.set(def.id, toExplained(def, code));
    else
      out.set(code, {
        id: code,
        code,
        label: code,
        kind: "other",
        unknown: true,
        plain:
          "A food additive identified by its E-number. We don’t have a plain-language note for it yet; the UK Food Standards Agency and EU lists explain every approved additive.",
      });
  }
  for (const d of DEFS) {
    if (!out.has(d.id) && d.names.some((n) => lower.includes(n)))
      out.set(d.id, toExplained(d, d.codes[0] ? `E${d.codes[0].toUpperCase()}` : undefined));
  }
  return [...out.values()];
}
