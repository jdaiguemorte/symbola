// Lot 60 (L60-PLA-02, L60-PLA-05 ; D2, D3) — le dessin d'un plan de salle en SVG, à l'échelle (une
// unité = un centimètre) : contour de l'espace, fond de plan, grille, installations fixes, liaisons
// aux prises en pointillé, éléments. Sans état ni effet : servi tel quel aux pages du prestataire et
// du client, et repris par l'éditeur, qui y branche ses gestes (elementProps). Les couleurs sont
// les jetons de DESIGN.md (classes de globals.css) ; le texte reste lisible imprimé en noir et blanc.
import type { ReactNode, SVGProps } from "react";
import type { FloorplanColor, FloorplanFixtureKind, FloorplanShape } from "@symbola/contracts";

export type DrawnElement = {
  id: string;
  shape: FloorplanShape;
  label: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  rotationDeg: number;
  color: FloorplanColor | null;
  fixtureId: string | null;
  highlighted?: boolean;
  selected?: boolean;
  flagged?: boolean;
};

export type DrawnFixture = { id: string; kind: FloorplanFixtureKind; label: string; mark: string; xCm: number; yCm: number; widthCm: number; depthCm: number; rotationDeg: number; selected?: boolean };

export type PlanDrawingProps = {
  widthCm: number;
  depthCm: number;
  title: string;
  background?: { href: string; widthCm: number; heightCm: number } | null;
  gridCm?: number | null;
  fixtures: DrawnFixture[];
  elements: DrawnElement[];
  // Gestes de l'éditeur (pointeur, clavier) sur un élément ou une installation.
  elementProps?: (id: string) => SVGProps<SVGGElement>;
  fixtureProps?: (id: string) => SVGProps<SVGGElement>;
  svgProps?: SVGProps<SVGSVGElement>;
  // Poignées de l'élément sélectionné (rotation, taille), dessinées par-dessus.
  overlay?: ReactNode;
  fixturesInteractive?: boolean;
};

function Outline({ shape, widthCm, depthCm, className }: { shape: FloorplanShape; widthCm: number; depthCm: number; className: string }) {
  if (shape === "rect") return <rect x={-widthCm / 2} y={-depthCm / 2} width={widthCm} height={depthCm} className={className} />;
  return <ellipse cx={0} cy={0} rx={widthCm / 2} ry={depthCm / 2} className={className} />;
}

export function PlanDrawing(props: PlanDrawingProps) {
  const { widthCm, depthCm } = props;
  const font = Math.max(18, Math.min(60, Math.round(Math.max(widthCm, depthCm) / 70)));
  const fixtureById = new Map(props.fixtures.map((fixture) => [fixture.id, fixture]));
  const margin = Math.round(Math.max(widthCm, depthCm) * 0.02);
  return (
    <svg
      viewBox={`${-margin} ${-margin} ${widthCm + 2 * margin} ${depthCm + 2 * margin}`}
      className="plan-svg"
      role="group"
      aria-label={props.title}
      {...props.svgProps}
    >
      <rect x={0} y={0} width={widthCm} height={depthCm} className="plan-space" />
      {props.background ? <image href={props.background.href} x={0} y={0} width={props.background.widthCm} height={props.background.heightCm} preserveAspectRatio="none" className="plan-background" aria-hidden="true" /> : null}
      {props.gridCm ? (
        <g aria-hidden="true" className="plan-grid">
          {Array.from({ length: Math.floor(widthCm / props.gridCm) }, (_, index) => (
            <line key={`x${index}`} x1={(index + 1) * props.gridCm!} y1={0} x2={(index + 1) * props.gridCm!} y2={depthCm} />
          ))}
          {Array.from({ length: Math.floor(depthCm / props.gridCm) }, (_, index) => (
            <line key={`y${index}`} x1={0} y1={(index + 1) * props.gridCm!} x2={widthCm} y2={(index + 1) * props.gridCm!} />
          ))}
        </g>
      ) : null}
      <g aria-hidden="true" className="plan-links">
        {props.elements.map((element) => {
          const fixture = element.fixtureId ? fixtureById.get(element.fixtureId) : undefined;
          return fixture ? <line key={`link-${element.id}`} x1={element.xCm} y1={element.yCm} x2={fixture.xCm} y2={fixture.yCm} /> : null;
        })}
      </g>
      <g className="plan-fixtures" {...(props.fixturesInteractive ? {} : { "aria-hidden": true })}>
        {props.fixtures.map((fixture) => (
          <g
            key={fixture.id}
            transform={`translate(${fixture.xCm} ${fixture.yCm}) rotate(${fixture.rotationDeg})`}
            className={`plan-fixture plan-fixture--${fixture.kind}${fixture.selected ? " is-selected" : ""}`}
            {...props.fixtureProps?.(fixture.id)}
          >
            <Outline shape="rect" widthCm={fixture.widthCm} depthCm={fixture.depthCm} className="plan-fixture-shape" />
            {fixture.mark ? (
              <text x={0} y={font / 3} fontSize={font} textAnchor="middle" className="plan-fixture-mark">
                {fixture.mark}
              </text>
            ) : null}
          </g>
        ))}
      </g>
      <g className="plan-elements">
        {props.elements.map((element) => (
          <g
            key={element.id}
            transform={`translate(${element.xCm} ${element.yCm}) rotate(${element.rotationDeg})`}
            className={`plan-element plan-element--${element.color ?? "surface"}${element.highlighted ? " is-mine" : ""}${element.selected ? " is-selected" : ""}${element.flagged ? " is-flagged" : ""}`}
            {...props.elementProps?.(element.id)}
          >
            <Outline shape={element.shape} widthCm={element.widthCm} depthCm={element.depthCm} className="plan-element-shape" />
            <text x={0} y={font / 3} fontSize={font} textAnchor="middle" className="plan-element-label">
              {element.label}
            </text>
          </g>
        ))}
      </g>
      {props.overlay}
    </svg>
  );
}
