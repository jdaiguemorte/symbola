"use client";

// Lot 70a (CHR-02 ; A1, D7 de la porte 2) — « Prénom » et « Nom » dans Mon compte, chacun enregistré seul
// quand on quitte le champ, avec « Enregistré » à côté (réglage isolé).
import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { saveNameFieldAction, type NameFieldState } from "./actions";

function NameField({ field, label, initial }: { field: "firstName" | "lastName"; label: string; initial: string }) {
  const t = useTranslations("Profile");
  const [state, action, pending] = useActionState(saveNameFieldAction, {} as NameFieldState);
  const form = useRef<HTMLFormElement>(null);
  const last = useRef(initial);
  const statusId = `profile-${field}-status`;
  return (
    <form ref={form} action={action} className="field-row">
      <input type="hidden" name="field" value={field} />
      <label>
        {label}
        <input
          type="text"
          name="value"
          defaultValue={initial}
          maxLength={80}
          autoComplete={field === "firstName" ? "given-name" : "family-name"}
          aria-describedby={statusId}
          onBlur={(event) => {
            if (event.currentTarget.value === last.current) return;
            last.current = event.currentTarget.value;
            form.current?.requestSubmit();
          }}
        />
      </label>
      <span id={statusId} role="status" className="field-hint">
        {pending ? null : state.error ? t("namesInvalid") : state.saved ? t("namesSaved") : null}
      </span>
    </form>
  );
}

export function NamesForm({ firstName, lastName }: { firstName: string | null; lastName: string | null }) {
  const t = useTranslations("Profile");
  return (
    <section aria-labelledby="profile-names-title" className="stack">
      <h2 id="profile-names-title">{t("namesTitle")}</h2>
      <p className="field-hint">{t("namesBody")}</p>
      <NameField field="firstName" label={t("firstName")} initial={firstName ?? ""} />
      <NameField field="lastName" label={t("lastName")} initial={lastName ?? ""} />
    </section>
  );
}
