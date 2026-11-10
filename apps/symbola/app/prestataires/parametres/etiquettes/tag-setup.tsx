"use client";

// Lot 21 (PRE-18, PRE-19, ADR 0050) — en tête de l'écran Étiquettes :
// « Ranger mes étiquettes importées » (avec le récapitulatif de ce qui a été
// rangé) et « Ajouter les étiquettes proposées ». Le bloc reste affiché tant
// qu'un récapitulatif est à lire, même s'il n'y a plus rien à ranger.
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addStarterVendorTagsAction, arrangeVendorTagsAction, type TagSetupState } from "../../actions";

export function TagSetup({ canArrange, looseTags, missing }: { canArrange: boolean; looseTags: number; missing: number }) {
  const t = useTranslations("VendorBook");
  const initialState: TagSetupState = {};
  const [arrangeState, arrangeAction, arranging] = useActionState(arrangeVendorTagsAction, initialState);
  const [addState, addAction, adding] = useActionState(addStarterVendorTagsAction, initialState);
  const recap = arrangeState.arrangement;
  if (!canArrange && missing === 0 && !recap && !addState.added) return null;
  const title = canArrange ? t("tagSetupArrangeTitle") : missing > 0 ? t("tagSetupStarterTitle") : t("tagSetupDoneTitle");

  return (
    <section className="card tag-setup" aria-labelledby="tag-setup-title">
      <h2 id="tag-setup-title">{title}</h2>
      {canArrange ? <p>{t("tagSetupArrangeIntro", { count: looseTags })}</p> : null}
      {!canArrange && missing > 0 ? <p>{t("tagSetupStarterIntro")}</p> : null}
      {canArrange || missing > 0 ? (
        <div className="row-actions">
          {canArrange ? (
            <form action={arrangeAction}>
              <button type="submit" disabled={arranging}>
                {t("tagSetupArrange")}
              </button>
            </form>
          ) : null}
          {missing > 0 ? (
            <form action={addAction}>
              <button type="submit" disabled={adding}>
                {t("tagSetupAddStarter", { count: missing })}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      {recap ? (
        <div role="status" className="tag-recap">
          {recap.changed ? (
            <>
              <p className="strong">{t("tagRecapTitle")}</p>
              <ul>
                {recap.familiesSet > 0 ? <li>{t("tagRecapFamilies", { count: recap.familiesSet })}</li> : null}
                {recap.catalogMatched > 0 ? <li>{t("tagRecapCatalog", { count: recap.catalogMatched })}</li> : null}
                {recap.tiers.map((tier) => (
                  <li key={tier.label}>{t("tagRecapTier", { label: tier.label, count: tier.count })}</li>
                ))}
                {recap.adjustedVendors.length > 0 ? (
                  <li>
                    {t("tagRecapVendors", { count: recap.adjustedVendors.length })}{" "}
                    {recap.adjustedVendors.map((vendor, index) => (
                      <span key={vendor.id}>
                        {index > 0 ? ", " : null}
                        <Link href={`/prestataires/${vendor.id}`}>{vendor.name}</Link>
                      </span>
                    ))}
                  </li>
                ) : null}
                {recap.remaining > 0 ? <li>{t("tagRecapRemaining", { count: recap.remaining })}</li> : null}
              </ul>
            </>
          ) : (
            <p>{t("tagRecapNothing")}</p>
          )}
        </div>
      ) : null}
      {addState.added ? <p role="status">{t("tagStarterAdded", { created: addState.added.created, placed: addState.added.placed })}</p> : null}
      {arrangeState.error ? <p role="alert">{arrangeState.error}</p> : null}
      {addState.error ? <p role="alert">{addState.error}</p> : null}
    </section>
  );
}
