// Lot 52 (SEC-08 ; D6 ; ADR 0094) — envoi des alertes de sécurité d'un compte : nouvelle connexion
// (avec le lien « Ce n'est pas moi », valable sept jours, jeton après « # » : jamais dans les journaux)
// et changement d'identité annoncé par le webhook (à l'ancienne adresse, avec le lien du centre de
// compte). Un échec d'envoi ne bloque jamais la connexion ; le journal ne garde que le type d'erreur.
import { createTranslator } from "next-intl";
import { markIdentityAlertSent, parseDeviceLabel, type IdentityAlert, type NewDeviceAlert } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { accountEmailContext, sendAccountEmail } from "@/modules/hub/service";
import { deviceText } from "./device";

function dateTime(at: Date, locale: "fr" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(at);
}

function messages(locale: "fr" | "en") {
  return locale === "en" ? enMessages : frMessages;
}

export async function sendNewDeviceAlert(input: { userId: string; email: string; alert: NewDeviceAlert }): Promise<void> {
  try {
    const db = appDatabase();
    const context = await accountEmailContext(db, input.userId);
    if (!context) return;
    const t = createTranslator({ locale: context.locale, messages: messages(context.locale), namespace: "Devices" });
    const link = `${parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "")}/securite/pas-moi#${input.alert.alertToken}`;
    await sendAccountEmail(db, {
      userId: input.userId,
      to: input.email,
      kind: "new_device_login",
      values: { device: deviceText(parseDeviceLabel(input.alert.deviceLabel), t as never), date_time: dateTime(input.alert.at, context.locale), link },
    });
  } catch (error) {
    console.error("alerte de nouvel appareil : envoi impossible", error instanceof Error ? error.name : "erreur");
  }
}

// L'alerte part, puis l'ancienne adresse est oubliée. Un échec laisse l'alerte en attente (reprise).
export async function sendIdentityAlert(alert: IdentityAlert, accountCenterUrl: string, at: Date = new Date()): Promise<boolean> {
  try {
    const db = appDatabase();
    const context = await accountEmailContext(db, alert.userId);
    if (!context) return false;
    const t = createTranslator({ locale: context.locale, messages: messages(context.locale), namespace: "Emails.identityChange" });
    await sendAccountEmail(db, {
      userId: alert.userId,
      to: alert.to,
      kind: "identity_changed",
      values: { change: t(alert.kind), date_time: dateTime(at, context.locale), link: accountCenterUrl },
      idempotencyKey: `identity-alert:${alert.alertId}`,
    });
    await markIdentityAlertSent(db, alert.alertId, at);
    return true;
  } catch (error) {
    console.error("alerte de changement d'identité : envoi impossible", error instanceof Error ? error.name : "erreur");
    return false;
  }
}
