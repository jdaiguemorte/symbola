// DEV-01, lot 17 (DEV-12, ADR 0046) — rendu A4 des devis, factures et avoirs
// (@react-pdf/renderer, ADR 0019). Le contenu vient des constructeurs de
// modèle ; ce fichier ne fait que la mise en page, aux couleurs et dans la
// police du document (Helvetica ou Times, incluses dans le moteur PDF).
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { DOCUMENT_INK } from "@/lib/documents/appearance";
import type { QuotePdfModel } from "./quote-pdf-model";

Font.registerHyphenationCallback((word) => [word]);

const MUTED = "#6b625b";
const LINE = "#e6ded3";
const ROW_LINE = "#ece6de";
const ZEBRA = "#fbf9f6";

const FONTS = {
  modern: { regular: "Helvetica", bold: "Helvetica-Bold", size: 9.5 },
  classic: { regular: "Times-Roman", bold: "Times-Bold", size: 10.5 },
} as const;

const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingHorizontal: 38, paddingBottom: 74, color: DOCUMENT_INK, lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, paddingBottom: 12, marginBottom: 14 },
  logo: { height: 54, maxWidth: 170, objectFit: "contain" },
  headerName: { fontSize: 14 },
  titleBlock: { alignItems: "flex-end", maxWidth: "55%" },
  kind: { fontSize: 20, lineHeight: 1.1, letterSpacing: 1.2, textTransform: "uppercase" },
  number: { fontSize: 11, lineHeight: 1.2, marginTop: 4 },
  subtitle: { color: MUTED, textAlign: "right" },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  party: { width: "48.5%", borderRadius: 6, paddingVertical: 9, paddingHorizontal: 11 },
  label: { fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  dates: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  date: { marginRight: 20 },
  dateLabel: { fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: MUTED },
  intro: { marginBottom: 12, color: "#3a3430" },
  headRow: { flexDirection: "row", borderBottomWidth: 1, paddingBottom: 4 },
  headCell: { fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: ROW_LINE, paddingVertical: 5 },
  description: { fontSize: 8.5, color: MUTED },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14 },
  payment: { flexGrow: 1, flexBasis: 0, marginRight: 14, borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingVertical: 9, paddingHorizontal: 11 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between" },
  paymentLabel: { flexGrow: 1, flexBasis: 0, marginRight: 8 },
  paymentAmount: { flexShrink: 0 },
  totals: { width: 210, marginLeft: "auto" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  band: { flexDirection: "row", justifyContent: "space-between", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 9, marginTop: 4, fontSize: 11 },
  mentions: { marginTop: 14, color: "#4a433e" },
  signatureTitle: { marginTop: 22 },
  signature: { marginTop: 4, flexDirection: "row", flexWrap: "wrap" },
  signatureSlot: { width: "48%", marginRight: "2%", marginTop: 8, height: 80, borderWidth: 0.5, borderColor: "#999999", borderRadius: 4, padding: 6 },
  signatureTag: { fontSize: 8, color: "#ffffff" },
  footer: { position: "absolute", bottom: 22, left: 38, right: 38, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 7, paddingRight: 60 },
  footerText: { fontSize: 7.5, color: MUTED },
  // Placé par le haut (A4 : 841,89 pt) : avec « bottom », le moteur PDF met ce
  // texte calculé à chaque page hors de la page.
  pageNumber: { position: "absolute", top: 800, left: 38, right: 38, textAlign: "right", fontSize: 7.5, color: MUTED },
  watermark: {
    position: "absolute",
    top: 380,
    left: 60,
    fontSize: 64,
    color: "#bbbbbb",
    opacity: 0.4,
    transform: "rotate(-35deg)",
  },
});

// Largeurs : la désignation prend la place laissée par les colonnes chiffrées.
function columnWidths(count: number): string[] {
  const numeric = count === 6 ? ["11%", "17%", "10%", "9%", "14%"] : ["12%", "19%", "11%", "15%"];
  const used = numeric.reduce((sum, width) => sum + Number.parseInt(width, 10), 0);
  return [`${100 - used}%`, ...numeric];
}

export function pageLabel(template: string, page: number, total: number): string {
  return template.replace("{page}", String(page)).replace("{total}", String(total));
}

