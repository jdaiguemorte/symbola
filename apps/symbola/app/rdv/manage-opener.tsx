"use client";

// Lot 46 (RDV-03 ; D10) — le jeton est lu après « # », retiré de l'adresse et de l'historique de
// l'onglet avant tout envoi, puis gardé en mémoire de la page seulement. La personne voit son
// rendez-vous, le reporte (créneaux libres du même type) ou l'annule. Lien non valable : la même
// réponse, quel qu'en soit le motif.
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { APPOINTMENT_CANCEL_REASONS } from "@symbola/contracts";
import { appointmentLinkSlotsAction, cancelAppointmentByLinkAction, describeAppointmentLinkAction, rescheduleAppointmentAction, type ManagedView } from "./actions";

type State =
  | { step: "opening" }
  | { step: "invalid" }
  | { step: "retry"; minutes: number }
  | { step: "view"; view: ManagedView; mode: "view" | "reschedule" | "cancel"; slots?: string[] | undefined; message?: "rescheduled" | "cancelled" | "taken" | undefined };

function takeTokenFromAddress(): string | null {
  const hash = window.location.hash.slice(1);
  if (hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  try {
    return decodeURIComponent(hash) || null;
  } catch {
    return null;
  }
}

export function ManageOpener() {
  const t = useTranslations("Appointments.manage");
  const tPublic = useTranslations("Appointments.public");
  const locale = useLocale();
  const [state, setState] = useState<State>({ step: "opening" });
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const format = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const value = takeTokenFromAddress();
    if (!value) {
      setState({ step: "invalid" });
      return;
    }
    token.current = value;
    void describeAppointmentLinkAction(value).then((result) => {
      if (result.outcome === "valid") setState({ step: "view", view: result.view, mode: "view" });
      else if (result.outcome === "retry") setState({ step: "retry", minutes: result.minutes });
      else setState({ step: "invalid" });
    });
  }, []);

  if (state.step === "opening") {
    return (
      <>
        <h1>{t("openingTitle")}</h1>
        <p role="status">{t("openingBody")}</p>
        <noscript>
          <p>{t("noScript")}</p>
        </noscript>
      </>
    );
  }
  if (state.step === "retry") {
    return (
      <>
        <h1>{t("invalidTitle")}</h1>
        <p role="alert">{t("retryLater", { minutes: state.minutes })}</p>
      </>
    );
  }
  if (state.step === "invalid") {
    return (
      <>
        <h1>{t("invalidTitle")}</h1>
        <p>{t("invalidBody")}</p>
      </>
    );
  }

  const { view } = state;
  const startReschedule = async () => {
    if (!token.current) return;
    const result = await appointmentLinkSlotsAction(token.current);
    if ("slots" in result) setState({ ...state, mode: "reschedule", slots: result.slots, message: undefined });
    else setState({ step: "invalid" });
  };
  const submitReschedule = async (formData: FormData) => {
    if (!token.current) return;
    const result = await rescheduleAppointmentAction(token.current, String(formData.get("startsAt") ?? ""));
    if (result.outcome === "valid") setState({ step: "view", view: result.view, mode: "view", message: "rescheduled" });
    else if (result.outcome === "taken") setState({ ...state, mode: "reschedule", slots: result.alternatives, message: "taken" });
    else if (result.outcome === "retry") setState({ step: "retry", minutes: result.minutes });
    else setState({ step: "invalid" });
  };
  const submitCancel = async (formData: FormData) => {
    if (!token.current) return;
    const result = await cancelAppointmentByLinkAction(token.current, String(formData.get("reason") ?? ""));
    if (result.outcome === "valid") setState({ step: "view", view: result.view, mode: "view", message: "cancelled" });
    else if (result.outcome === "retry") setState({ step: "retry", minutes: result.minutes });
    else setState({ step: "invalid" });
  };

  return (
    <>
      <p className="muted">{view.organizationName}</p>
      <h1>{view.typeName}</h1>
      {state.message ? (
        <p role="status" className="notice">
          {t(`message.${state.message}`)}
        </p>
      ) : null}
      <p>
        <strong>{format.format(new Date(view.startsAt))}</strong>
        {view.status === "cancelled" ? ` — ${t("cancelledBadge")}` : ""}
      </p>
      <p className="meta">
        {tPublic(`place.${view.locationKind}`)}
        {view.location ? ` — ${view.location}` : ""}
      </p>
      {view.status === "booked" && state.mode === "view" ? (
        <div className="row-wrap">
          {view.canReschedule ? (
            <button type="button" onClick={() => void startReschedule()}>
              {t("reschedule")}
            </button>
          ) : null}
          <button type="button" onClick={() => setState({ ...state, mode: "cancel", message: undefined })}>
            {t("cancel")}
          </button>
        </div>
      ) : null}
      {state.mode === "reschedule" ? (
        <form action={submitReschedule} className="stack">
          <fieldset className="booking-slots">
            <legend>{t("chooseSlot")}</legend>
            {(state.slots ?? []).length === 0 ? <p>{t("noSlot", { organization: view.organizationName })}</p> : null}
            <div className="slot-chips">
              {(state.slots ?? []).slice(0, 60).map((slot) => (
                <label key={slot} className="slot-chip">
                  <input type="radio" name="startsAt" value={slot} required />
                  <span>{format.format(new Date(slot))}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="row-wrap">
            <button type="submit" className="primary" disabled={(state.slots ?? []).length === 0}>
              {t("confirmReschedule")}
            </button>
            <button type="button" onClick={() => setState({ ...state, mode: "view", message: undefined })}>
              {t("back")}
            </button>
          </div>
        </form>
      ) : null}
      {state.mode === "cancel" ? (
        <form action={submitCancel} className="stack">
          <label>
            {t("reasonLabel")}
            <select name="reason" defaultValue="">
              <option value="">{t("reasonNone")}</option>
              {APPOINTMENT_CANCEL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t(`reason.${reason}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="row-wrap">
            <button type="submit" className="button-danger">
              {t("confirmCancel")}
            </button>
            <button type="button" onClick={() => setState({ ...state, mode: "view", message: undefined })}>
              {t("back")}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
