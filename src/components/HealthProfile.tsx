import { useEffect, useState } from "react";
import { AL, CO, DI, analyze, verdictHead, type Analyzable, type Profile } from "@/lib/health";

type Key = "al" | "co" | "di";
type Draft = Profile & { step: number };

const STEPS: { title: (n: string) => string; sub: string; key?: Key; opts?: [string, string][] }[] =
  [
    {
      title: () => "First things first — what should we call you?",
      sub: "Just a first name. It stays in your browser.",
    },
    {
      title: (n) => `Any allergies, ${n}?`,
      sub: "Pick all that apply — we’ll flag these instantly.",
      key: "al",
      opts: AL.map(([k, l]) => [k, l]),
    },
    {
      title: () => "Any health conditions we should know about?",
      sub: "So we can warn you about sugar, salt, fats and more.",
      key: "co",
      opts: CO,
    },
    {
      title: () => "Anything else you’re watching?",
      sub: "Optional preferences.",
      key: "di",
      opts: DI,
    },
  ];

export function HealthProfileWizard({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: Profile | null;
  onSave: (p: Profile) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Draft>({ name: "", al: [], co: [], di: [], step: 0 });

  useEffect(() => {
    if (open)
      setD({
        name: initial?.name ?? "",
        al: [...(initial?.al ?? [])],
        co: [...(initial?.co ?? [])],
        di: [...(initial?.di ?? [])],
        step: 0,
      });
  }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;

  const toggle = (k: Key, v: string) =>
    setD((x) => ({
      ...x,
      [k]: v === "" ? [] : x[k].includes(v) ? x[k].filter((i) => i !== v) : [...x[k], v],
    }));
  const next = () => {
    if (d.step === 4) onSave({ name: d.name.trim() || "Friend", al: d.al, co: d.co, di: d.di });
    else setD((x) => ({ ...x, step: x.step + 1 }));
  };
  const s = d.step;
  const st = STEPS[s] ?? STEPS[0]!;
  const n = d.name.trim() || "friend";

  const labels = (k: Key, o: [string, string][]) =>
    o.filter((x) => d[k].includes(x[0])).map((x) => x[1]);
  const all = [
    ...labels(
      "al",
      AL.map(([k, l]) => [k, l]),
    ),
    ...labels("co", CO),
    ...labels("di", DI),
  ];

  return (
    <div
      className="wz open"
      role="dialog"
      aria-modal="true"
      aria-label="Health profile"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="wz-card">
        <div className="wz-bar">
          <i style={{ width: `${(s / 4) * 100}%` }} />
        </div>
        <div className="wz-step" key={s}>
          {s < 4 ? (
            <>
              <p className="kicker">Question {s + 1} of 4</p>
              <h3>{st.title(n)}</h3>
              <p className="wz-s">{st.sub}</p>
              {s === 0 ? (
                <input
                  className="wz-in"
                  autoFocus
                  maxLength={24}
                  placeholder="Your first name"
                  value={d.name}
                  onChange={(e) => setD({ ...d, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                />
              ) : (
                <div className="chips">
                  {st.opts!.map(([v, l]) => (
                    <button
                      key={v}
                      className={`chip${d[st.key!].includes(v) ? " on" : ""}`}
                      onClick={() => toggle(st.key!, v)}
                    >
                      {l}
                    </button>
                  ))}
                  <button
                    className={`chip${d[st.key!].length ? "" : " on"}`}
                    onClick={() => toggle(st.key!, "")}
                  >
                    None of these
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="kicker">
                <b>All set</b>
              </p>
              <h3>Looks good, {n}.</h3>
              <p className="wz-s">Here’s what SCN. will watch for on every scan:</p>
              <div className="chips">
                {all.length ? (
                  all.map((x) => (
                    <span key={x} className="chip on">
                      {x}
                    </span>
                  ))
                ) : (
                  <span className="chip">No special flags</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="wz-nav">
          {s ? (
            <button
              className="btn btn-ghost"
              onClick={() => setD((x) => ({ ...x, step: x.step - 1 }))}
            >
              Back
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>
              Skip for now
            </button>
          )}
          <button className="btn btn-primary" onClick={next}>
            {s === 4 ? "Create my profile" : "Continue"}
          </button>
        </div>
        <p className="wz-note">
          Saved only in this browser. SCN. gives guidance, not medical advice.
        </p>
      </div>
    </div>
  );
}

export function ProfileBar({ profile, onOpen }: { profile: Profile | null; onOpen: () => void }) {
  return (
    <div className="profbar">
      {profile ? (
        <span>
          👤 <b>{profile.name}’s health profile</b> · {profile.al.length} allerg
          {profile.al.length === 1 ? "y" : "ies"} · {profile.co.length} condition
          {profile.co.length === 1 ? "" : "s"}
        </span>
      ) : (
        <span>Get warnings tailored to your health.</span>
      )}
      <button onClick={onOpen}>{profile ? "Edit profile" : "Create health profile"}</button>
    </div>
  );
}

export function VerdictBanner({
  profile,
  product,
  onOpen,
}: {
  profile: Profile | null;
  product: Analyzable;
  onOpen: () => void;
}) {
  if (!profile)
    return (
      <div className="vd info">
        <b>Want warnings made for you?</b>
        <span>
          Create a quick health profile and SCN. will flag allergens and nutrients that matter for
          your health.
        </span>
        <button className="btn btn-primary" onClick={onOpen}>
          Create health profile
        </button>
      </div>
    );
  const a = analyze(profile, product);
  const cls = a.dataGap ? "info" : ["ok", "warn", "bad"][a.level];
  const head = verdictHead(a);
  return (
    <div className={`vd ${cls}`}>
      <b>{head}</b>
      {a.reasons.length ? (
        <ul>
          {a.reasons.map(([t]) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        <span>No red flags for {profile.name}. Still glance at the physical label.</span>
      )}
      {a.level === 1 && a.cap ? (
        <span className="cap">
          Suggested limit: about {a.cap} {a.unit} at a time, counted against your daily allowance.
        </span>
      ) : null}
      <small>
        Based on {profile.name}’s profile · limits from NHS/FSA, WHO, AHA and FDA/EFSA guidance ·
        not medical advice
      </small>
    </div>
  );
}

export function SourcesNote() {
  const L = (href: string, t: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <u>{t}</u>
    </a>
  );
  return (
    <details className="faq-item" style={{ marginTop: 24, textAlign: "left" }}>
      <summary>Where do these health warnings come from?</summary>
      <p>
        Warnings use published guidance, not guesswork. “High / medium” nutrient levels follow the{" "}
        {L(
          "https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/how-to-read-food-labels/",
          "NHS / UK FSA traffic-light criteria",
        )}{" "}
        (per 100 g: sugars 5 / 22.5 g, saturated fat 1.5 / 5 g, salt 0.3 / 1.5 g). Daily limits come
        from the {L("https://www.who.int/news-room/fact-sheets/detail/healthy-diet", "WHO")} (free
        sugars under 10%, ideally 5% of energy; salt under 5 g), the{" "}
        {L(
          "https://www.heart.org/en/news/2019/10/25/overall-heart-healthy-diet-is-more-important-than-occasional-indulgences",
          "American Heart Association",
        )}{" "}
        (sodium 1,500 mg ideal; saturated fat under 6% of calories) and NHS advice on caffeine in
        pregnancy (under 200 mg a day). Aspartame and PKU follows{" "}
        {L("https://www.fda.gov/food/food-additives-petitions/high-intensity-sweeteners", "FDA")}{" "}
        and EFSA labelling rules.
      </p>
      <p>
        Portions assume a standard adult diet of about 2,000 kcal, with one serving using up to a
        quarter of your daily allowance. Drinks use the stricter per-100 ml drink cut-offs.
        Children’s diets can differ. This is general guidance, not a diagnosis — your doctor or
        dietitian’s advice always comes first.
      </p>
    </details>
  );
}
