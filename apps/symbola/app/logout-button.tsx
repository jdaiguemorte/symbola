"use client";

// Lot 29a (ARC-09 ; ADR 0064, décision D4) — se déconnecter efface d'abord les copies du
// jour J gardées sur cet appareil, puis ferme la session (logoutAction, inchangée).
import { purgeAllDayCopies } from "@/lib/offline/device-copies";
import { logoutAction } from "./logout-action";

export function LogoutButton({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        await purgeAllDayCopies();
        await logoutAction();
      }}
    >
      <button type="submit">{label}</button>
    </form>
  );
}
