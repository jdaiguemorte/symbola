# Lot 14 — fichiers d'export d'un logiciel de planification tiers, reconstitués
# avec des données ENTIÈREMENT FICTIVES (noms, adresses, e-mails en
# example.org, téléphones dans les plages réservées à la fiction par l'ARCEP :
# 01 99 00 xx xx et 06 39 98 xx xx). Seuls la structure et les défauts des
# exports réels sont reproduits : mêmes intitulés de colonnes, colonnes « Site
# Internet » et « Critères avancés » inversées, 22e colonne sans titre (les
# prestations), entités HTML (&eacute;…), codes postaux enregistrés comme des
# nombres (zéro initial perdu), téléphones en plusieurs formats ; fiche
# événement PDF d'une page, mariés sur deux colonnes, lieux côte à côte,
# bloc budget et pied de page de l'entreprise.
#
# Relancer : python3 generate_tiers.py (openpyxl et reportlab requis) ; les
# fichiers produits sont commités, la CI ne relance pas ce script.
import os

import openpyxl
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "files", "logiciel-tiers")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- prestataires
HEADER = [
    "Nom", "Type de Prestataire", "Prénom", "Nom", "E-mail", "Adresse", "Code Postal", "Ville",
    "Département", "Téléphones", "Site Internet", "Critères avancés", "Page Facebook", "Lien X",
    "Lien Linkedin", "Lien Pinterest", "Lien Instagram", "N° Siret", "Tva Intracommunautaire",
    "Code APE", "Statut Juridique", None,
]

