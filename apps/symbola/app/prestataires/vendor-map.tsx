"use client";

// Lot 11 (PRE-04 / PRE-06, ADR 0031 § 7) — carte du carnet : MapLibre et
// PMTiles chargés seulement ici, fond de carte servi par l'app. Une couleur
// par type, regroupement quand les points sont nombreux, cercle du rayon
// choisi. La liste à côté reste l'équivalent accessible de la carte.
// En mode « choisir un point » (fiche), un clic place le point et remplit
// les champs latitude/longitude du formulaire.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { circlePolygon, FONT, mapStyle, type MapAssets } from "@/lib/map/style";

export type MapPoint = { id: string; name: string; latitude: number; longitude: number; color: string; href: string };

type Props = {
  points: MapPoint[];
  assets: MapAssets;
  label: string;
  missingTilesNotice: string;
  around?: { latitude: number; longitude: number; radiusKm: number } | null;
  // Fiche : un clic déplace le point ; ids des champs à remplir.
  pick?: { latitudeInputId: string; longitudeInputId: string } | null;
};

// France métropolitaine, si rien d'autre ne cadre la carte.
const FRANCE: [[number, number], [number, number]] = [
  [-5.2, 41.3],
  [9.6, 51.1],
];

// Lot 13 (PRE-12) : la liste annonce la fiche survolée par cet événement ;
// la carte met son repère en avant (et inversement).
export const VENDOR_HOVER_EVENT = "symbola:vendor-hover";

export function VendorMap({ points, assets, label, missingTilesNotice, around = null, pick = null }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const [maplibregl, { Protocol }] = await Promise.all([import("maplibre-gl"), import("pmtiles")]);
      if (disposed || !container.current) return;
      maplibregl.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.js`);
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      const map = new maplibregl.Map({
        container: container.current,
        style: mapStyle(window.location.origin, assets),
        bounds: FRANCE,
        attributionControl: assets.tiles ? { compact: true } : false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      cleanup = () => {
        map.remove();
        maplibregl.removeProtocol("pmtiles");
      };

      map.on("load", () => {
        if (around) {
          map.addSource("around", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circlePolygon(around, around.radiusKm)] } },
          });
          map.addLayer({ id: "around-fill", type: "fill", source: "around", paint: { "fill-color": "#4f6b5a", "fill-opacity": 0.08 } });
          map.addLayer({ id: "around-line", type: "line", source: "around", paint: { "line-color": "#4f6b5a", "line-width": 2, "line-dasharray": [3, 2] } });
        }
        map.addSource("vendors", {
          type: "geojson",
          cluster: !pick,
          clusterRadius: 40,
          data: {
            type: "FeatureCollection",
            features: points.map((point) => ({
              type: "Feature",
              properties: { id: point.id, name: point.name, color: point.color, href: point.href },
              geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
            })),
          },
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "vendors",
          filter: ["has", "point_count"],
          paint: { "circle-color": "#5e5a52", "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 24], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
        });
        if (assets.glyphs) {
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "vendors",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": [FONT], "text-size": 12 },
            paint: { "text-color": "#ffffff" },
          });
        }
        map.addLayer({
          id: "vendor-points",
          type: "circle",
          source: "vendors",
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-color": ["get", "color"], "circle-radius": 8, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
        });
        // Lot 13 (PRE-12) : repère de la fiche survolée dans la liste.
        map.addLayer({
          id: "vendor-highlight",
          type: "circle",
          source: "vendors",
          filter: ["==", ["get", "id"], ""],
          paint: { "circle-color": ["get", "color"], "circle-radius": 13, "circle-stroke-color": "#2b2623", "circle-stroke-width": 3 },
        });
        const onHover = (event: Event) => {
          const id = (event as CustomEvent<string | null>).detail ?? "";
          if (map.getLayer("vendor-highlight")) map.setFilter("vendor-highlight", ["==", ["get", "id"], id]);
        };
        window.addEventListener(VENDOR_HOVER_EVENT, onHover);
        const previousCleanup = cleanup;
        cleanup = () => {
          window.removeEventListener(VENDOR_HOVER_EVENT, onHover);
          previousCleanup?.();
        };
        map.on("click", "clusters", async (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          const source = map.getSource("vendors");
          if (!feature || !source || source.type !== "geojson") return;
          const zoom = await (source as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties?.cluster_id));
          map.easeTo({ center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom });
        });
        if (!pick) {
          map.on("click", "vendor-points", (event: MapLayerMouseEvent) => {
            const href = event.features?.[0]?.properties?.href;
            // Lot 13 (PRE-12) : la fiche s'ouvre dans le panneau, la carte reste en place.
            if (typeof href === "string" && href.startsWith("/prestataires")) router.push(href, { scroll: false });
          });
          map.on("mouseenter", "vendor-points", (event: MapLayerMouseEvent) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") window.dispatchEvent(new CustomEvent(VENDOR_HOVER_EVENT, { detail: id }));
          });
          map.on("mouseleave", "vendor-points", () => window.dispatchEvent(new CustomEvent(VENDOR_HOVER_EVENT, { detail: null })));
          for (const layer of ["clusters", "vendor-points"]) {
            map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
          }
        } else {
          map.on("click", (event: MapMouseEvent) => {
            const latitude = document.getElementById(pick.latitudeInputId) as HTMLInputElement | null;
            const longitude = document.getElementById(pick.longitudeInputId) as HTMLInputElement | null;
            if (latitude) latitude.value = event.lngLat.lat.toFixed(6);
            if (longitude) longitude.value = event.lngLat.lng.toFixed(6);
            const source = map.getSource("vendors");
            if (source && source.type === "geojson") {
              (source as GeoJSONSource).setData({
                type: "FeatureCollection",
                features: [{ type: "Feature", properties: { color: "#a8553a" }, geometry: { type: "Point", coordinates: [event.lngLat.lng, event.lngLat.lat] } }],
              });
            }
          });
        }
        // Cadrage : le cercle, sinon les points, sinon la France.
        const coordinates: [number, number][] = around
          ? circlePolygon(around, around.radiusKm)
          : points.map((point) => [point.longitude, point.latitude]);
        if (coordinates.length > 0) {
          const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
          for (const coordinate of coordinates) bounds.extend(coordinate);
          map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
        }
      });
    })();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [points, assets, around, pick]);

  return (
    <div className="vendor-map">
      <div ref={container} className="vendor-map-canvas" role="img" aria-label={label} />
      {!assets.tiles ? <p className="vendor-map-notice">{missingTilesNotice}</p> : null}
    </div>
  );
}
