// Lot 60 (L60-PLA-02, partie B ; HUB-20) — la bibliothèque d'éléments de l'organisation : tables de
// toutes formes et installations de soirée, venues des données de départ ; la planner masque des
// éléments, en ajoute, et règle leurs dimensions et leurs besoins par défaut.
import { getLocale, getTranslations } from "next-intl/server";
import type { FloorplanElementType } from "@symbola/contracts";
import { FLOORPLAN_SEAT_RULES, FLOORPLAN_SHAPES } from "@symbola/contracts";
import { floorplanAmpChoices } from "@symbola/starter-templates";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { listElementTypes } from "@/modules/floorplans/service";
import { floorplansAccess } from "../access";
import { addElementTypeAction, hideElementTypeAction, updateElementTypeAction } from "../actions";
import { Feedback } from "../feedback";

async function TypeFields({ type }: { type?: FloorplanElementType }) {
  const t = await getTranslations("Floorplans.library");
  return (
    <div className="plan-space-fields">
      <label>
        {t("label")}
        <input name="label" required maxLength={60} defaultValue={type?.label ?? ""} readOnly={Boolean(type?.starterKey)} />
      </label>
      <label>
        {t("category")}
        <select name="category" defaultValue={type?.category ?? "table"}>
          <option value="table">{t("categories.table")}</option>
          <option value="setup">{t("categories.setup")}</option>
        </select>
      </label>
      <label>
        {t("shape")}
        <select name="shape" defaultValue={type?.shape ?? "rect"}>
          {FLOORPLAN_SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {t(`shapes.${shape}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("seatRule")}
        <select name="seatRule" defaultValue={type?.seatRule ?? "none"}>
          {FLOORPLAN_SEAT_RULES.map((rule) => (
            <option key={rule} value={rule}>
              {t(`seatRules.${rule}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("width")}
        <input name="width" type="number" required min={0.1} max={100} step={0.05} inputMode="decimal" defaultValue={type ? type.widthCm / 100 : ""} />
      </label>
      <label>
        {t("depth")}
        <input name="depth" type="number" required min={0.1} max={100} step={0.05} inputMode="decimal" defaultValue={type ? type.depthCm / 100 : ""} />
      </label>
      <label>
        {t("powerOutlets")}
        <input name="powerOutlets" type="number" min={0} max={20} step={1} defaultValue={type?.powerOutlets ?? 0} />
      </label>
      <label>
        {t("powerAmps")}
        <select name="powerAmps" defaultValue={type?.powerAmps ?? ""}>
          <option value="">{t("noAmps")}</option>
          {floorplanAmpChoices().map((amps) => (
            <option key={amps} value={amps}>
              {t("amps", { amps })}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="needsWater" defaultChecked={type?.needsWater ?? false} />
        {t("needsWater")}
      </label>
    </div>
  );
}

export default async function FloorplanLibraryPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await requirePlanner();
  const t = await getTranslations("Floorplans.library");
  const tRoot = await getTranslations("Floorplans");
  const tHelp = await getTranslations("Help");
  const access = (await floorplansAccess("vendors")) ?? (await floorplansAccess("events"));
  if (!access) {
    return (
      <main>
        <PageHeader title={t("title")} />
        <p role="note">{tRoot("unavailable")}</p>
      </main>
    );
  }
  const types = await listElementTypes(access.organizationId, (await getLocale()) === "en" ? "en" : "fr");
  return (
    <main className="plans-page">
      <PageHeader title={t("title")} />
      <ScreenHelp title={tHelp("floorplanLibrary.title")} body={tHelp("floorplanLibrary.body")} />
      <p className="meta">{t("intro")}</p>
      <Feedback query={await searchParams} />
      <ul className="item-list">
        {types.map((type) => (
          <li key={type.id} className="stack">
            <div className="row-wrap">
              <strong>{type.label}</strong>
              <span className="meta">{t(`categories.${type.category}`)}</span>
              {type.hidden ? <span className="badge">{t("hidden")}</span> : null}
            </div>
            <details>
              <summary>{t("edit", { label: type.label })}</summary>
              <form action={updateElementTypeAction} className="stack">
                <input type="hidden" name="typeId" value={type.id} />
                <TypeFields type={type} />
                <button type="submit">{t("save")}</button>
              </form>
            </details>
            <form action={hideElementTypeAction}>
              <input type="hidden" name="typeId" value={type.id} />
              <input type="hidden" name="hidden" value={type.hidden ? "false" : "true"} />
              <button type="submit">{type.hidden ? t("show", { label: type.label }) : t("hide", { label: type.label })}</button>
            </form>
          </li>
        ))}
      </ul>
      <section className="card" aria-labelledby="new-type-title">
        <h2 id="new-type-title">{t("addTitle")}</h2>
        <form action={addElementTypeAction} className="stack">
          <TypeFields />
          <button type="submit">{t("add")}</button>
        </form>
      </section>
    </main>
  );
}
