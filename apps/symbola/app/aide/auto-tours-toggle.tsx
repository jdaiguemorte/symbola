"use client";

// Lot 10 (AIDE-05) — préférence « Ouvrir les visites automatiquement »,
// gardée dans ce navigateur.
import { useState } from "react";
import { setAutoToursAction } from "./actions";

export function AutoToursToggle({ initial, label }: { initial: boolean; label: string }) {
  const [checked, setChecked] = useState(initial);
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          setChecked(event.target.checked);
          void setAutoToursAction(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}
