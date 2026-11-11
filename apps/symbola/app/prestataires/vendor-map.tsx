"use client";

// Lot 11 (L11-PRE-04 / L11-PRE-06, ADR 0031 § 7) — carte du carnet : MapLibre et
// PMTiles chargés seulement ici, fond de carte servi par l'app. Regroupement
// quand les points sont nombreux, cercle du rayon choisi. La liste à côté
// reste l'équivalent accessible de la carte. Lot 16 (L16-PRE-14) : la couleur et
// le pictogramme du point sont ceux de la famille (critère 1.4.1).
// En mode « choisir un point » (fiche), un clic place le point et remplit
// les champs latitude/longitude du formulaire.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { circlePolygon, FONT, mapStyle, type MapAssets } from "@/lib/map/style";
import { iconComponent } from "@/app/budget-line-icon";

export type MapPoint = { id: string; name: string; latitude: number; longitude: number; color: string; href: string; icon?: string | undefined };

// Pictogrammes rendus par React (cachés), puis passés à la carte en images.
async function addIconImages(map: import("maplibre-gl").Map, holder: HTMLElement | null): Promise<void> {
  for (const element of Array.from(holder?.querySelectorAll<HTMLElement>("[data-icon]") ?? [])) {
    const name = `vendor-icon-${element.dataset.icon}`;
    if (map.hasImage(name)) continue;
    const image = new Image(24, 24);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(element.innerHTML)}`;
    try {
      await image.decode();
      if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 });
    } catch {
      // Sans pictogramme, le point garde sa couleur ; la liste reste complète.
    }
  }
}

type Props = {
  points: MapPoint[];
  assets: MapAssets;
  label: string;
  missingTilesNotice: string;
  // Lot 15 (A11Y-01) : libellés des boutons de zoom (traductions de l'app) et
  // résumé textuel affiché sous la carte.
  controls: { zoomIn: string; zoomOut: string };
  summary?: string;
  around?: { latitude: number; longitude: number; radiusKm: number } | null;
  // Fiche : un clic déplace le point ; ids des champs à remplir.
  pick?: { latitudeInputId: string; longitudeInputId: string } | null;
};

// France métropolitaine, si rien d'autre ne cadre la carte.
const FRANCE: [[number, number], [number, number]] = [
  [-5.2, 41.3],
  [9.6, 51.1],
];

// Lot 13 (L13-PRE-12) : la liste annonce la fiche survolée par cet événement ;
// la carte met son repère en avant (et inversement).
export const VENDOR_HOVER_EVENT = "symbola:vendor-hover";

export function VendorMap({ points, assets, label, missingTilesNotice, controls, summary, around = null, pick = null }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const iconHolder = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const icons = [...new Set(points.map((point) => point.icon).filter((icon): icon is string => Boolean(icon)))];

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
        // MapLibre fait du canevas une région nommée ; les boutons restent à côté.
        locale: { "Map.Title": label, "NavigationControl.ZoomIn": controls.zoomIn, "NavigationControl.ZoomOut": controls.zoomOut },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      cleanup = () => {
        map.remove();
        maplibregl.removeProtocol("pmtiles");
      };

      map.on("load", async () => {
        await addIconImages(map, iconHolder.current);
        if (disposed) return;
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
              properties: { id: point.id, name: point.name, color: point.color, href: point.href, icon: point.icon ?? "" },
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
          paint: { "circle-color": ["get", "color"], "circle-radius": 10, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
        });
        // Lot 13 (L13-PRE-12) : repère de la fiche survolée dans la liste.
        map.addLayer({
          id: "vendor-highlight",
          type: "circle",
          source: "vendors",
          filter: ["==", ["get", "id"], ""],
          paint: { "circle-color": ["get", "color"], "circle-radius": 14, "circle-stroke-color": "#2b2623", "circle-stroke-width": 3 },
        });
        // Pictogramme au-dessus du point, même survolé.
        map.addLayer({
          id: "vendor-icons",
          type: "symbol",
          source: "vendors",
          filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "icon"], ""]],
          layout: { "icon-image": ["concat", "vendor-icon-", ["get", "icon"]], "icon-allow-overlap": true, "icon-ignore-placement": true },
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
            // Lot 13 (L13-PRE-12) : la fiche s'ouvre dans le panneau, la carte reste en place.
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
  }, [points, assets, around, pick, label, controls.zoomIn, controls.zoomOut]);

  return (
    <div className="vendor-map">
      <div ref={iconHolder} hidden aria-hidden="true">
        {icons.map((icon) => {
          const Icon = iconComponent(icon);
          return (
            <span key={icon} data-icon={icon}>
              <Icon size={24} strokeWidth={2.25} color="#ffffff" />
            </span>
          );
        })}
      </div>
      <div ref={container} className="vendor-map-canvas" />
      {summary ? <p className="vendor-map-summary">{summary}</p> : null}
      {!assets.tiles ? <p className="vendor-map-notice">{missingTilesNotice}</p> : null}
    </div>
  );
}
