"use client";

// Lot 60 (L60-PLA-01 ; D4) — calibrer le fond de plan : deux points de l'image (un clic chacun, ou
// leurs coordonnées en pixels saisies au clavier) et la distance réelle qui les sépare. Le plan
// devient alors à l'échelle ; l'espace peut prendre la taille de l'image.
import { useId, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type { FloorplanCalibration } from "@symbola/contracts";
import { calibrateAction } from "./actions";

export function CalibrationTool({ spaceId, src, widthPx, heightPx, calibration }: { spaceId: string; src: string; widthPx: number; heightPx: number; calibration: FloorplanCalibration | null }) {
  const t = useTranslations("Floorplans.calibration");
  const base = useId();
  const [points, setPoints] = useState({ ax: calibration?.ax ?? 0, ay: calibration?.ay ?? 0, bx: calibration?.bx ?? 0, by: calibration?.by ?? 0 });
  const [next, setNext] = useState<"a" | "b">("a");
  const place = (event: MouseEvent<HTMLImageElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - box.left) / box.width) * widthPx);
    const y = Math.round(((event.clientY - box.top) / box.height) * heightPx);
    setPoints((current) => (next === "a" ? { ...current, ax: x, ay: y } : { ...current, bx: x, by: y }));
    setNext(next === "a" ? "b" : "a");
  };
  const field = (key: keyof typeof points, label: string, max: number) => (
    <label key={key}>
      {label}
      <input name={key} type="number" min={0} max={max} step={1} required value={points[key]} onChange={(event) => setPoints((current) => ({ ...current, [key]: Number.parseInt(event.target.value, 10) || 0 }))} />
    </label>
  );
  return (
    <form action={calibrateAction} className="stack">
      <input type="hidden" name="spaceId" value={spaceId} />
      <p className="meta">{t("intro")}</p>
      <div className="plan-calibration">
        {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'app après contrôle des droits */}
        <img src={src} alt={t("imageAlt")} onClick={place} />
        <svg viewBox={`0 0 ${widthPx} ${heightPx}`} aria-hidden="true">
          <line x1={points.ax} y1={points.ay} x2={points.bx} y2={points.by} className="plan-calibration-line" />
          <circle cx={points.ax} cy={points.ay} r={Math.max(4, widthPx / 150)} className="plan-calibration-point" />
          <circle cx={points.bx} cy={points.by} r={Math.max(4, widthPx / 150)} className="plan-calibration-point" />
        </svg>
      </div>
      <p className="meta" aria-live="polite">
        {next === "a" ? t("clickA") : t("clickB")}
      </p>
      <fieldset>
        <legend>{t("pointsLegend", { width: widthPx, height: heightPx })}</legend>
        <div className="plan-space-fields">
          {field("ax", t("ax"), widthPx)}
          {field("ay", t("ay"), heightPx)}
          {field("bx", t("bx"), widthPx)}
          {field("by", t("by"), heightPx)}
        </div>
      </fieldset>
      <label htmlFor={`${base}-distance`}>{t("distance")}</label>
      <input id={`${base}-distance`} name="distance" type="number" min={0.01} max={1000} step={0.01} inputMode="decimal" required defaultValue={calibration ? calibration.distanceCm / 100 : ""} />
      <label className="checkbox">
        <input type="checkbox" name="fit" defaultChecked />
        {t("fit")}
      </label>
      <button type="submit">{t("submit")}</button>
    </form>
  );
}
