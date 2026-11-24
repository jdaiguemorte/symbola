# Lot 67e (HUB-14, PRE-02 ; recette du 24/11/2026, R07) — export « prestataires d'un évènement » du
# logiciel de planification tiers, reconstitué avec des données ENTIÈREMENT FICTIVES (noms et
# sociétés inventés, adresses en exemple.invalid, téléphones dans les plages réservées à la fiction
# par l'ARCEP : 01 99 00 xx xx et 06 39 98 xx xx). Seule la structure de l'export réel est
# reproduite (A4 paysage, positions des colonnes, en-tête avec la date et les clients, pied de
# page), avec ses pièges : cellules vides, deux prestataires du même type, type combiné, ligne de
# la planner, Instagram écrit plus petit et un point plus bas, mentions légales en pied de page.
# L'exemple réel n'est jamais versé au dépôt.
#
# Relancer (reportlab requis, Python 3.10 ou plus) :
#   docker run --rm -v "$PWD":/w -w /w python:3.12-slim sh -c "pip install -q reportlab && python generate_prestataires.py"
# depuis packages/testing/import-corpus ; le fichier produit est commité.
import os

from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "files", "logiciel-tiers")
os.makedirs(OUT, exist_ok=True)

PAGE_W, PAGE_H = 842.88, 595.92
COLUMNS = [44.4, 192.4, 346.3, 449.9, 628.8, 700.3]
HEADERS = ["Type de Prestataire", "Nom", "Contact", "E-mail", "Téléphone", "Instagram"]
FIRST_ROW = 161.0
ROW = 13.8

# type, nom, contact, e-mail, téléphone, instagram (petit : écrit en 4.3, un point plus bas)
ROWS = [
    ("Baby-Sitter", "Les P'tits Loups", "Lison FERRAND", "lespetitsloups@exemple.invalid", "0639980101", "", False),
    ("Brunch", "Douceurs d'Ambre", "Ambre SOULIER", "douceurs@exemple.invalid", "", "", False),
    ("Coiffeur(se) - Maquilleur(se)", "Iris Beauté", "Iris MARCHAND", "iris.beaute@exemple.invalid", "06.39.98.01.02", "", False),
    ("DJ", "Nuit Blanche Sono", "Raphaël DUVAL", "nuitblanche@exemple.invalid", "06 39 98 01 03", "", False),
    ("Décorateur", "Au Fil des Détails", "Maud SERVAIS", "aufildesdetails@exemple.invalid", "06.39.98.01.04.", "@au.fildesdetails", True),
    ("Fleuriste", "Pétales & Compagnie", "Delphine", "contact@petales.exemple.invalid", "0639980105", "@petalesetcie", False),
    ("Fleuriste", "Fleurs du Clain", "Justine ENAULT-ROBERT", "fleursduclain@exemple.invalid", "0639980106", "", False),
    ("Lieu", "Domaine des Tilleuls", "Nicolas CHEVREAU", "tilleuls@exemple.invalid", "01.99.00.01.07", "@domainedestilleuls", True),
    ("Photobooth", "FlashBooth", "", "", "06 39 98 01 08", "", False),
    ("Photographe", "Studio Lumière", "Antoine OLIVIER", "studio.lumiere@exemple.invalid", "06 39 98 01 09", "@studio_lumiere_mariage", True),
    ("Robe de mariée", "Atelier de Margot", "Margot LECOUTURIER", "", "", "", False),
    ("Vidéaste", "La Boîte à Films", "Guillaume MOREL", "", "0639980110", "@laboiteafilms", False),
    ("Wedding Planner", "Belle Journée", "Camille RENARD", "bonjour@bellejournee.exemple.invalid", "0639980111", "@belle_journee_wp", False),
]


def top(c, x, y, text, size=5.3, bold=False):
    """Écrit à (x, y), y mesuré depuis le haut de la page (haut de la ligne)."""
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, PAGE_H - y - size * 0.8, text)


def build(path):
    c = canvas.Canvas(path, pagesize=(PAGE_W, PAGE_H))
    c.setTitle("Export des Prestataires")
    c.setCreator("Html2Pdf - TCPDF")
    top(c, 42.0, 65.9, "Date de l'événement", bold=True)
    top(c, 99.5, 65.9, ": samedi 12 juin 2027")
    top(c, 42.0, 78.5, "Clémence MARTIN", bold=True)
    top(c, 42.0, 85.7, "Bastien LEROY", bold=True)
    top(c, 49.2, 100.7, "Export des Prestataires", size=24.1, bold=True)
    for x, header in zip(COLUMNS, HEADERS):
        top(c, x, 145.6, header, bold=True)
    for index, (*cells, small_instagram) in enumerate(ROWS):
        y = FIRST_ROW + index * ROW
        for column, (x, text) in enumerate(zip(COLUMNS, cells)):
            if not text:
                continue
            if column == 5 and small_instagram:
                top(c, x, y + 1.0, text, size=4.3)
            else:
                top(c, x, y, text)
    top(c, 40.7, 532.5, "Entrepreneur Individuel Belle Journée | 1 rue de l'Exemple | 86000 Poitiers | France | N° Siret : 00000000000000 | Code APE : 8230Z | RCS : Poitiers", size=7.5)
    top(c, 283.3, 549.0, "bonjour@bellejournee.exemple.invalid | 0639980111", size=7.5)
    top(c, 413.8, 550.5, "Mis à jour le dimanche 22 novembre 2026 à 15:04", size=6.0)
    top(c, 549.3, 549.0, "1/1", size=7.5)
    c.save()


build(os.path.join(OUT, "prestataires-evenement.pdf"))
