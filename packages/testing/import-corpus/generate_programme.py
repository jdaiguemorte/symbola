# Lot 63b (CHR-08) — export « programme » du jour J d'un logiciel de planification tiers,
# reconstitué avec des données ENTIÈREMENT FICTIVES (noms et sociétés inventés, téléphones dans
# les plages réservées à la fiction par l'ARCEP : 01 99 00 xx xx et 06 39 98 xx xx). Seule la
# structure des exports réels est reproduite (A4 paysage, positions des colonnes, bandeaux de
# jour, description sur deux pages, interlocuteurs « Rôle - Nom », colonne « Caché des mariés »,
# pied de page), avec les sept pièges relevés le 21/11 (docs/audits/2026-11-21-recette-planner.md,
# § 4 bis). Les exemples réels ne sont jamais versés au dépôt.
#
# Relancer (reportlab requis, Python 3.10 ou plus) :
#   docker run --rm -v "$PWD":/w -w /w python:3.12-slim sh -c "pip install -q reportlab && python generate_programme.py"
# depuis packages/testing/import-corpus ; les fichiers produits sont commités.
import os

from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "files", "logiciel-tiers")
os.makedirs(OUT, exist_ok=True)

PAGE_W, PAGE_H = 842.88, 595.92
LINE = 10.2
BOTTOM = 515.0
TOP = 69.7
COLUMNS = {"time": 54.9, "title": 132.8, "description": 288.5, "contact": 609.7, "hidden": 755.5}


def top(c, x, y, text, size=7.0, bold=False):
    """Écrit à (x, y), y mesuré depuis le haut de la page (haut de la ligne)."""
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, PAGE_H - y - size * 0.8, text)


class Document:
    def __init__(self, path, pages_hint):
        self.c = canvas.Canvas(path, pagesize=(PAGE_W, PAGE_H))
        self.c.setTitle("Programme")
        self.c.setCreator("Html2Pdf - TCPDF")
        self.page = 1
        self.pages_hint = pages_hint

    def footer(self):
        top(self.c, 297.1, 542.2, f"Mis à jour le samedi 21 novembre 2026 à 14:25 - https://exemple.invalid/f/abcd {self.page}/{self.pages_hint}", size=7.5)

    def next_page(self):
        self.footer()
        self.c.showPage()
        self.page += 1

    def save(self):
        self.footer()
        self.c.save()


def header(doc, title, date, couple, planner, places, guests_header, guests_values, speakers, split_speakers_at):
    c = doc.c
    top(c, 254.0, 92.1, title, size=28, bold=True)
    top(c, 344.9, 130.9, date, size=14, bold=True)
    for index, (name, phone) in enumerate(couple):
        x = 300.3 + index * 189.7
        top(c, x, 151.3, name, bold=True)
        if phone:
            top(c, x + 5, 160.9, phone)
    top(c, 406.2, 203.0, planner[0], bold=True)
    top(c, 363.6, 213.2, f"{planner[1]} {planner[2]}")
    top(c, 51.7, 227.8, "Lieu de l'événement", size=14, bold=True)
    for index, (when, name, kind) in enumerate(places):
        x = 51.7 + index * 189.7
        top(c, x, 264.2, when, bold=True)
        top(c, x, 274.4, name)
        top(c, x, 304.3, kind, bold=True)
    # Piège 7 : le résumé des invités change de colonnes d'un export à l'autre.
    top(c, 51.7, 342.6, "Résumé", size=11.5, bold=True)
    top(c, 54.9, 367.5, "Invitation", bold=True)
    for index, label in enumerate(guests_header):
        top(c, 145.0 + index * 53.0, 367.5, label, bold=True)
    top(c, 54.9, 384.0, "Réception")
    for index, value in enumerate(guests_values):
        top(c, 145.0 + index * 53.0, 384.0, value)
    # Tableau des intervenants, qui continue sur la page suivante.
    xs = (87.3, 219.1, 347.2, 536.9, 697.1)
    for x, label in zip(xs, ("Rôle", "Nom", "Contact", "Téléphone", "Instagram")):
        top(c, x, 420.4, label, bold=True)
    y = 438.2
    for index, speaker in enumerate(speakers):
        if index == split_speakers_at:
            doc.next_page()
            y = 73.6
        for x, value in zip(xs, speaker):
            if value:
                top(c, x, y, value)
        y += 17.2
    doc.next_page()


