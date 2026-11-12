"use client";

// Lot 29a (ARC-09 ; ADR 0064, décision D4) — à l'ouverture d'un écran par un compte, les
// copies du jour J d'un autre compte et les copies périmées s'effacent de l'appareil ; sans
// copie restante, le service worker est désinscrit. Rien ne s'affiche.
import { useEffect } from "react";
import { purgeDayCopies } from "@/lib/offline/device-copies";

export function OfflineGuard({ userId }: { userId: string }) {
  useEffect(() => {
    void purgeDayCopies({ userId });
  }, [userId]);
  return null;
}
