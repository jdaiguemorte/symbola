// PRD-EVT-04 — libellé d'un décalage par rapport au jour J (J-365, Jour J, J+7).
type Translate = (key: "offsetEventDay" | "offsetBefore" | "offsetAfter", values?: { days: number }) => string;

export function offsetLabel(t: Translate, offsetDays: number): string {
  if (offsetDays === 0) return t("offsetEventDay");
  return offsetDays < 0 ? t("offsetBefore", { days: -offsetDays }) : t("offsetAfter", { days: offsetDays });
}
