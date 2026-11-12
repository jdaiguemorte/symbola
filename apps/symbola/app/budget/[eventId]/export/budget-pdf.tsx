// Lot 28c (BUD-10, décision D6) — rendu A4 paysage du budget (@react-pdf) :
// logo ou nom de l'organisation, en-têtes de colonnes à la couleur de ses
// documents, catégories et lignes avec leurs montants (HT sous le TTC pour un
// client professionnel), puis les échéances des prestataires. Le contenu vient
// de la route (déjà formaté) ; ce fichier ne fait que la mise en page.
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Locale } from "@symbola/i18n";
import type { DocumentLogo } from "@/lib/document-logo";
import { isDarkColor } from "@/lib/xlsx-workbook";

Font.registerHyphenationCallback((word) => [word]);

export type BudgetPdfRow = { kind: "category" | "line" | "total"; label: string; vendor: string; amounts: string[]; ht: string[] };

export type BudgetPdfModel = {
  language: Locale;
  organizationName: string;
  logo: DocumentLogo | null;
  color: string;
  title: string;
  heading: string;
  generated: string;
  mode: string;
  columns: string[];
  rows: BudgetPdfRow[];
  paymentsTitle: string;
  paymentColumns: string[];
  payments: string[][];
  noPayments: string;
  // AIDE-02 : « Document fictif » en filigrane sur un événement d'essai.
  watermark: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111111" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  logo: { maxWidth: 140, maxHeight: 50, objectFit: "contain" },
  organization: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  generated: { fontSize: 8, color: "#444444", textAlign: "right" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  heading: { fontSize: 11, marginBottom: 2 },
  mode: { fontSize: 8, color: "#444444", marginBottom: 10 },
  headRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 3 },
  headCell: { fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#BBBBBB", paddingVertical: 3, paddingHorizontal: 3 },
  category: { backgroundColor: "#F2F2F2", fontFamily: "Helvetica-Bold" },
  total: { borderTopWidth: 1, borderTopColor: "#111111", fontFamily: "Helvetica-Bold" },
  label: { width: "28%", paddingRight: 6 },
  amount: { width: "12%", textAlign: "right" },
  vendor: { fontSize: 8, color: "#444444" },
  ht: { fontSize: 7, color: "#444444", fontFamily: "Helvetica" },
  section: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  empty: { marginTop: 4 },
  watermark: {
    position: "absolute",
    top: 250,
    left: 160,
    fontSize: 64,
    fontFamily: "Helvetica-Bold",
    color: "#bbbbbb",
    opacity: 0.4,
    transform: "rotate(-25deg)",
  },
});

// Colonnes des échéances : prestataire, ligne, échéance, montant, date, statut, payée le.
const PAYMENT_WIDTHS = ["18%", "18%", "18%", "12%", "12%", "10%", "12%"];
const AMOUNT_COLUMN = 3;

function paymentCellStyle(column: number) {
  return [{ width: PAYMENT_WIDTHS[column]!, paddingRight: 4 }, ...(column === AMOUNT_COLUMN ? [{ textAlign: "right" as const }] : [])];
}

export function BudgetPdfDocument({ model }: { model: BudgetPdfModel }) {
  const headStyle = { backgroundColor: model.color, color: isDarkColor(model.color) ? "#FFFFFF" : "#111111" };
  return (
    <Document title={`${model.title} — ${model.heading}`} author={model.organizationName} language={model.language}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        {model.watermark ? (
          <Text style={styles.watermark} fixed>
            {model.watermark}
          </Text>
        ) : null}
        <View style={styles.header} fixed>
          {model.logo ? <Image style={styles.logo} src={{ data: model.logo.data, format: model.logo.format }} /> : <Text style={styles.organization}>{model.organizationName}</Text>}
          <Text style={styles.generated}>{model.generated}</Text>
        </View>
        <Text style={styles.title}>{model.title}</Text>
        <Text style={styles.heading}>{model.heading}</Text>
        <Text style={styles.mode}>{model.mode}</Text>

        <View style={[styles.headRow, headStyle]} fixed>
          {model.columns.map((column, index) => (
            <Text key={column} style={[styles.headCell, index === 0 ? styles.label : styles.amount]}>
              {column}
            </Text>
          ))}
        </View>
        {model.rows.map((row, index) => (
          <View key={index} style={[styles.row, ...(row.kind === "category" ? [styles.category] : []), ...(row.kind === "total" ? [styles.total] : [])]} wrap={false}>
            <View style={styles.label}>
              <Text>{row.label}</Text>
              {row.vendor ? <Text style={styles.vendor}>{row.vendor}</Text> : null}
            </View>
            {row.amounts.map((amount, column) => (
              <View key={column} style={styles.amount}>
                <Text>{amount}</Text>
                {row.ht[column] ? <Text style={styles.ht}>{row.ht[column]}</Text> : null}
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.section}>{model.paymentsTitle}</Text>
        {model.payments.length === 0 ? (
          <Text style={styles.empty}>{model.noPayments}</Text>
        ) : (
          <>
            <View style={[styles.headRow, headStyle]}>
              {model.paymentColumns.map((column, index) => (
                <Text key={column} style={[styles.headCell, ...paymentCellStyle(index)]}>
                  {column}
                </Text>
              ))}
            </View>
            {model.payments.map((payment, index) => (
              <View key={index} style={styles.row} wrap={false}>
                {payment.map((cell, column) => (
                  <Text key={column} style={paymentCellStyle(column)}>
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
