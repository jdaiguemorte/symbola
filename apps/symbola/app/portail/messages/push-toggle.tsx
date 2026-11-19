"use client";

// Lot 55 (POR-11 ; ADR 0101) — notifications du portail, facultatives et désactivées par défaut : le
// client les active sur cet appareil pour être prévenu d'un nouveau message ou d'une décision demandée
// (la sorte seulement, jamais le contenu). Sur iPhone, le push ne marche qu'une fois le portail ajouté
// à l'écran d'accueil : l'écran l'explique.
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { subscribeLinkPushAction, unsubscribeLinkPushAction } from "./actions";

type Status = "checking" | "unsupported" | "off" | "on" | "denied" | "failed";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function supported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function PortalPushToggle({ publicKey }: { publicKey: string }) {
  const t = useTranslations("PortalMessages");
  const [status, setStatus] = useState<Status>("checking");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!supported()) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    void navigator.serviceWorker
      .getRegistration("/")
      .then(async (registration) => setStatus((await registration?.pushManager.getSubscription()) ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  const enable = () =>
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const registration = await navigator.serviceWorker.ready;
        const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
        setStatus((await subscribeLinkPushAction(subscription.toJSON())).ok ? "on" : "failed");
      } catch {
        setStatus("failed");
      }
    });

  const disable = () =>
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await unsubscribeLinkPushAction(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setStatus("off");
      } catch {
        setStatus("failed");
      }
    });

  return (
    <section className="stack" aria-labelledby="portal-push-title">
      <h2 id="portal-push-title">{t("pushTitle")}</h2>
      <p>{t("pushIntro")}</p>
      <p className="field-hint">{t("pushIos")}</p>
      {status === "unsupported" ? <p role="status">{t("pushUnsupported")}</p> : null}
      {status === "denied" ? <p role="alert">{t("pushDenied")}</p> : null}
      {status === "failed" ? <p role="alert">{t("pushFailed")}</p> : null}
      {status === "on" ? (
        <>
          <p role="status">{t("pushEnabled")}</p>
          <button type="button" onClick={disable} disabled={pending}>
            {t("pushDisable")}
          </button>
        </>
      ) : status === "off" || status === "failed" ? (
        <button type="button" onClick={enable} disabled={pending}>
          {t("pushEnable")}
        </button>
      ) : null}
    </section>
  );
}