export function QuotePdfDocument({ model }: { model: QuotePdfModel }) {
  const widths = columnWidths(model.columns.length);
  const { accent, onAccent, tint } = model.appearance;
  const font = FONTS[model.appearance.font];
  const bold = { fontFamily: font.bold };
  const lastStrong = model.totals.map((total) => Boolean(total.strong)).lastIndexOf(true);
  const mentions = [model.legalMention, ...model.professional, model.terms].filter((text): text is string => Boolean(text));
  return (
    <Document title={model.title} author={model.seller.name} language={model.language}>
      <Page size="A4" style={[styles.page, { fontFamily: font.regular, fontSize: font.size }]} wrap>
        {model.watermark ? (
          <Text style={[styles.watermark, bold]} fixed>
            {model.watermark}
          </Text>
        ) : null}

        <View style={[styles.header, { borderBottomColor: accent }]}>
          <View>
            {model.logo ? (
              <Image style={styles.logo} src={{ data: model.logo.data, format: model.logo.format }} />
            ) : (
              <Text style={[styles.headerName, bold]}>{model.seller.name}</Text>
            )}
          </View>
          <View style={styles.titleBlock}>
            <Text style={[styles.kind, bold, { color: accent }]}>{model.kind}</Text>
            <Text style={[styles.number, bold]}>{model.number}</Text>
            {model.subtitle ? <Text style={styles.subtitle}>{model.subtitle}</Text> : null}
          </View>
        </View>

        <View style={styles.parties}>
          {[model.seller, model.client].map((party, index) => (
            <View key={party.heading} style={[styles.party, { backgroundColor: tint }]}>
              <Text style={[styles.label, bold, { color: accent }]}>{party.heading}</Text>
              {index === 0 ? <Text style={bold}>{model.seller.name}</Text> : null}
              {party.lines.map((line, lineIndex) => (
                <Text key={`${lineIndex}-${line}`} style={index === 1 && lineIndex === 0 ? bold : {}}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {model.dates.length > 0 ? (
          <View style={styles.dates}>
            {model.dates.map((date) => (
              <View key={date.label} style={styles.date}>
                <Text style={[styles.dateLabel, bold]}>{date.label}</Text>
                <Text>{date.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {model.intro ? <Text style={styles.intro}>{model.intro}</Text> : null}

        <View>
          <View style={[styles.headRow, { borderBottomColor: accent }]} fixed>
            {model.columns.map((column, index) => (
              <Text key={column} style={[styles.headCell, bold, { color: accent, width: widths[index]!, textAlign: index === 0 ? "left" : "right", paddingRight: 4 }]}>
                {column}
              </Text>
            ))}
          </View>
          {model.rows.map((row, rowIndex) =>
            row.kind === "section" ? (
              <View key={rowIndex} style={[styles.row, { borderBottomColor: accent }]} wrap={false}>
                <Text style={[bold, { color: accent, paddingLeft: 2 }]}>{row.cells[0]}</Text>
              </View>
            ) : (
            <View key={rowIndex} style={[styles.row, rowIndex % 2 === 1 ? { backgroundColor: ZEBRA } : {}, row.kind === "subtotal" ? bold : {}]} wrap={false}>
              {row.cells.map((cell, index) => (
                <View key={index} style={{ width: widths[index]!, paddingRight: 4, paddingLeft: index === 0 ? 2 : 0 }}>
                  <Text style={{ textAlign: index === 0 ? "left" : "right" }}>{cell}</Text>
                  {index === 0 && row.description ? <Text style={styles.description}>{row.description}</Text> : null}
                </View>
              ))}
            </View>
            ),
          )}
        </View>

        <View style={styles.bottom} wrap={false}>
          {model.payment ? (
            <View style={styles.payment}>
              <Text style={[styles.label, bold, { color: accent }]}>{model.payment.title}</Text>
              {model.payment.lines.map((line) =>
                line.amount ? (
                  <View key={line.label} style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>{line.label}</Text>
                    <Text style={styles.paymentAmount}>{line.amount}</Text>
                  </View>
                ) : (
                  <Text key={line.label}>{line.label}</Text>
                ),
              )}
            </View>
          ) : null}
          <View style={styles.totals}>
            {model.totals.map((total, index) =>
              index === lastStrong ? (
                <View key={total.label} style={[styles.band, bold, { backgroundColor: accent, color: onAccent }]}>
                  <Text>{total.label}</Text>
                  <Text>{total.value}</Text>
                </View>
              ) : (
                <View key={total.label} style={styles.totalRow}>
                  <Text style={total.strong ? bold : {}}>{total.label}</Text>
                  <Text style={total.strong ? bold : {}}>{total.value}</Text>
                </View>
              ),
            )}
          </View>
        </View>

        {mentions.length > 0 ? <Text style={styles.mentions}>{mentions.join("\n")}</Text> : null}
        {/* Lot 31a (JUR-09) : conditions générales de vente, après les mentions. */}
        {model.generalTerms ? (
          <View style={styles.mentions}>
            <Text style={[bold, { color: accent }]}>{model.generalTerms.title}</Text>
            <Text>{model.generalTerms.text}</Text>
          </View>
        ) : null}

        {model.signature ? (
          <View wrap={false}>
            <Text style={[styles.signatureTitle, bold, { color: accent }]}>{model.signature.title}</Text>
            <View style={styles.signature}>
              {model.signature.slots.map((slot) => (
                <View key={slot.role} style={styles.signatureSlot}>
                  <Text>{slot.role}</Text>
                  {/* Balise lue par le fournisseur de signature (zone de signature). */}
                  <Text style={styles.signatureTag}>{slot.tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{[model.footer.text, model.footer.legal].filter(Boolean).join("\n")}</Text>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => pageLabel(model.footer.page, pageNumber, totalPages)} fixed />
      </Page>
    </Document>
  );
}
