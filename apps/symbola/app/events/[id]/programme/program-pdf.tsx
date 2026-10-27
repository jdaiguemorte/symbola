// EVT-05 — rendu A4 du programme du jour J (@react-pdf/renderer). Le
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
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 5 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 4 },
  headCell: { fontFamily: "Helvetica-Bold" },
  time: { width: "14%" },
  label: { width: "26%", paddingRight: 6 },
  location: { width: "20%", paddingRight: 6 },
  participants: { width: "20%", paddingRight: 6 },
  note: { width: "20%" },
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

const WIDE = { label: "32%", location: "26%", participants: "28%" };

export function ProgramPdfDocument({ model }: { model: ProgramPdfModel }) {
  // Sans colonne de notes, les autres colonnes se partagent la largeur.
  const columnStyles = model.showNotes
    ? [styles.time, styles.label, styles.location, styles.participants, styles.note]
    : [styles.time, { width: WIDE.label, paddingRight: 6 }, { width: WIDE.location, paddingRight: 6 }, { width: WIDE.participants }];

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
          {model.columns.map((column, index) => (
            <Text key={column} style={[styles.headCell, columnStyles[index]!]}>
              {column}
            </Text>
          ))}
        </View>
        {model.rows.length === 0 ? <Text style={styles.empty}>{model.empty}</Text> : null}
        {model.rows.map((row, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={columnStyles[0]!}>{row.time}</Text>
            <Text style={columnStyles[1]!}>{row.label}</Text>
            <Text style={columnStyles[2]!}>{row.location}</Text>
            <Text style={columnStyles[3]!}>{row.participants}</Text>
            {model.showNotes ? <Text style={columnStyles[4]!}>{row.note ?? ""}</Text> : null}
          </View>
        ))}
      </Page>
    </Document>
  );
}
