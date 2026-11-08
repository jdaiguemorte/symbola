// Lot 16 (IMP-12) — valeur d'une liste « devient » de l'étape « Types » :
// « existing:<id> » (type du carnet), « starter:<clé> » (type de départ),
// « new: » ou « new:<id de famille> » (type créé sous le libellé du fichier),
// « none » (aucun type, fiche « à classer »). Toute autre valeur est refusée.
import type { ImportVendorTypeTarget } from "@/modules/hub/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STARTER_KEY = /^[a-z][a-z0-9_]{0,60}$/;

export function typeTargetValue(target: ImportVendorTypeTarget): string {
  if (target.kind === "existing") return `existing:${target.typeId}`;
  if (target.kind === "starter") return `starter:${target.starterKey}`;
  if (target.kind === "new") return `new:${target.familyId ?? ""}`;
  return "none";
}

export function parseTypeTarget(value: string): ImportVendorTypeTarget | null {
  if (value === "none") return { kind: "none" };
  const separator = value.indexOf(":");
  if (separator < 0) return null;
  const kind = value.slice(0, separator);
  const rest = value.slice(separator + 1);
  if (kind === "existing" && UUID.test(rest)) return { kind: "existing", typeId: rest };
  if (kind === "starter" && STARTER_KEY.test(rest)) return { kind: "starter", starterKey: rest };
  if (kind === "new" && (rest === "" || UUID.test(rest))) return { kind: "new", familyId: rest === "" ? null : rest };
  return null;
}
