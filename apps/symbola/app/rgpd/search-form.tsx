"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { SearchRecord } from "@/lib/privacy/search";
import { searchPersonAction, type SearchFormState } from "./actions";

const MODULE_ORDER = ["events", "budget", "quotes", "hub", "hello"];

function fieldLabel(t: ReturnType<typeof useTranslations>, key: string): string {
  if (key.startsWith("imported:")) return t("importedField", { name: key.slice("imported:".length) });
  return t.has(`field.${key}`) ? t(`field.${key}`) : key;
}

export function SearchForm() {
  const t = useTranslations("Privacy");
  const initialState: SearchFormState = {};
  const [state, formAction, pending] = useActionState(searchPersonAction, initialState);
  const result = state.result;
  const byModule = new Map<string, SearchRecord[]>();
  for (const record of result?.records ?? []) byModule.set(record.module, [...(byModule.get(record.module) ?? []), record]);
  const modules = [...byModule.keys()].sort((a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b));

  return (
    <>
      <form action={formAction}>
        <p>{t("searchIntro")}</p>
        <label>
          {t("emailLabel")}
          <input type="email" name="email" autoComplete="off" />
        </label>
        <label>
          {t("phoneLabel")}
          <input type="tel" name="phone" autoComplete="off" />
        </label>
        <label>
          {t("nameLabel")}
          <input type="text" name="name" autoComplete="off" />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? t("searching") : t("search")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>

      {result ? (
        <section aria-labelledby="privacy-results">
          <h2 id="privacy-results">{t("resultsTitle", { count: result.records.length })}</h2>
          {!result.complete ? (
            <div role="alert">
              <p>{t("incomplete")}</p>
              <ul>
                {result.outcomes
                  .filter((outcome) => outcome.status === "failed")
                  .map((outcome) => (
                    <li key={outcome.module}>{t(`module.${outcome.module}`)}</li>
                  ))}
              </ul>
            </div>
          ) : null}
          {result.records.length === 0 ? <p>{result.complete ? t("noData") : t("noDataIncomplete")}</p> : null}
          {modules.map((module) => (
            <section key={module} aria-labelledby={`privacy-${module}`}>
              <h3 id={`privacy-${module}`}>{t(`module.${module}`)}</h3>
              <ul>
                {byModule.get(module)!.map((record) => (
                  <li key={`${record.kind}:${record.recordId}`}>
                    <strong>
                      {t(`kind.${record.kind}`)}
                      {record.label ? ` : ${record.label}` : ""}
                    </strong>{" "}
                    <small>{record.direct ? t("directMatch") : t("relatedMatch")}</small>
                    {Object.keys(record.fields).length > 0 ? (
                      <dl>
                        {Object.entries(record.fields).map(([key, value]) => (
                          <div key={key}>
                            <dt>{fieldLabel(t, key)}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      ) : null}
    </>
  );
}
