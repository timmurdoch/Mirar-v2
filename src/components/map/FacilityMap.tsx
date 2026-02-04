'use client';

import type { Facility, FilterConfig, TooltipConfig } from '@/types/database';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

interface FacilityMapProps {
  facilities: Facility[];
  tooltipConfig: TooltipConfig[];
  auditData?: Record<string, Record<string, string>>;
  onFacilityClick?: (facility: Facility) => void;
  selectedFacilityId?: string | null;
}

export function FacilityMap({
  facilities,
  tooltipConfig,
  auditData = {},
  onFacilityClick,
  selectedFacilityId,
}: FacilityMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popup = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [134.0, -25.0], // Center of Australia
      zoom: 4,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when facilities change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();

    // Create new markers
    const bounds = new maplibregl.LngLatBounds();
    let hasValidCoords = false;

    facilities.forEach((facility) => {
      if (facility.latitude && facility.longitude) {
        const el = document.createElement('div');
        el.className = 'facility-marker';
        if (facility.id === selectedFacilityId) {
          el.classList.add('selected');
        }

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([facility.longitude, facility.latitude])
          .addTo(map.current!);

        el.addEventListener('click', () => {
          showPopup(facility);
          onFacilityClick?.(facility);
        });

        markers.current.set(facility.id, marker);
        bounds.extend([facility.longitude, facility.latitude]);
        hasValidCoords = true;
      }
    });

    // Fit map to bounds if we have valid coordinates
    if (hasValidCoords && facilities.length > 0) {
      if (facilities.length === 1) {
        const f = facilities[0];
        if (f.latitude && f.longitude) {
          map.current.flyTo({
            center: [f.longitude, f.latitude],
            zoom: 14,
          });
        }
      } else {
        map.current.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [facilities, mapLoaded, selectedFacilityId, onFacilityClick]);

  // Show popup for a facility
  const showPopup = (facility: Facility) => {
    if (!map.current || !facility.latitude || !facility.longitude) return;

    popup.current?.remove();

    const activeTooltips = tooltipConfig
      .filter((t) => t.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    let content = '<div class="p-4 min-w-[200px]">';

    activeTooltips.forEach((tooltip) => {
      let value: string | undefined;
      const facilityRecord = facility as unknown as Record<string, unknown>;

      if (tooltip.field_source === 'facility') {
        value = facilityRecord[tooltip.field_key] as string;
      } else if (tooltip.field_source === 'question') {
        value = auditData[facility.id]?.[tooltip.field_key];
      }

      if (value) {
        content += `
          <div class="mb-2 last:mb-0">
            <span class="text-xs text-gray-500">${tooltip.display_label}</span>
            <p class="text-sm font-medium text-gray-900">${value}</p>
          </div>
        `;
      }
    });

    content += `
      <a href="/facilities/${facility.id}"
         class="mt-3 inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium">
        View Details →
      </a>
    </div>`;

    popup.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 15,
    })
      .setLngLat([facility.longitude, facility.latitude])
      .setHTML(content)
      .addTo(map.current);
  };

  // Update selected marker style
  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (id === selectedFacilityId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }, [selectedFacilityId]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
    />
  );
}
