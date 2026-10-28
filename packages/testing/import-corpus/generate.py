# Génère le corpus de fichiers d'import (IMP-01/IMP-02, lot 5). Données
# entièrement fictives. Relancer : python3 generate.py (openpyxl, xlsxwriter
# et LibreOffice requis) ; les fichiers produits sont commités, la CI ne
# relance pas ce script.
import datetime, json, os, shutil, subprocess, tempfile

import openpyxl
import xlsxwriter
from openpyxl.utils.datetime import CALENDAR_MAC_1904

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(HERE, "files")
os.makedirs(FILES, exist_ok=True)

def write(name, data):
    with open(os.path.join(FILES, name), "wb") as f:
        f.write(data)

# 1. Export « CSV » d'Excel français sous Windows : Windows-1252, ;, CRLF.
rows = [
    ["Prénom mariée", "Nom mariée", "Prénom marié", "Nom marié", "Date du mariage", "Lieu", "Ville", "Budget", "E-mail"],
    ["Élodie", "Durand", "Mathéo", "Lefèvre", "12/06/2027", "Château de Vaux", "Maincy", "25 000,00", "elodie.durand@example.org"],
    ["Inès", "Moreau", "Noël", "Garçon", "03/09/2027", "Domaine des Œillets", "Beaune", "18 500,50", "ines.moreau@example.org"],
    ["Chloé", "Petit", "Hugo", "Roux", "", "À définir", "", "", "chloe.petit@example.org"],
]
write("excel-fr-windows1252.csv", "\r\n".join(";".join(r) for r in rows).encode("cp1252") + b"\r\n")

# 2. CSV de Google Sheets : UTF-8 sans BOM, virgule, CRLF, guillemets.
rows = [
    ["Bride first name", "Groom first name", "Wedding date", "Venue", "Notes", "Total budget"],
    ["Emma", "Liam", "2027-05-22", "\"Manor House, Bath\"", "\"Wants \"\"rustic\"\" theme\nCall back in May\"", "\"12,000.00\""],
    ["Olivia", "Noah", "2027-07-10", "Seaside Inn", "", "9500"],
]
write("google-sheets-en.csv", ("\r\n".join(",".join(r) for r in rows) + "\r\n").encode("utf-8"))

# 3. « Texte Unicode » d'Excel : UTF-16LE avec BOM, tabulation.
rows = [
    ["Intitulé", "Unité", "Prix HT", "TVA"],
    ["Coordination jour J", "forfait", "1 500,00", "20 %"],
    ["Heure supplémentaire", "heure", "75,00", "20 %"],
]
write("excel-unicode-text.txt", b"\xff\xfe" + ("\r\n".join("\t".join(r) for r in rows) + "\r\n").encode("utf-16-le"))

# 4. Tableau « maison » : UTF-8 avec BOM, ligne de titre puis ligne vide.
rows = [
    ["Suivi des mariages 2027 – mis à jour le 12/10/2026", "", "", ""],
    ["", "", "", ""],
    ["Tâche", "Échéance", "Responsable", "Faite"],
    ["Réserver le traiteur", "15/01/2027", "Planner", "non"],
    ["Envoyer les faire-part", "01.03.2027", "Mariés", "oui"],
]
write("maison-titre-bom.csv", b"\xef\xbb\xbf" + ("\n".join(";".join(r) for r in rows) + "\n").encode("utf-8"))

# 5. Colonnes dans le désordre, colonnes vides, lignes de longueurs différentes.
rows = [
    "Ville;Date;;Nom client 1;Prénom client 1;Source",
    "Lyon;2027-04-17;;Bernard;Julie;Salon du mariage",
    "Nantes;2027-08-28;;Dubois;Sarah",
    "",
    "Lille;2027-10-02;;Laurent;Manon;Instagram;colonne en trop",
]
write("desordre-lignes-inegales.csv", ("\n".join(rows) + "\n").encode("utf-8"))

