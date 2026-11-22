"use client";

// Lot 65d (MSG-01, HUB-28 ; ADR 0110) — ouvre la fenêtre « Préparer l'e-mail » sur n'importe quel écran
// de l'équipe dont l'adresse porte ?preparer=<identifiants> : un élément « À envoyer » d'« Aujourd'hui »,
// ou l'écran d'un geste qui vient de préparer des messages (proposition, brief, programme…).
// L'adresse ne porte que des identifiants (jamais de nom ni d'adresse e-mail). À la fermeture, le
// paramètre est retiré et l'écran relu.
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PreparedEmailDraft } from "@symbola/contracts";
import { PrepareEmailDialog } from "@/app/ui/prepare-email-dialog";
import { loadPreparedEmailsAction } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PrepareEmailHost() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requested = params.get("preparer") ?? "";
  const ids = requested.split(",").filter((id) => UUID.test(id)).slice(0, 30);
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; drafts: PreparedEmailDraft[] | null } | null>(null);
  // Recomposer un message peut donner un nouveau lien personnel : une seule demande par ouverture.
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!key) {
      asked.current = null;
      setState(null);
      return;
    }
    if (asked.current === key) return;
    asked.current = key;
    setState({ key, drafts: null });
    loadPreparedEmailsAction(key.split(","))
      .then((result) => setState((current) => (current?.key === key ? { key, drafts: result.drafts } : current)))
      .catch(() => setState((current) => (current?.key === key ? { key, drafts: [] } : current)));
  }, [key]);

  if (!state || state.key !== key) return null;
  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("preparer");
    const query = next.toString();
    asked.current = null;
    setState(null);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    router.refresh();
  };
  return <PrepareEmailDialog key={key} drafts={state.drafts ?? []} loading={state.drafts === null} onClose={close} />;
}