def programme(doc, days):
    """days : [(bandeau, [séquence])], séquence = dict(time, title, description, contacts, hidden)."""
    c = doc.c
    top(c, COLUMNS["title"], 92.7, "Titre", bold=True)
    top(c, COLUMNS["description"], 92.7, "Description", bold=True)
    top(c, 599.8, 92.7, "Interlocuteur", bold=True)
    top(c, COLUMNS["hidden"], 72.9, "Caché", bold=True)
    top(c, COLUMNS["hidden"], 83.1, "des", bold=True)
    top(c, COLUMNS["hidden"], 92.7, "mariés", bold=True)
    y = 110.5
    for banner, rows in days:
        if y > BOTTOM - 20:
            doc.next_page()
            y = TOP
        top(c, COLUMNS["time"], y, banner, bold=True)
        y += 17.3
        for row in rows:
            if y > BOTTOM - 10:
                doc.next_page()
                y = TOP
            top(c, COLUMNS["time"], y, row["time"], bold=True)
            for offset, line in enumerate(row.get("title", [])):
                top(c, COLUMNS["title"], y + offset * LINE, line)
            for offset, contact in enumerate(row.get("contacts", [])):
                # Un interlocuteur long est décalé d'une ligne et un peu à gauche, comme dans l'export réel.
                if len(contact) > 34:
                    top(c, 599.8, y + (offset + 1) * LINE, contact)
                else:
                    top(c, COLUMNS["contact"], y + offset * LINE, contact)
            if row.get("hidden"):
                top(c, COLUMNS["hidden"], y, row["hidden"])
            height = max(len(row.get("title", [])), len(row.get("contacts", [])) + (1 if any(len(x) > 34 for x in row.get("contacts", [])) else 0), 1)
            # La description peut passer sur la page suivante (menus, déroulé de la cérémonie).
            line_y = y
            lines_here = 0
            for line in row.get("description", []):
                if line_y > BOTTOM:
                    doc.next_page()
                    line_y = TOP
                    y = TOP
                    lines_here = 0
                    height = 0
                if line:
                    top(c, COLUMNS["description"], line_y, line)
                line_y += LINE
                lines_here += 1
            y += max(height, lines_here) * LINE + 7.0


# 1. Trois jours (veille, jour J, lendemain), description sur deux pages, interlocuteurs variés.
doc = Document(os.path.join(OUT, "programme-jour-j.pdf"), 4)
header(
    doc,
    "Mariage Clémence & Bastien",
    "samedi 12 juin 2027",
    [("Clémence ARNAUD", "0639980201"), ("Bastien LEBRUN", None)],
    ("Atelier Exemple", "Julie EXEMPLE", "0199000000"),
    [("samedi 12 juin 2027 à 14:00", "DOMAINE DES TILLEULS", "Réception"), ("samedi 12 juin 2027 à 16:00", "MAIRIE DE VILLEFICTIVE", "Cérémonie")],
    ["Adulte", "Enfants", "Total"],
    ["0", "0", "0"],
    [
        ("Coiffeur(se) - Maquilleur(se)", "Iris Beauté", "Iris MOREL", "06 39 98 02 02", None),
        ("DJ", "Ondes Sonores", "Félix ROUSSEL", "06 39 98 02 03", "@ondes.exemple"),
        ("Traiteur", "Maison Verdier Traiteur", "Paul VERDIER", "0639980204", None),
        ("Lieu", "Domaine des Tilleuls", "Claire FONTAINE", "01 99 00 02 05", None),
        ("Marié", "Couple", "Bastien LEBRUN", None, None),
        ("Mariée", "Couple", "Clémence ARNAUD", "0639980201", None),
        ("Photographe", "Studio Lumière", "Léa MARCHAND", "06 39 98 02 06", None),
        ("WeddingPlanner", "Atelier Exemple", "Julie EXEMPLE", "0199000000", None),
    ],
    split_speakers_at=4,
)
programme(
    doc,
    [
        (
            "vendredi 11 juin 2027",
            [
                {"time": "12:00", "title": ["Récupérer les clés"], "contacts": ["Lieu - Claire", "WeddingPlanner - Julie"]},
                {"time": "12:15 - 13:30", "title": ["Installation espace", "cérémonie"], "description": ["Mettre les housses sur les chaises", "Installer l'arche"], "contacts": ["Lieu - Claire", "WeddingPlanner - Julie"]},
                # Piège 1 : une fin plus tôt que le début finit le lendemain.
                {"time": "19:00 - 02:00", "title": ["Soirée de la veille"], "description": ["Apéritif servi à partir de 20h"], "contacts": ["Traiteur - Paul"]},
            ],
        ),
        (
            "samedi 12 juin 2027",
            [
                # Rôle qui contient lui-même « - », interlocuteur décalé.
                {"time": "10:00", "title": ["Arrivée d'Iris"], "contacts": ["Coiffeur(se) - Maquilleur(se) - Iris"]},
                # Piège 1 : une fin à 00:00 est absente.
                {"time": "11:00 - 00:00", "title": ["Repas à la charge des mariés"], "contacts": ["Mariée - Clémence"]},
                # Piège 3 : un interlocuteur sans rôle (un témoin) reste en texte.
                {"time": "12:00", "title": ["Habillage du marié"], "contacts": ["Gaspard", "Photographe - Léa"]},
                # Piège 5 : le nom après le rôle est le nom de famille.
                {"time": "14:00", "title": ["Arrivée du DJ"], "description": ["Vient avec 2 micros", "Prévoir 1h d'installation"], "contacts": ["DJ - ROUSSEL"]},
                # Description sur deux pages.
                {
                    "time": "15:30 - 16:30",
                    "title": ["Cérémonie laïque"],
                    "description": ["Dans le jardin", "Durée prévue : 30 minutes", "", "Entrée du marié : musique à définir", "Entrée du cortège", "Entrée de la mariée", "", "Discours des témoins", "Échange des vœux", "Échange des alliances", "", "Sortie des mariés", "Jeté de pétales", "", "Plan B : sous le préau", "Plan C : dans la salle", "Fond musical : playlist", "", "Ligne 19", "Ligne 20", "Ligne 21", "Ligne 22", "Ligne 23", "Ligne 24", "Ligne 25", "Ligne 26", "Ligne 27", "Ligne 28", "Ligne 29", "Ligne 30", "Ligne 31", "Ligne 32", "Ligne 33", "Fin du déroulé"],
                    "contacts": ["Marié - Bastien", "Mariée - Clémence", "Photographe - Léa", "WeddingPlanner - Julie"],
                },
                # Piège 2 : une ligne sans interlocuteur est un repère.
                {"time": "21:18", "title": ["Coucher du soleil"]},
                # Piège 6 : « Caché des mariés ».
                {"time": "21:30 - 21:45", "title": ["Animation surprise"], "contacts": ["DJ - Félix", "WeddingPlanner - Julie"], "hidden": "Oui"},
            ],
        ),
        (
            "dimanche 13 juin 2027",
            [
                {"time": "00:30", "title": ["Fin de soirée"], "contacts": ["DJ - Félix"]},
                {"time": "11:00", "title": ["Brunch"], "contacts": ["Traiteur - Paul", "Lieu - Claire"]},
            ],
        ),
    ],
)
doc.save()

