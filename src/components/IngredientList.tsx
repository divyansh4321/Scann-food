import { useState } from "react";
import { explain, KIND_LABEL } from "@/lib/additives";
import type { Ingredient } from "@/lib/off";

export function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  const [onlyAdditives, setOnly] = useState(false);
  const rows = ingredients.map((i) => ({ i, ex: explain(i.name) }));
  const count = rows.reduce(
    (n, r) =>
      n + r.ex.filter((e) => e.kind !== "fat" && e.kind !== "sugar" && e.kind !== "flavour").length,
    0,
  );
  const shown = onlyAdditives ? rows.filter((r) => r.ex.length) : rows;

  return (
    <div className="ing-wrap">
      <div className="ing-head">
        <p className="col-label">
          What’s inside · {ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"}
          {count ? ` · ${count} additive${count === 1 ? "" : "s"} explained` : ""}
        </p>
        <div className="ing-tabs" role="group" aria-label="Filter ingredients">
          <button className={!onlyAdditives ? "on" : ""} onClick={() => setOnly(false)}>
            All
          </button>
          <button className={onlyAdditives ? "on" : ""} onClick={() => setOnly(true)}>
            Additives &amp; notes
          </button>
        </div>
      </div>
      <p className="ing-note">Listed from the largest amount to the smallest, as on the pack.</p>
      <ol className="ing-list">
        {shown.map(({ i, ex }, idx) => {
          const watch = ex.some((e) => e.watch);
          return (
            <li key={`${i.name}-${idx}`} className="ing">
              <div className="ing-name">
                <span>{i.name}</span>
                {i.flag || watch ? (
                  <span className="flag">Review</span>
                ) : (
                  <span className="ok">Clear</span>
                )}
              </div>
              {ex.map((e) => (
                <div key={e.id} className={`ing-ex${e.unknown ? " unk" : ""}`}>
                  <div className="ing-ex-h">
                    <b>{e.code && e.code !== e.label ? `${e.code} · ${e.label}` : e.label}</b>
                    <span className={`kind k-${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                  </div>
                  <p>{e.plain}</p>
                  {e.watch && <p className="watch">⚠ {e.watch}</p>}
                </div>
              ))}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="ing-note">No additives found in the ingredient text.</li>
        )}
      </ol>
    </div>
  );
}