# (nom, type, prénom, nom, e-mail, adresse, CP, ville, dépt, téléphones,
#  « Site Internet » (en réalité : critères), « Critères avancés » (en réalité : site),
#  facebook, instagram, siret, tva, ape, statut, prestations)
VENDORS = [
    ("Domaine des Tilleuls", "Lieu", "Claire", "Fontaine", "contact@domaine-tilleuls.example.org", "2 allée des Tilleuls", 86000, "Poitiers", 86, "06 39 98 00 01",
     "Moins de 50 invités,50 à 100 invités,100 à 150 invités,Hébergement sur place", "https://www.domaine-tilleuls.example.org", None, "https://www.instagram.com/domaine.tilleuls.exemple", 12345678900011, "FR00123456789", "5510Z", "SAS",
     "Salle de r&eacute;ception 180 m&sup2;\nParc arbor&eacute;\nH&eacute;bergement 24 couchages\nLocation week-end : 4 500&nbsp;&euro;"),
    ("Ch&acirc;teau de la Roche Fictive", "Lieu", "Henri", "Delaroche", "evenements@chateau-roche.example.org", None, 79000, "Niort", 79, "0639980002",
     None, None, None, None, None, None, None, None, None),
    ("Maison Verdier Traiteur", "Traiteur", "Paul", "Verdier", "paul.verdier@example.org", "14 rue des Saveurs", 86000, "Poitiers", 86, "06.39.98.00.03",
     None, None, None, "https://www.instagram.com/maison.verdier.exemple", None, None, None, None,
     "Cocktail 12 pi&egrave;ces : 18&nbsp;&euro; / pers.\nMenu 3 plats : 55&nbsp;&euro; / pers.\nService et vaisselle compris"),
    ("Les Saveurs d'Antan", "Traiteur", None, None, None, None, None, None, None, "0639980004",
     None, None, None, None, None, None, None, None, None),
    ("Studio Lumière", "Photographe", "Léa", "Marchand", "lea@studio-lumiere.example.org", "5 place du Marché", 37000, "Tours", 37, "+33 6 39 98 00 05",
     "Reportage,Séance couple,Album", "https://www.studio-lumiere.example.org", "https://www.facebook.com/studiolumiere.exemple", "https://www.instagram.com/studio.lumiere.exemple", None, None, None, None, None),
    ("Clic &amp; Déclic", "Photographe & Vidéaste", "Tom", "Leroy", "tom.leroy@example.org", None, None, None, None, "06 39 98 00 06",
     None, None, None, None, None, None, None, None, None),
    ("DJ Nova", "DJ", "Nicolas", "Vasseur", "dj.nova@example.org", None, 86180, "Buxerolles", 86, "0639980007 ( Nicolas),0639980008 ( Julie)",
     "Pop,Rock,Années 80,Électro", None, None, "https://www.instagram.com/djnova.exemple", None, None, None, None,
     "Soir&eacute;e 20h &agrave; 4h\nSono + lumi&egrave;res\n950&nbsp;&euro;"),
    ("Sono Événements", "Sonorisation et lumière", None, None, "contact@sono-evenements.example.org", "8 rue de l'Industrie", 5000, "Gap", "05", "04 92 00 00 09",
     None, None, None, None, None, None, None, None, None),
    ("Fleurs de Saison", "Fleuriste", "Amandine", "Rose", "amandine@fleurs-saison.example.org", "3 rue des Lilas", 6000, "Nice", 6, "06 39 98 00 10",
     None, None, None, "https://www.instagram.com/fleurs.saison.exemple", None, None, None, None, None),
    ("Atelier Pétales", "Fleuriste", "Inès", "Garnier", None, None, None, None, None, "06 39 98 00 11",
     None, None, None, None, None, None, None, None, None),
    ("Mobilier & Vaisselle Ouest", "Location de mobilier et vaisselle", "Marc", "Lemoine", "location@mvo.example.org", "ZA des Prés", 86360, "Chasseneuil-du-Poitou", 86, "05 49 00 00 12",
     None, None, None, None, 98765432100022, "FR00987654321", "7729Z", "SARL", None),
    ("Beauté du Jour", "Maquillage", "Sarah", "Benali", "sarah.benali@example.org", None, None, None, None, "06 39 98 00 13",
     None, None, None, "https://www.instagram.com/beaute.jour.exemple", None, None, None, None, None),
    ("Coiff' Mariée", "Coiffeur(se)", "Julie", "Martin", None, None, 86000, "Poitiers", 86, "0639980014",
     None, None, None, None, None, None, None, None, None),
    ("Image & Mouvement", "Vidéaste", "Hugo", "Perrin", "hugo@image-mouvement.example.org", None, None, None, None, "06 39 98 00 15",
     None, None, None, None, None, None, None, None, None),
    ("Le Photomaton Joyeux", "Photobooth", None, None, "bonjour@photomaton-joyeux.example.org", None, None, None, None, "06 39 98 00 16",
     None, None, None, None, None, None, None, None, None),
    ("Quatuor Lune", "Musicien", "Élise", "Morel", "quatuor.lune@example.org", None, 37000, "Tours", 37, "06 39 98 00 17",
     "Cérémonie,Cocktail", None, None, None, None, None, None, None, None),
    ("Le Grand Brunch", "Brunch", None, None, None, None, None, None, None, "06 39 98 00 18",
     None, None, None, None, None, None, None, None, None),
    ("Belles Carrosseries", "Location de voitures", "Yann", "Robin", "yann.robin@example.org", None, 79000, "Niort", 79, "06 39 98 00 19",
     None, None, None, None, None, None, None, None, None),
    ("Cave du Clos", "Vins & Boissons", "Antoine", "Clos", "cave@clos.example.org", "1 chemin des Vignes", 49000, "Angers", 49, "02 41 00 00 20",
     None, None, None, None, None, None, None, None, None),
    ("Douceurs Montées", "Cake Designer", "Camille", "Faure", "camille.faure@example.org", None, None, None, None, "06 39 98 00 21",
     None, None, "https://www.pinterest.fr/douceurs.montees.exemple", None, None, None, None, None, None),
    ("La Roulotte Gourmande", "Food Truck", None, None, "roulotte@example.org", None, 86000, "Poitiers", 86, "06 39 98 00 22",
     None, None, None, None, None, None, None, None, None),
    ("Officiant Laïque Exemple", "Officiant de cérémonie", "Margaux", "Lefort", "margaux.lefort@example.org", None, 33000, "Bordeaux", 33, "06 39 98 00 23",
     None, None, None, None, None, None, None, None, None),
    ("Papeterie du Lys", "Faire-part", "Lucie", "Bernard", None, None, 17000, "La Rochelle", 17, "06 39 98 00 24",
     None, None, None, None, None, None, None, None, None),
    ("Tentes & Toiles", "Location de tentes", None, None, "contact@tentes-toiles.example.org", None, None, None, None, "05 49 00 00 25",
     None, None, None, None, None, None, None, None, None),
    ("Les Petits Gardiens", "Baby-Sitter", "Manon", "Dubois", "manon.dubois@example.org", None, 86000, "Poitiers", 86, "06 39 98 00 26",
     None, None, None, None, None, None, None, None, None),
]

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Worksheet"
ws.append(HEADER)
for v in VENDORS:
    (name, kind, first, last, email, address, cp, city, dept, phones, site_col, criteria_col,
     facebook, instagram, siret, tva, ape, status, services) = v[:19]
    pinterest = None
    # Le cas « Douceurs Montées » range son lien Pinterest dans Facebook : ramené à sa colonne.
    if facebook and "pinterest" in facebook:
        pinterest, facebook = facebook, None
    ws.append([name, kind, first, last, email, address, cp, city, dept, phones, site_col, criteria_col,
               facebook, None, None, pinterest, instagram, siret, tva, ape, status, services])
