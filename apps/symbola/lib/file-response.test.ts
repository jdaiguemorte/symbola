import { describe, expect, it } from "vitest";
import { fileDownloadResponse, fileResponse, isPreviewableMime, previewPath } from "./file-response";

describe("ADR 0027 — fichier privé servi par l'app", () => {
  it("transmet le contenu en téléchargement, sans cache ni devinette de type", async () => {
    const data = Buffer.from("%PDF-1.4 test");
    const response = fileDownloadResponse({ data, contentType: "application/pdf", fileName: "D-2026-0001-signé.pdf" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Length")).toBe(String(data.length));
    expect(response.headers.get("Content-Disposition")).toBe("attachment; filename*=UTF-8''D-2026-0001-sign%C3%A9.pdf");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer()).equals(data)).toBe(true);
  });
});

describe("DOC-01 — Un document s'aperçoit sans téléchargement (D5)", () => {
  const pdf = { data: Buffer.from("%PDF-1.4 test"), contentType: "application/pdf", fileName: "plan.pdf" };

  it("un PDF ou une image demandé en aperçu s'affiche (« inline »), avec son type", () => {
    const response = fileResponse(pdf, new Request("http://localhost/events/1/documents/2?apercu=1"));
    expect([response.headers.get("Content-Disposition"), response.headers.get("Content-Type")]).toEqual(["inline; filename*=UTF-8''plan.pdf", "application/pdf"]);
    const image = fileResponse({ ...pdf, contentType: "image/png", fileName: "plan.png" }, new Request("http://localhost/x?version=2&apercu=1"));
    expect(image.headers.get("Content-Disposition")).toBe("inline; filename*=UTF-8''plan.png");
  });

  it("sans demande d'aperçu, ou pour un autre type, le fichier se télécharge", () => {
    expect(fileResponse(pdf, new Request("http://localhost/x")).headers.get("Content-Disposition")).toBe("attachment; filename*=UTF-8''plan.pdf");
    const other = fileResponse({ ...pdf, contentType: "text/html", fileName: "page.html" }, new Request("http://localhost/x?apercu=1"));
    expect(other.headers.get("Content-Disposition")).toBe("attachment; filename*=UTF-8''page.html");
    expect([isPreviewableMime("image/svg+xml"), isPreviewableMime(null), isPreviewableMime("image/webp")]).toEqual([false, false, true]);
  });

  it("l'adresse d'aperçu garde les paramètres de la route", () => {
    expect([previewPath("/devis/1/pdf?version=2"), previewPath("/events/1/documents/2")]).toEqual(["/devis/1/pdf?version=2&apercu=1", "/events/1/documents/2?apercu=1"]);
  });
});
