"use client";

// Lot 74h (D7, G8, P-16 ; page 30 des maquettes du lot 68) — « ✓ Enregistré » à côté d'un réglage isolé :
// en encre (pas en couleur d'action), annoncé par role="status", effacé après quelques secondes
// (SAVED_VISIBLE_MS). En cas d'échec, l'erreur s'écrit sous le champ (forme du lot 70b, FieldError) et la
// valeur d'avant est rendue par AutoSettingForm.
//
// Réemploi (vagues 74i et 74j) :
// - dans un AutoSettingForm (auto-setting-form.tsx), poser `<SettingStatus name="champ" />` à côté de la
//   commande : il suit l'enregistrement de ce champ ;
// - ailleurs (une ligne d'AutosaveList, un enregistrement maison), `<SavedIndicator status=… labels=… />`.
// Les mots viennent du serveur (`savedIndicatorLabels()`), jamais du catalogue du navigateur (NFR-02).
import { useEffect, useState } from "react";
import { SAVED_VISIBLE_MS } from "@/lib/settings/settings-pattern-model";

export type SavedStatus = "idle" | "saving" | "saved";
export type SavedLabels = { saved: string; saving: string; failed: string };

export function SavedIndicator({ status, labels, stamp, id }: { status: SavedStatus; labels: SavedLabels; stamp?: number | undefined; id?: string | undefined }) {
  const [visible, setVisible] = useState(status !== "idle");
  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status !== "saved") return;
    const timer = window.setTimeout(() => setVisible(false), SAVED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
    // `stamp` : un nouvel enregistrement du même réglage relance l'affichage.
  }, [status, stamp]);
  const shown = visible && status !== "idle";
  return (
    <span id={id} role="status" className="saved-indicator" data-status={shown ? status : "idle"}>
      {shown && status === "saved" ? (
        <>
          <span aria-hidden="true">✓ </span>
          {labels.saved}
        </>
      ) : shown && status === "saving" ? (
        labels.saving
      ) : null}
    </span>
  );
}
