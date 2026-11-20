// Lot 60 (L60-PLA-05 ; ADR 0019) — le plan de salle en PDF, A4 paysage, lisible imprimé en noir et
// blanc : une page de plan à une échelle normalisée (1:50, 1:100…) avec son cartouche (lieu, espace,
// échelle, date, version) et une barre d'échelle, puis le tableau des éléments et le tableau
// « Électricité », avec le rappel que ce n'est pas une étude électrique. Rendu côté serveur, à la
// demande ; textes venus des traductions.
import { Document, G, Image, Line, Page, Rect, Ellipse, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { FloorplanFixtureKind, FloorplanPowerRow, FloorplanShape } from "@symbola/contracts";

export type PdfItem = {
  id: string;
  label: string;
  detail: string;
  shape: FloorplanShape;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  rotationDeg: number;
  highlighted: boolean;
  fixtureId: string | null;
};

export type PdfFixture = { id: string; kind: FloorplanFixtureKind; label: string; xCm: number; yCm: number; widthCm: number; depthCm: number; rotationDeg: number };

export type FloorplanPdfData = {
  widthCm: number;
  depthCm: number;
  scale: number;
  // Fond de plan PNG ou JPEG, à sa taille dans l'espace (un WebP n'est pas repris dans le PDF).
  background: { data: Buffer; format: "png" | "jpg"; widthCm: number; heightCm: number } | null;
  elements: PdfItem[];
  fixtures: PdfFixture[];
  power: (FloorplanPowerRow & { labelText: string; plugged: string })[];
};

export type FloorplanPdfLabels = {
  title: string;
  cartouche: { venue: string; space: string; layout: string; scale: string; date: string; version: string };
  scaleBar: string;
  backgroundOmitted: string | null;
  elementsTitle: string;
  columns: { element: string; detail: string; position: string; size: string; seats: string; power: string };
  row: { position: (item: PdfItem) => string; size: (item: PdfItem) => string; seats: (item: PdfItem) => string; power: (item: PdfItem) => string };
  powerTitle: string;
  powerColumns: { outlet: string; capacity: string; used: string; plugged: string };
  powerCapacity: (row: FloorplanPowerRow) => string;
  powerUsed: (row: FloorplanPowerRow) => string;
  noPower: string;
  disclaimer: string;
  footer: string;
  page: (page: number, total: number) => string;
};

const PT_PER_MM = 72 / 25.4;
const MARGIN = 28;
export const PDF_AREA_MM = { width: (842 - 2 * MARGIN) / PT_PER_MM, height: (595 - 2 * MARGIN - 78) / PT_PER_MM };

const styles = StyleSheet.create({
  page: { padding: MARGIN, fontSize: 9, fontFamily: "Helvetica", color: "#111111" },
  cartouche: { flexDirection: "row", borderWidth: 1, borderColor: "#111111", marginBottom: 8 },
  cell: { paddingVertical: 3, paddingHorizontal: 5, borderRightWidth: 0.5, borderRightColor: "#111111", flexGrow: 1 },
  cellLabel: { fontSize: 7, color: "#444444" },
  cellValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  note: { fontSize: 8, color: "#444444", marginTop: 4 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 2 },
  head: { fontFamily: "Helvetica-Bold" },
  disclaimer: { marginTop: 8, padding: 5, borderWidth: 1, borderColor: "#111111", fontSize: 8 },
  footer: { position: "absolute", bottom: 12, left: MARGIN, right: MARGIN, fontSize: 7, color: "#444444", flexDirection: "row", justifyContent: "space-between" },
});

const FIXTURE_MARK: Record<FloorplanFixtureKind, string> = { outlet: "P", water: "E", door: "", emergency_exit: "S", delivery: "L", pillar: "", stage: "" };

function Shape({ shape, widthCm, depthCm, fill, stroke, strokeWidth, dash }: { shape: FloorplanShape; widthCm: number; depthCm: number; fill: string; stroke: string; strokeWidth: number; dash?: string }) {
  if (shape === "rect") return <Rect x={-widthCm / 2} y={-depthCm / 2} width={widthCm} height={depthCm} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...(dash ? { strokeDasharray: dash } : {})} />;
  return <Ellipse cx={0} cy={0} rx={widthCm / 2} ry={depthCm / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} {...(dash ? { strokeDasharray: dash } : {})} />;
}

