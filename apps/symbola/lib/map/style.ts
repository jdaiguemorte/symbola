// Lot 11 (ADR 0031 § 7) — style du fond de carte (couches du schéma
// Protomaps) : présentation, pas une donnée métier. Sans fond installé, la
// carte n'a qu'un fond uni et les points du carnet.
import type { StyleSpecification } from "maplibre-gl";

export const FONT = "Noto Sans Regular";

export type MapAssets = { tiles: boolean; glyphs: boolean };

export function mapStyle(origin: string, assets: MapAssets): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": assets.tiles ? "#c9d8e3" : "#eef1ea" } }],
  };
  if (assets.glyphs) style.glyphs = `${origin}/carte/fonts/{fontstack}/{range}.pbf`;
  if (!assets.tiles) return style;
  style.sources.basemap = { type: "vector", url: `pmtiles://${origin}/carte/france.pmtiles`, attribution: "© OpenStreetMap, Protomaps" };
  style.layers.push(
    { id: "earth", type: "fill", source: "basemap", "source-layer": "earth", paint: { "fill-color": "#f2efe6" } },
    {
      id: "landuse-park",
      type: "fill",
      source: "basemap",
      "source-layer": "landuse",
      filter: ["in", ["get", "kind"], ["literal", ["park", "forest", "wood", "nature_reserve", "grass"]]],
      paint: { "fill-color": "#dfe8d6" },
    },
    { id: "water", type: "fill", source: "basemap", "source-layer": "water", paint: { "fill-color": "#c9d8e3" } },
    {
      id: "roads-minor",
      type: "line",
      source: "basemap",
      "source-layer": "roads",
      filter: ["in", ["get", "kind"], ["literal", ["minor_road", "other"]]],
      minzoom: 11,
      paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 4] },
    },
    {
      id: "roads-major",
      type: "line",
      source: "basemap",
      "source-layer": "roads",
      filter: ["in", ["get", "kind"], ["literal", ["major_road", "highway"]]],
      paint: { "line-color": "#f7dfb0", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 16, 7] },
    },
    {
      id: "boundaries",
      type: "line",
      source: "basemap",
      "source-layer": "boundaries",
      paint: { "line-color": "#a39c90", "line-width": 0.8, "line-dasharray": [3, 2] },
    },
  );
  if (assets.glyphs) {
    style.layers.push({
      id: "places",
      type: "symbol",
      source: "basemap",
      "source-layer": "places",
      filter: ["in", ["get", "kind"], ["literal", ["locality", "region"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name:fr"], ["get", "name"]],
        "text-font": [FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 14, 15],
      },
      paint: { "text-color": "#2a2723", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
    });
  }
  return style;
}

// Cercle de N km autour d'un point, en polygone (64 côtés) pour la carte.
export function circlePolygon(center: { latitude: number; longitude: number }, radiusKm: number): [number, number][] {
  const points: [number, number][] = [];
  const latRadius = radiusKm / 110.574;
  const lonRadius = radiusKm / (111.32 * Math.cos((center.latitude * Math.PI) / 180));
  for (let index = 0; index <= 64; index += 1) {
    const angle = (index / 64) * 2 * Math.PI;
    points.push([center.longitude + lonRadius * Math.cos(angle), center.latitude + latRadius * Math.sin(angle)]);
  }
  return points;
}
