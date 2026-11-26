// Lot 70b (UX-10) — « Changer la date › Autre date » (aujourd'hui « Reporter » sur l'accueil) : une date.
import { z } from "zod";
import { dueDateField } from "./task-fields";

export const postponeFieldsSchema = z.object({ dueDate: dueDateField });
