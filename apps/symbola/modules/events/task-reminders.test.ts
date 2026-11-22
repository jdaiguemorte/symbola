// Lot 27a (CHR-04, décision D7) — règles pures des rappels des tâches du client :
// seuils (sept jours avant, la veille et le jour même, retard dans la semaine),
// heures d'envoi à Paris (changements d'heure compris), texte de l'e-mail.
import { describe, expect, it } from "vitest";
import { starterClientTaskReminders } from "@symbola/starter-templates";
import { daysBetween, parisHour, reminderTaskLines, reminderThreshold } from "./task-reminders";

const policy = starterClientTaskReminders();

describe("CHR-04 — Rappel automatique des tâches confiées au client", () => {
  it("seuils : rien à huit jours, la semaine de 7 à 2 jours, la veille et le jour même, le retard du lendemain à une semaine", () => {
    const due = "2027-03-10";
    expect(reminderThreshold(due, "2027-03-02", policy)).toBeNull();
    expect(reminderThreshold(due, "2027-03-03", policy)).toBe("week");
    expect(reminderThreshold(due, "2027-03-08", policy)).toBe("week");
    expect(reminderThreshold(due, "2027-03-09", policy)).toBe("eve");
    expect(reminderThreshold(due, "2027-03-10", policy)).toBe("eve");
    expect(reminderThreshold(due, "2027-03-11", policy)).toBe("overdue");
    expect(reminderThreshold(due, "2027-03-17", policy)).toBe("overdue");
    expect(reminderThreshold(due, "2027-03-18", policy)).toBeNull();
  });

  it("les jours se comptent au calendrier, passage à l'heure d'été compris", () => {
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(daysBetween("2027-10-30", "2027-11-01")).toBe(2);
    expect(daysBetween("2027-03-10", "2027-03-03")).toBe(-7);
  });

  it("lot 66a : l'heure de Paris, en hiver comme en été (l'heure d'envoi est celle de l'automatisme)", () => {
    expect(parisHour(new Date("2027-01-10T07:59:00Z"))).toBe(8);
    // Nuit du passage à l'heure d'été : 2 h à Paris n'existe pas.
    expect(parisHour(new Date("2027-03-28T01:30:00Z"))).toBe(3);
  });

  it("l'e-mail liste les tâches par date, sans lien, en français ou en anglais (lot 38a : la valeur de « {{tâches}} » du modèle)", () => {
    const tasks = [
      { label: "Choisir les alliances", dueDate: "2027-03-10", threshold: "week" as const },
      { label: "Envoyer la liste des invités", dueDate: "2027-03-02", threshold: "overdue" as const },
    ];
    const fr = reminderTaskLines({ locale: "fr", tasks, today: "2027-03-03" });
    expect(fr).toBe("- Envoyer la liste des invités : avant le 2 mars 2027 (en retard)\n- Choisir les alliances : avant le 10 mars 2027 (dans 7 jours)");
    expect(fr).not.toMatch(/https?:\/\//);
    expect(reminderTaskLines({ locale: "en", tasks: [tasks[0]!], today: "2027-03-09" })).toBe("- Choisir les alliances: due March 10, 2027 (tomorrow)");
    expect(reminderTaskLines({ locale: "fr", tasks: [tasks[0]!], today: "2027-03-10" })).toContain("(aujourd'hui)");
  });
});
