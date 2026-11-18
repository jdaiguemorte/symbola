"use client";

// Lot 43 (BUD-06, D8) — formulaires des payeurs de l'évènement, côté planner.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { EVENT_PAYER_KINDS, type EventPayer } from "@symbola/contracts";
import { addPayerAction, setLineSharesAction, setPaymentPayerAction, setVisibilityAction, type PayersState } from "./actions";

function Feedback({ state, saved }: { state: PayersState; saved: string }) {
  return (
    <>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{saved}</p> : null}
    </>
  );
}

export function AddPayerForm({ eventId, links }: { eventId: string; links: { id: string; personName: string }[] }) {
  const t = useTranslations("Payers");
  const [state, action, pending] = useActionState(addPayerAction, {} as PayersState);
  return (
    <form action={action} aria-label={t("addForm")}>
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor="payer-name">{t("name")}</label>
      <input id="payer-name" name="name" maxLength={120} required />
      <label htmlFor="payer-kind">{t("kind")}</label>
      <select id="payer-kind" name="kind" defaultValue="family_one">
        {EVENT_PAYER_KINDS.filter((kind) => kind !== "couple").map((kind) => (
          <option key={kind} value={kind}>
            {t(`kinds.${kind}`)}
          </option>
        ))}
      </select>
      <label htmlFor="payer-link">{t("link")}</label>
      <select id="payer-link" name="linkId" defaultValue="">
        <option value="">{t("noLink")}</option>
        {links.map((link) => (
          <option key={link.id} value={link.id}>
            {link.personName}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending}>
        {t("addSubmit")}
      </button>
      <Feedback state={state} saved={t("added")} />
    </form>
  );
}

export function VisibilityForm({ eventId, payer }: { eventId: string; payer: EventPayer }) {
  const t = useTranslations("Payers");
  const [state, action, pending] = useActionState(setVisibilityAction, {} as PayersState);
  return (
    <form action={action} aria-label={t("visibilityFor", { name: payer.name })}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="payerId" value={payer.id} />
      <label htmlFor={`visibility-${payer.id}`}>{t("visibilityFor", { name: payer.name })}</label>
      <select id={`visibility-${payer.id}`} name="visibility" defaultValue={payer.ownShareOnly ? "share" : "all"}>
        <option value="share">{t("visibilityShare")}</option>
        <option value="all">{t("visibilityAll")}</option>
      </select>
      <button type="submit" disabled={pending}>
        {t("visibilitySave")}
      </button>
      <Feedback state={state} saved={t("visibilitySaved")} />
    </form>
  );
}

export function LineSharesForm({
  eventId,
  line,
  payers,
}: {
  eventId: string;
  line: { lineId: string; label: string; shares: { payerId: string; percentageBasisPoints: number | null; amountCents: number | null }[] };
  payers: EventPayer[];
}) {
  const t = useTranslations("Payers");
  const [state, action, pending] = useActionState(setLineSharesAction, {} as PayersState);
  const others = payers.filter((payer) => payer.kind !== "couple");
  return (
    <form action={action} aria-label={t("sharesFor", { label: line.label })}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="lineId" value={line.lineId} />
      <fieldset>
        <legend>{t("sharesFor", { label: line.label })}</legend>
        {others.map((payer) => {
          const share = line.shares.find((entry) => entry.payerId === payer.id);
          const mode = share?.amountCents !== null && share?.amountCents !== undefined ? "amount" : "percent";
          const value = share ? (mode === "amount" ? (share.amountCents! / 100).toFixed(2).replace(".", ",") : (share.percentageBasisPoints! / 100).toString().replace(".", ",")) : "";
          return (
            <p key={payer.id} className="payer-share-row">
              <input type="hidden" name="payerId" value={payer.id} />
              <label htmlFor={`share-${line.lineId}-${payer.id}`}>{payer.name}</label>
              <input id={`share-${line.lineId}-${payer.id}`} name={`value-${payer.id}`} inputMode="decimal" defaultValue={value} size={8} />
              <label htmlFor={`mode-${line.lineId}-${payer.id}`} className="sr-only">
                {t("shareMode", { name: payer.name })}
              </label>
              <select id={`mode-${line.lineId}-${payer.id}`} name={`mode-${payer.id}`} defaultValue={mode}>
                <option value="percent">{t("percent")}</option>
                <option value="amount">{t("amount")}</option>
              </select>
            </p>
          );
        })}
        <p className="meta">{t("sharesHint")}</p>
      </fieldset>
      <button type="submit" disabled={pending}>
        <span aria-hidden="true">{t("sharesSave")}</span>
        <span className="sr-only">{t("sharesSaveFor", { label: line.label })}</span>
      </button>
      <Feedback state={state} saved={t("sharesSaved")} />
    </form>
  );
}

export function PaymentPayerForm({ eventId, target, label, payers, current }: { eventId: string; target: { paymentId: string } | { scheduleItemId: string }; label: string; payers: EventPayer[]; current: string | null }) {
  const t = useTranslations("Payers");
  const [state, action, pending] = useActionState(setPaymentPayerAction, {} as PayersState);
  const id = "paymentId" in target ? target.paymentId : target.scheduleItemId;
  const couple = payers.find((payer) => payer.kind === "couple");
  return (
    <form action={action} aria-label={t("payerOf", { label })} className="inline-form">
      <input type="hidden" name="eventId" value={eventId} />
      {"paymentId" in target ? <input type="hidden" name="paymentId" value={target.paymentId} /> : <input type="hidden" name="scheduleItemId" value={target.scheduleItemId} />}
      <label htmlFor={`payer-of-${id}`}>{t("payerOf", { label })}</label>
      <select id={`payer-of-${id}`} name="payerId" defaultValue={current ?? couple?.id ?? ""}>
        {payers.map((payer) => (
          <option key={payer.id} value={payer.id}>
            {payer.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending}>
        <span aria-hidden="true">{t("payerSave")}</span>
        <span className="sr-only">{t("payerSaveFor", { label })}</span>
      </button>
      <Feedback state={state} saved={t("payerSaved")} />
    </form>
  );
}