wb.save(os.path.join(OUT, "prestataires.xlsx"))

# ---------------------------------------------------------------- fiches événement
PAGE_W, PAGE_H = A4  # 595.28 x 841.89, comme l'export réel

def top(c, x, y, text, size=9.5, bold=False):
    """Écrit à la position (x, y) mesurée depuis le haut, comme pdftotext."""
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, PAGE_H - y - size * 0.8, text)

def top_split(c, x, y, label, rest, size=9.5):
    """Libellé puis suite en deux morceaux de texte distincts, comme l'export réel
    (« Date de l'événement » puis « : samedi… », « Lieu » puis « - samedi… »)."""
    c.setFont("Helvetica", size)
    top(c, x, y, label, size)
    top(c, x + c.stringWidth(label + " ", "Helvetica", size), y, rest, size)

def fiche(path, couple_title, date_line, people, phones, places, note, budget):
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle("Fiche événement")
    c.setCreator("Html2Pdf - TCPDF")
    top(c, 58.4, 97.7, couple_title, size=13, bold=True)
    label, rest = date_line.split(" : ", 1)
    top_split(c, 44.8, 135.0, label, ": " + rest)
    columns = (47.0, 248.3)
    for index, person in enumerate(people):
        x = columns[index]
        top(c, x, 151.0, person["name"], bold=True)
        if person.get("email"):
            top(c, x, 168.0, f"E-mail: {person['email']}")
        if person.get("address"):
            top(c, x, 185.0, f"Adresse : {person['address']}")
            top(c, x, 202.1, person["city"])
    if phones:
        top(c, 47.0, 219.1, f"Téléphones: {phones}")
    top(c, 44.8, 250.8, "Lieu de l'événement", bold=True)
    place_columns = (44.8, 299.1)
    for index, (label, when) in enumerate(places):
        x = place_columns[index % 2]
        y = 264.6 + (index // 2) * 28.4
        rest = f"- {when}"
        # Le second lieu passe à la ligne comme dans l'export réel (colonne étroite) :
        # l'heure part seule sur la ligne suivante.
        if index % 2 == 1 and len(label + rest) > 46:
            cut = rest.rfind(" à ")
            top_split(c, x, y, label, rest[: cut + 2])
            top(c, x, y + 14.2, rest[cut + 3 :])
        else:
            top_split(c, x, y, label, rest)
    if note:
        top(c, 44.8, 292.9 + ((len(places) - 1) // 2) * 28.4, note)
    top(c, 44.8, 375.7, "Le budget de l'évènement", bold=True)
    rows = [
        ("Budget Souhaité", budget["wanted"]),
        ("Total Payé", budget["paid"]),
        ("Solde", budget["balance"]),
        ("Total", budget["total"]),
    ]
    for offset, (label, value) in enumerate(rows):
        top(c, 44.8, 389.6 + offset * 14.15, f"{label} : {value} €")
    top(c, 44.8, 460.4, f"Budget Total : {budget['budget_total']} €")
    top(c, 44.8, 474.6, f"Budget Restant : {budget['remaining']} €")
    top(c, 44.8, 488.8, f"Vous avez utilisé {budget['used']}% de votre budget")
    # Pied de page : l'entreprise de la planner (jamais importé).
    top(c, 29.0, 775.7, "SAS Atelier Exemple | 1 rue de l'Exemple | 99999 Villefictive | France | N° Siret : 00000000000000 | Code APE : 0000Z | Tva", size=7.4)
    top(c, 200.5, 792.7, "Intracommunautaire : FR00000000000 | RCS : Villefictive", size=7.4)
    top(c, 226.8, 809.7, "| 0199000000 Julie EXEMPLE :", size=7.4)
    top(c, 4.2, 839.9, "Powered by TCPDF (www.tcpdf.org)", size=1)
    c.save()

# 1. Cas complet : deux mariés, deux lieux côte à côte (le second passe à la ligne), une note.
fiche(
    os.path.join(OUT, "fiche-evenement-complete.pdf"),
    "Léa MARTIN & Hugo BERNARD",
    "Date de l'événement : samedi 12 juin 2027",
    [
        {"name": "Léa MARTIN", "email": "lea.martin@example.org", "address": "12 rue des Lilas", "city": "86000 POITIERS"},
        {"name": "Hugo BERNARD", "email": "hugo.bernard@example.org", "address": "12 rue des Lilas", "city": "86000 POITIERS"},
    ],
    "0639980101",
    [("Domaine des Tilleuls", "samedi 12 juin 2027 à 14:30"), ("Église Saint-Exemple de Villefictive", "samedi 12 juin 2027 à 16:00")],
    "Cérémonie laïque",
    {"wanted": "25000", "paid": "3200.0", "balance": "18450.5", "total": "21650.5", "budget_total": "0", "remaining": "-21650.5", "used": "0"},
)

# 2. Cas minimal : un seul marié renseigné, un seul lieu, pas de budget souhaité, pas de téléphone.
fiche(
    os.path.join(OUT, "fiche-evenement-minimale.pdf"),
    "Inès DUPONT-MOREAU & Malik AMRANI",
    "Date de l'événement : vendredi 3 septembre 2027",
    [
        {"name": "Inès DUPONT-MOREAU", "email": "ines.dupont@example.org", "address": None, "city": None},
        {"name": "Malik AMRANI"},
    ],
    None,
    [("Château de la Roche Fictive", "vendredi 3 septembre 2027 à 17:00")],
    None,
    {"wanted": "0", "paid": "0.0", "balance": "0.0", "total": "0.0", "budget_total": "0", "remaining": "0.0", "used": "0"},
)

# 3. Trois lieux (le troisième sur une deuxième rangée), deux téléphones, date d'hiver.
fiche(
    os.path.join(OUT, "fiche-evenement-trois-lieux.pdf"),
    "Chloé PETIT & Antoine ROUX",
    "Date de l'événement : samedi 9 décembre 2028",
    [
        {"name": "Chloé PETIT", "email": "chloe.petit@example.org", "address": "4 impasse du Moulin", "city": "37000 TOURS"},
        {"name": "Antoine ROUX", "email": "antoine.roux@example.org", "address": "4 impasse du Moulin", "city": "37000 TOURS"},
    ],
    "0639980102,0639980103",
    [
        ("Mairie de Villefictive", "samedi 9 décembre 2028 à 11:00"),
        ("Moulin de Beauregard", "samedi 9 décembre 2028 à 15:00"),
        ("Salle des Fêtes Exemple", "samedi 9 décembre 2028 à 19:30"),
    ],
    None,
    {"wanted": "18000", "paid": "1500.0", "balance": "9800.0", "total": "11300.0", "budget_total": "0", "remaining": "-11300.0", "used": "0"},
)
print("Fichiers écrits dans", OUT)
