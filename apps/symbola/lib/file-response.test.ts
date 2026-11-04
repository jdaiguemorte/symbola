import { describe, expect, it } from "vitest";
import { fileDownloadResponse } from "./file-response";

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
