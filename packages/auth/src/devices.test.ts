import { describe, expect, it } from "vitest";
import { deviceLabelOf, formatDeviceLabel, hashAlertToken, newAlertToken, newDeviceId, parseDeviceLabel, validDeviceId } from "./devices";

const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const FIREFOX_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0";
const EDGE_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
const SAMSUNG_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36";

describe("HUB-05 (lot 52, D4) — Appareil d'une session, lu dans le navigateur", () => {
  it.each([
    [SAFARI_IPHONE, "safari/iphone"],
    [CHROME_WINDOWS, "chrome/windows"],
    [FIREFOX_MAC, "firefox/mac"],
    [EDGE_WINDOWS, "edge/windows"],
    [SAMSUNG_ANDROID, "samsung/android"],
    ["", "other/other"],
  ])("reconnaît %s", (userAgent, expected) => {
    expect(formatDeviceLabel(deviceLabelOf(userAgent))).toBe(expected);
  });

  it("ne garde que deux clés connues : une valeur inattendue en base devient « autre »", () => {
    expect(parseDeviceLabel("safari/iphone")).toEqual({ browser: "safari", system: "iphone" });
    expect(parseDeviceLabel("<script>/x")).toEqual({ browser: "other", system: "other" });
    expect(parseDeviceLabel(null)).toEqual({ browser: "other", system: "other" });
  });

  it("l'identifiant d'appareil est un aléa ; un cookie mal formé est ignoré", () => {
    const id = newDeviceId();
    expect(validDeviceId(id)).toBe(id);
    expect(newDeviceId()).not.toBe(id);
    expect(validDeviceId("court")).toBeNull();
    expect(validDeviceId("a".repeat(30) + ";drop")).toBeNull();
    expect(validDeviceId(undefined)).toBeNull();
  });
});

describe("SEC-08 (lot 52) — Jeton « Ce n'est pas moi »", () => {
  it("seul le haché est gardé, et il ne révèle pas le jeton", () => {
    const token = newAlertToken();
    expect(hashAlertToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAlertToken(token)).not.toContain(token);
    expect(hashAlertToken(token)).toBe(hashAlertToken(token));
  });
});