# 6. Cellules dangereuses (injection de formules) et nombres signés légitimes.
rows = [
    ["Intitulé", "Montant", "Téléphone", "Commentaire"],
    ["=HYPERLINK(\"http://example.invalid\",\"clic\")", "-12,50", "+33 6 12 34 56 78", "@SUM(A1:A2)"],
    ["Fleurs", "+150", "0612345678", "-2+3"],
    ["  =1+1", "1 234,56 €", "", "\t=cmd"],
]
write("formules.csv", ("\n".join(",".join('"' + c.replace('"', '""') + '"' for c in r) for r in rows) + "\n").encode("utf-8"))

# 7. JSON : objet contenant un tableau d'objets imbriqués.
write("export.json", json.dumps({
    "exportedAt": "2026-10-12T08:00:00Z",
    "events": [
        {"date": "2027-06-12", "venue": {"name": "Château de Vaux", "city": "Maincy"}, "clients": [{"firstName": "Élodie"}, {"firstName": "Mathéo"}], "budget": 25000},
        {"date": None, "venue": {"name": "À définir"}, "tags": ["salon", "2027"], "budget": 18500.5},
    ],
}, ensure_ascii=False, indent=2).encode("utf-8"))

# 8. Classeur « Excel » (xlsxwriter) : feuille de notes masquée en premier,
# titre fusionné, en-tête en ligne 3, dates et montants formatés, formule.
path = os.path.join(FILES, "excel-maison.xlsx")
wb = xlsxwriter.Workbook(path)
notes = wb.add_worksheet("Notes")
notes.write("A1", "Feuille masquée : ne pas importer")
notes.hide()
sheet = wb.add_worksheet("Mariages")
wb.worksheets_objs.reverse()  # la feuille visible n'est pas la première du classeur
date_fmt = wb.add_format({"num_format": "dd/mm/yyyy"})
money_fmt = wb.add_format({"num_format": "#,##0.00 [$€-40C]"})
sheet.merge_range("A1:E1", "Mes mariages 2027")
for col, title in enumerate(["Prénom mariée", "Prénom marié", "Date", "Budget", "Acompte versé"]):
    sheet.write(2, col, title)
data = [("Élodie", "Mathéo", datetime.date(2027, 6, 12), 25000, 7500), ("Inès", "Noël", datetime.date(2027, 9, 3), 18500.5, 0)]
for i, (a, b, d, budget, deposit) in enumerate(data, start=3):
    sheet.write(i, 0, a)
    sheet.write(i, 1, b)
    sheet.write_datetime(i, 2, datetime.datetime.combine(d, datetime.time()), date_fmt)
    sheet.write_number(i, 3, budget, money_fmt)
    sheet.write_formula(i, 4, f"=D{i+1}*0.3", money_fmt, round(budget * 0.3, 2))
wb.close()

# 9. Classeur openpyxl en calendrier 1904 (anciens Excel pour Mac).
wb = openpyxl.Workbook()
wb.epoch = CALENDAR_MAC_1904
ws = wb.active
ws.title = "Événements"
ws.append(["Clients", "Date", "Heure de début"])
ws.append(["Léa & Tom", datetime.date(2027, 2, 14), datetime.time(15, 30)])
ws["B2"].number_format = "yyyy-mm-dd"
ws["C2"].number_format = "hh:mm"
wb.save(os.path.join(FILES, "mac-1904.xlsx"))

# 10. Classeur réenregistré par LibreOffice, et formats refusés (.ods, .xls).
with tempfile.TemporaryDirectory() as tmp:
    src = os.path.join(tmp, "libreoffice.xlsx")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Poste", "Prestataire", "Prévu", "Réel"])
    ws.append(["Traiteur", "Saveurs & Co", 8500, 8720.4])
    ws.append(["Photographe", "Studio Lumière", 2400, None])
    wb.save(src)
    for target, name in (("xlsx:Calc MS Excel 2007 XML", "libreoffice.xlsx"), ("ods", "libreoffice.ods"), ("xls:MS Excel 97", "libreoffice.xls")):
        out = os.path.join(tmp, "out")
        subprocess.run(["soffice", "--headless", "--convert-to", target, "--outdir", out, src], check=True, capture_output=True)
        produced = os.path.join(out, "libreoffice." + name.rsplit(".", 1)[1])
        shutil.copy(produced, os.path.join(FILES, name))
print("corpus généré dans", FILES)
