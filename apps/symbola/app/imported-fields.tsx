import { getTranslations } from "next-intl/server";

// Lot 5 (IMP-04/IMP-05) — colonnes d'un fichier importé gardées en champ
// libre, en lecture seule sur la fiche de l'élément. Rien si l'élément n'en a
// pas.
export async function ImportedFields({ fields, compact = false }: { fields: Record<string, string> | undefined; compact?: boolean }) {
  const entries = Object.entries(fields ?? {});
  if (entries.length === 0) return null;
  const t = await getTranslations("Import");
  if (compact) {
    return (
      <small>
        {t("importedFieldsTitle")} : {entries.map(([name, value]) => `${name} : ${value}`).join(" · ")}
      </small>
    );
  }
  return (
    <section aria-label={t("importedFieldsTitle")}>
      <h2>{t("importedFieldsTitle")}</h2>
      <dl>
        {entries.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
