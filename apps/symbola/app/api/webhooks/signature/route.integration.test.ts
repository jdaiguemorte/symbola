// DEV-02 — webhook de signature appelé comme le ferait le fournisseur :
// sans secret valable → 401 sans effet ; corps démesuré → 413.
import { afterEach, describe, expect, it } from "vitest";
import { fakeSignatureProvider, setSignatureProviderForTests } from "@/modules/quotes/signature";
import { POST } from "./route";

afterEach(() => setSignatureProviderForTests(undefined));

function post(body: string, headers: Record<string, string> = {}) {
  return POST(new Request("http://localhost/api/webhooks/signature", { method: "POST", body, headers: { "content-type": "application/json", ...headers } }));
}

describe("DEV-02 — Route /api/webhooks/signature", () => {
  it("rejette (401) un appel sans secret ou avec un secret faux", async () => {
    setSignatureProviderForTests(fakeSignatureProvider());
    const body = JSON.stringify({ event_type: "form.completed", data: { submission_id: "x", external_id: "y" } });
    expect((await post(body)).status).toBe(401);
    expect((await post(body, { "x-symbola-fake-signature": "faux" })).status).toBe(401);
  });

  it("rejette (401) tout appel quand la signature n'est pas configurée", async () => {
    setSignatureProviderForTests(null);
    expect((await post("{}", Object.fromEntries(fakeSignatureProvider().webhookHeaders()))).status).toBe(401);
  });

  it("refuse un corps démesuré (413) avant toute lecture", async () => {
    setSignatureProviderForTests(fakeSignatureProvider());
    expect((await post("x".repeat(300 * 1024))).status).toBe(413);
  });
});