# 2. Un seul jour, autre résumé des invités, deux traiteurs, la planner deux fois, une tâche sans heure.
doc = Document(os.path.join(OUT, "programme-jour-j-court.pdf"), 2)
header(
    doc,
    "Mariage Inès & Malik",
    "vendredi 3 septembre 2027",
    [("Inès DUPONT-MOREAU", "0639980301")],
    ("Atelier Exemple", "Julie EXEMPLE", "0199000000"),
    [("vendredi 3 septembre 2027 à 17:00", "CHÂTEAU DE LA ROCHE FICTIVE", "Réception")],
    ["Enfants", "Homme", "Femme", "Adultes", "Total"],
    ["12", "30", "34", "64", "76"],
    [
        # Piège 4 : deux traiteurs, et la planner listée deux fois.
        ("Traiteur", "Les Saveurs d'Antan", "Roger AUBRY", "01 99 00 03 01", None),
        ("Traiteur", "La Barque Fictive", "Benoît CARON", None, None),
        ("Wedding Planner", "Atelier Exemple", "Julie EXEMPLE", "0199000000", "@atelier.exemple"),
        ("WeddingPlanner", "Atelier Exemple", "Julie EXEMPLE", "0199000000", "@atelier.exemple"),
    ],
    split_speakers_at=99,
)
programme(
    doc,
    [
        (
            "vendredi 3 septembre 2027",
            [
                # Piège 1 : « 00:00 » seul, une tâche sans heure.
                {"time": "00:00", "title": ["Récupérer les marque-places"], "contacts": ["Wedding Planner - Julie"]},
                {"time": "14:30", "title": ["Arrivée de la barque à huîtres"], "contacts": ["Traiteur - Benoît"]},
                {"time": "20:00", "title": ["Service de l'entrée"], "contacts": ["Traiteur - Roger"]},
                {"time": "20:30 - 20:45", "title": ["Animation 1"], "contacts": ["Traiteur - Roger", "Wedding Planner - Julie"], "hidden": "Oui"},
            ],
        ),
    ],
)
doc.save()
