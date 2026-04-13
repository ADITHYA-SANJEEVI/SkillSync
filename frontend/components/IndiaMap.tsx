"use client";

import React from "react";

// Load Leaflet only in the browser to avoid SSR breakage
let L: typeof import("leaflet") | null = null;
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  L = require("leaflet");
}

type JobPin = {
  id: string | number;
  title?: string;
  company?: string;
  location_city?: string;
  location_lat?: number | string | null;
  location_lon?: number | string | null;
};

type Props = {
  jobs: JobPin[];
  flyTo?: [number, number] | null;
  layoutKey?: string | number;
  heightPx?: number; // default 520
};

export default function IndiaMap({
  jobs,
  flyTo = null,
  layoutKey,
  heightPx = 520,
}: Props) {
  const mapRef = React.useRef<import("leaflet").Map | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const markersRef = React.useRef<import("leaflet").LayerGroup | null>(null);

  const style: React.CSSProperties = {
    width: "100%",
    height: `${heightPx}px`,
    position: "relative",
    zIndex: 0,
  };

  // Init map once
  React.useEffect(() => {
    if (!L || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    // India default
    map.setView([22.9734, 78.6569], 4);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    const onResize = () => setTimeout(() => map.invalidateSize(), 0);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Draw markers on jobs change
  React.useEffect(() => {
    if (!L || !mapRef.current || !markersRef.current) return;
    const group = markersRef.current;
    group.clearLayers();

    const bounds: [number, number][] = [];
    for (const j of jobs || []) {
      const lat = j.location_lat != null ? Number(j.location_lat) : NaN;
      const lon = j.location_lon != null ? Number(j.location_lon) : NaN;
      if (!isFinite(lat) || !isFinite(lon)) continue;

      const label = `${j.title ?? "Job"}${j.company ? " · " + j.company : ""}${
        j.location_city ? " · " + j.location_city : ""
      }`;

      L.marker([lat, lon], { title: label })
        .bindPopup(
          `<strong>${esc(j.title ?? "Job")}</strong>${
            j.company ? " · " + esc(j.company) : ""
          }${j.location_city ? " · " + esc(j.location_city) : ""}`
        )
        .addTo(group);

      bounds.push([lat, lon]);
    }

    const map = mapRef.current;
    setTimeout(() => {
      map.invalidateSize();
      if (bounds.length) {
        map.fitBounds(L!.latLngBounds(bounds as any).pad(0.25), {
          animate: true,
        });
      }
    }, 0);
  }, [jobs]);

  // Reflow when layout shifts (drawers/sidebars)
  React.useEffect(() => {
    if (!mapRef.current) return;
    setTimeout(() => mapRef.current!.invalidateSize(), 0);
  }, [layoutKey]);

  // Optional city glide
  React.useEffect(() => {
    if (!mapRef.current || !flyTo) return;
    const [lat, lon] = flyTo;
    if (isFinite(lat) && isFinite(lon)) {
      setTimeout(() => mapRef.current!.flyTo([lat, lon], 10, { duration: 0.9 }), 0);
    }
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden"
      style={style}
    />
  );
}

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
