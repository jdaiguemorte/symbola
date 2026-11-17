// Lot 40b (Q27, NFR-16 ; décision D14, ADR 0077) — l'écran d'erreur signale une erreur née dans le
// navigateur au relais de l'app (app/api/erreurs), qui la trie et la transmet au suivi des erreurs.
// Une erreur du serveur porte un condensé (digest) : instrumentation.ts l'a déjà envoyée. Rien ne
// remonte si le relais ne répond pas : l'écran reste celui de l'erreur d'origine.
export function reportBrowserError(error: Error & { digest?: string }, reference: string): void {
  if (error.digest) return;
  try {
    void fetch("/api/erreurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, name: error.name, stack: error.stack ?? null, route: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Pas de réseau, ou navigateur trop ancien : rien à faire de plus.
  }
}
