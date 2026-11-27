"use client";

// Lot 29a (ARC-09 ; ADR 0064, décision D4) — se déconnecter efface d'abord les copies du
// jour J gardées sur cet appareil, puis ferme la session (logoutAction, inchangée).
// Lot 65f : menu réduit, le bouton n'est plus qu'une icône, son nom en infobulle (`app-nav-label`).
import { LogOut } from "lucide-react";
import { purgeAllDayCopies } from "@/lib/offline/device-copies";
import { logoutAction } from "./logout-action";

// `menu` : dans le menu du compte (lot 70e), sans les classes du menu latéral réduit.
export function LogoutButton({ label, menu = false }: { label: string; menu?: boolean }) {
  return (
    <form
      action={async () => {
        await purgeAllDayCopies();
        await logoutAction();
      }}
    >
      <button type="submit" className={menu ? "account-menu-logout-button" : undefined}>
        <LogOut className="app-user-icon" size={20} aria-hidden="true" strokeWidth={1.5} />
        <span className={menu ? undefined : "app-nav-label"}>{label}</span>
      </button>
    </form>
  );
}