export function FloorplanPdf({ data, labels }: { data: FloorplanPdfData; labels: FloorplanPdfLabels }) {
  const ptPerCm = (10 / data.scale) * PT_PER_MM;
  const width = data.widthCm * ptPerCm;
  const height = data.depthCm * ptPerCm;
  const unit = 1 / ptPerCm;
  const font = 6.5 * unit;
  const fixtureById = new Map(data.fixtures.map((fixture) => [fixture.id, fixture]));
  // Barre d'échelle : 1, 2, 5 ou 10 m selon l'échelle.
  const barM = data.scale <= 50 ? 1 : data.scale <= 100 ? 2 : data.scale <= 250 ? 5 : 10;
  const footer = (
    <View style={styles.footer} fixed>
      <Text>{labels.footer}</Text>
      <Text render={({ pageNumber, totalPages }) => labels.page(pageNumber, totalPages)} />
    </View>
  );
  return (
    <Document title={labels.title}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.cartouche}>
          {Object.values(labels.cartouche).map((value, index) => (
            <View key={index} style={styles.cell}>
              <Text style={styles.cellValue}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={{ width, height, position: "relative" }}>
          {data.background ? <Image src={{ data: data.background.data, format: data.background.format }} style={{ position: "absolute", left: 0, top: 0, width: data.background.widthCm * ptPerCm, height: data.background.heightCm * ptPerCm, opacity: 0.35 }} /> : null}
          <Svg width={width} height={height} viewBox={`0 0 ${data.widthCm} ${data.depthCm}`} style={{ position: "absolute", left: 0, top: 0 }}>
            <Rect x={0} y={0} width={data.widthCm} height={data.depthCm} fill="none" stroke="#111111" strokeWidth={1.2 * unit} />
            {data.elements
              .filter((item) => item.fixtureId && fixtureById.has(item.fixtureId))
              .map((item) => {
                const fixture = fixtureById.get(item.fixtureId!)!;
                return <Line key={`l-${item.id}`} x1={item.xCm} y1={item.yCm} x2={fixture.xCm} y2={fixture.yCm} stroke="#444444" strokeWidth={0.6 * unit} strokeDasharray={`${3 * unit} ${2 * unit}`} />;
              })}
            {data.fixtures.map((fixture) => (
              <G key={fixture.id} transform={`translate(${fixture.xCm} ${fixture.yCm}) rotate(${fixture.rotationDeg})`}>
                <Shape shape="rect" widthCm={fixture.widthCm} depthCm={fixture.depthCm} fill={fixture.kind === "pillar" ? "#999999" : "#FFFFFF"} stroke="#111111" strokeWidth={0.8 * unit} {...(fixture.kind === "emergency_exit" ? { dash: `${2 * unit} ${1 * unit}` } : {})} />
                {FIXTURE_MARK[fixture.kind] ? (
                  <Text x={0} y={font / 3} style={{ fontSize: font, fontFamily: "Helvetica-Bold" }} textAnchor="middle">
                    {FIXTURE_MARK[fixture.kind]}
                  </Text>
                ) : null}
              </G>
            ))}
            {data.elements.map((item) => (
              <G key={item.id} transform={`translate(${item.xCm} ${item.yCm}) rotate(${item.rotationDeg})`}>
                <Shape shape={item.shape} widthCm={item.widthCm} depthCm={item.depthCm} fill={item.highlighted ? "#D9D9D9" : "#FFFFFF"} stroke="#111111" strokeWidth={(item.highlighted ? 2.2 : 0.8) * unit} />
                <Text x={0} y={font / 3} style={{ fontSize: font }} textAnchor="middle">
                  {item.label}
                </Text>
              </G>
            ))}
          </Svg>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
          <View style={{ width: barM * 100 * ptPerCm, height: 4, backgroundColor: "#111111", marginRight: 6 }} />
          <Text>{labels.scaleBar.replace("{m}", String(barM))}</Text>
        </View>
        {labels.backgroundOmitted ? <Text style={styles.note}>{labels.backgroundOmitted}</Text> : null}
        {footer}
      </Page>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{labels.elementsTitle}</Text>
        <View style={[styles.row, styles.head]}>
          <Text style={{ width: "22%" }}>{labels.columns.element}</Text>
          <Text style={{ width: "22%" }}>{labels.columns.detail}</Text>
          <Text style={{ width: "16%" }}>{labels.columns.position}</Text>
          <Text style={{ width: "14%" }}>{labels.columns.size}</Text>
          <Text style={{ width: "8%" }}>{labels.columns.seats}</Text>
          <Text style={{ width: "18%" }}>{labels.columns.power}</Text>
        </View>
        {data.elements.map((item) => {
          const row = labels.row;
          return (
            <View key={item.id} style={styles.row} wrap={false}>
              <Text style={{ width: "22%", fontFamily: item.highlighted ? "Helvetica-Bold" : "Helvetica" }}>{item.label}</Text>
              <Text style={{ width: "22%" }}>{item.detail}</Text>
              <Text style={{ width: "16%" }}>{row.position(item)}</Text>
              <Text style={{ width: "14%" }}>{row.size(item)}</Text>
              <Text style={{ width: "8%" }}>{row.seats(item)}</Text>
              <Text style={{ width: "18%" }}>{row.power(item)}</Text>
            </View>
          );
        })}
        <Text style={styles.sectionTitle}>{labels.powerTitle}</Text>
        {data.power.length === 0 ? (
          <Text>{labels.noPower}</Text>
        ) : (
          <View>
            <View style={[styles.row, styles.head]}>
              <Text style={{ width: "25%" }}>{labels.powerColumns.outlet}</Text>
              <Text style={{ width: "20%" }}>{labels.powerColumns.capacity}</Text>
              <Text style={{ width: "15%" }}>{labels.powerColumns.used}</Text>
              <Text style={{ width: "40%" }}>{labels.powerColumns.plugged}</Text>
            </View>
            {data.power.map((row) => (
              <View key={row.fixtureId} style={styles.row} wrap={false}>
                <Text style={{ width: "25%" }}>{row.labelText}</Text>
                <Text style={{ width: "20%" }}>{labels.powerCapacity(row)}</Text>
                <Text style={{ width: "15%", fontFamily: row.overloaded ? "Helvetica-Bold" : "Helvetica" }}>{labels.powerUsed(row)}</Text>
                <Text style={{ width: "40%" }}>{row.plugged}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.disclaimer}>{labels.disclaimer}</Text>
        {footer}
      </Page>
    </Document>
  );
}
