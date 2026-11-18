"use client";

// Lot 53 (ARC-09, HUB-15 ; D4 ; ADR 0095, ADR 0096) — activer ou désactiver le push sur cet appareil.
// Le navigateur demande la permission, le service worker de Symbola (public/sw.js) reçoit les messages ;
// l'abonnement (adresse du service de push et clés publiques) part au serveur, rien d'autre. Sur iPhone,
// le push ne marche qu'une fois Symbola ajouté à l'écran d'accueil (iOS 16.4 et plus).
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { subscribePushAction, testPushAction, unsubscribePushAction } from "./actions";

type Status = "checking" | "unsupported" | "off" | "on" | "denied" | "failed";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

// Un nom lisible, sans identifiant : le navigateur et le système.
function deviceLabel(fallback: string): string {
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : null;
  const system = /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android" : /Mac OS X/.test(agent) ? "macOS" : /Windows/.test(agent) ? "Windows" : /Linux/.test(agent) ? "Linux" : null;
  return [browser, system].filter(Boolean).join(" · ") || fallback;
}

function supported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function PushDevice({ publicKey }: { publicKey: string }) {
  const t = useTranslations("Notifications");
  const [status, setStatus] = useState<Status>("checking");
  const [tested, setTested] = useState(false);
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
        const result = await subscribePushAction(subscription.toJSON(), deviceLabel(t("push.deviceUnknown")));
        setStatus(result.ok ? "on" : "failed");
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
          await unsubscribePushAction(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setStatus("off");
      } catch {
        setStatus("failed");
      }
    });

  const test = () =>
    startTransition(async () => {
      setTested((await testPushAction()).ok);
    });

  return (
    <div className="push-device">
      <p>{t("push.intro")}</p>
      <p className="field-hint">{t("push.ios")}</p>
      {status === "unsupported" ? <p role="status">{t("push.unsupported")}</p> : null}
      {status === "denied" ? <p role="alert">{t("push.denied")}</p> : null}
      {status === "failed" ? <p role="alert">{t("push.failed")}</p> : null}
      {status === "on" ? (
        <>
          <p role="status">{t("push.enabled")}</p>
          <div className="button-row">
            <button type="button" onClick={test} disabled={pending} className="button-secondary">
              {t("push.test")}
            </button>
            <button type="button" onClick={disable} disabled={pending}>
              {t("push.disable")}
            </button>
          </div>
          {tested ? <p role="status">{t("push.testSent")}</p> : null}
        </>
      ) : status === "off" || status === "failed" ? (
        <button type="button" onClick={enable} disabled={pending}>
          {t("push.enable")}
        </button>
      ) : null}
    </div>
  );
}
