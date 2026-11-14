// Lot 33b (PAR-01, étape 6) — liste de prise en main de l'accueil : cinq actions, cochées d'elles-
// mêmes quand elles sont faites ; la liste disparaît une fois finie (lib/onboarding/checklist.ts).
import Link from "next/link";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ChecklistItem } from "@/lib/onboarding/checklist";

export async function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const t = await getTranslations("Onboarding.checklist");
  const done = items.filter((item) => item.done).length;
  return (
    <section className="card onboarding-checklist" aria-labelledby="onboarding-checklist-title">
      <h2 id="onboarding-checklist-title">{t("title")}</h2>
      <p className="muted">{t("progress", { done, total: items.length })}</p>
      <ol className="checklist">
        {items.map((item) => (
          <li key={item.key} className={item.done ? "done" : undefined}>
            {item.done ? (
              <span>
                <Check size={16} aria-hidden="true" /> {t(`items.${item.key}`)} <span className="sr-only">({t("done")})</span>
              </span>
            ) : (
              <Link href={item.href}>{t(`items.${item.key}`)}</Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
