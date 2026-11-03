// Les PDF (ADR 0019) sont écrits avec les polices standard de PDF
// (Helvetica), qui n'ont ni l'espace fine insécable (U+202F) ni l'espace
// insécable (U+00A0) qu'emploie le format français des montants et des
// dates : sans ce nettoyage, « 1 500,00 € » s'affiche « 1/500,00 € ».
const UNSUPPORTED_SPACES = /[    ]/g;

export function pdfSafe<T>(value: T): T {
  if (typeof value === "string") return value.replace(UNSUPPORTED_SPACES, " ") as T;
  if (Array.isArray(value)) return value.map((item) => pdfSafe(item)) as T;
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, pdfSafe(item)])) as T;
  }
  return value;
}
