// PRD-EVT-05 — rendu A4 du programme du jour J (@react-pdf/renderer). Le
// contenu vient de buildProgramPdfModel ; ce fichier ne fait que la mise
// en page, lisible à l'impression (texte noir, 10 pt minimum).
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ProgramPdfModel } from "./program-pdf-model";

// La césure par défaut suit les règles de l'anglais (« musi-ciens ») : les
// mots restent entiers, le retour à la ligne se fait entre les mots.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  logo: { maxWidth: 140, maxHeight: 60, objectFit: "contain" },
  organization: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  version: { fontSize: 9, color: "#444444", textAlign: "right" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  heading: { fontSize: 13, marginBottom: 2 },
  variant: { fontSize: 10, color: "#444444", marginBottom: 14 },
  // Lot 67d (CHR-07 ; recette du 24/11/2026, R10 et R11) : quatre colonnes dans les deux versions.
  // L'heure tient sur une ligne, la durée dessous ; la note interne passe sous la séquence, sur
  // toute la largeur, au lieu d'une cinquième colonne étroite.
  row: { borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 5 },
  line: { flexDirection: "row" },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 4 },
  headCell: { fontFamily: "Helvetica-Bold" },
  time: { width: "17%", paddingRight: 6 },
  duration: { fontSize: 9, color: "#555555", marginTop: 1 },
  label: { width: "33%", paddingRight: 6 },
  labelText: { fontFamily: "Helvetica-Bold" },
  responsible: { fontSize: 9, color: "#444444", marginTop: 1 },
  location: { width: "22%", paddingRight: 6 },
  participants: { width: "28%" },
  note: { marginLeft: "17%", marginTop: 4, paddingLeft: 6, borderLeftWidth: 1.5, borderLeftColor: "#bbbbbb" },
  noteLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#444444" },
  day: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 4 },
  empty: { marginTop: 12 },
  watermark: {
    position: "absolute",
    top: 380,
    left: 60,
    fontSize: 64,
    fontFamily: "Helvetica-Bold",
    color: "#bbbbbb",
    opacity: 0.4,
    transform: "rotate(-35deg)",
  },
});

export function ProgramPdfDocument({ model }: { model: ProgramPdfModel }) {
  const columnStyles = [styles.time, styles.label, styles.location, styles.participants];
  // Un seul bloc quand le modèle ne sépare pas les jours.
  const days = model.days ?? [{ heading: null, rows: model.rows }];
  const noteLabel = model.columns[4] ?? "";

  return (
    <Document title={`${model.title} — ${model.heading}`} author={model.organizationName} language={model.language}>
      <Page size="A4" style={styles.page} wrap>
        {model.watermark ? (
          <Text style={styles.watermark} fixed>
            {model.watermark}
          </Text>
        ) : null}
        <View style={styles.header} fixed>
          {model.logo ? (
            <Image style={styles.logo} src={{ data: model.logo.data, format: model.logo.format }} />
          ) : (
            <Text style={styles.organization}>{model.organizationName}</Text>
          )}
          <Text style={styles.version}>{model.version}</Text>
        </View>
        <Text style={styles.title}>{model.title}</Text>
        <Text style={styles.heading}>{model.heading}</Text>
        <Text style={styles.variant}>{model.variant}</Text>

        <View style={styles.headRow} fixed>
          {model.columns.slice(0, 4).map((column, index) => (
            <Text key={column} style={[styles.headCell, columnStyles[index]!]}>
              {column}
            </Text>
          ))}
        </View>
        {model.rows.length === 0 ? <Text style={styles.empty}>{model.empty}</Text> : null}
        {days.map((day, dayIndex) => (
          <View key={dayIndex}>
            {day.heading ? (
              <Text style={styles.day} minPresenceAhead={60}>
                {day.heading}
              </Text>
            ) : null}
            {day.rows.map((row, index) => (
              <View key={index} style={styles.row}>
                {/* La ligne de la séquence ne se coupe pas ; sa note, longue, peut passer à la page suivante. */}
                <View style={styles.line} wrap={false}>
                  <View style={styles.time}>
                    <Text>{row.hours}</Text>
                    {row.duration ? <Text style={styles.duration}>{row.duration}</Text> : null}
                  </View>
                  <View style={styles.label}>
                    <Text style={styles.labelText}>{row.label}</Text>
                    {row.responsible ? <Text style={styles.responsible}>{row.responsible}</Text> : null}
                  </View>
                  <Text style={styles.location}>{row.location}</Text>
                  <Text style={styles.participants}>{row.participants}</Text>
                </View>
                {model.showNotes && row.note ? (
                  <View style={styles.note}>
                    {/* Un seul texte : le titre de la note ne reste jamais seul en bas de page. */}
                    <Text orphans={3} widows={2}>
                      <Text style={styles.noteLabel}>{`${noteLabel}\n`}</Text>
                      {row.note}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
