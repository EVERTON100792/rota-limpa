
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { OptimizedRoute, Location } from '../types';
import { COLOR_PAVED, COLOR_UNPAVED, COLOR_MARKER_START, COLOR_MARKER_END, COLOR_MARKER_DEFAULT, COLOR_OUTBOUND, COLOR_INBOUND } from '../constants';

// Fix Leaflet default icon issue in React
const createIcon = (color: string, content: string | number) => {
    // SVG Pin with dynamic color
    const svgHtml = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="28" height="36" style="filter: drop-shadow(0 4px 3px rgba(0,0,0,0.3));">
        <!-- Pin Shape -->
        <path d="M384 192c0 87.4-117 243-168.3 307.2c-12.3 15.3-35.1 15.3-47.4 0C117 435 0 279.4 0 192C0 86 86 0 192 0s192 86 192 192z" fill="${color}" stroke="white" stroke-width="12"/>
        <!-- Inner Circle for Content -->
        <circle cx="192" cy="192" r="80" fill="white" />
        <!-- Text/Content -->
        <text x="50%" y="42%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="90" fill="${color}">${content}</text>
      </svg>
    `;

    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="display: flex; align-items: center; justify-content: center; margin-top: -36px; margin-left: -14px;">${svgHtml}</div>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36], // Point at bottom center
        popupAnchor: [0, -38] // Popup above the pin
    });
};

const AutoBounds = ({ route }: { route: OptimizedRoute | null }) => {
    const map = useMap();
    useEffect(() => {
        if (route && route.waypoints.length > 0) {
            try {
                const bounds = L.latLngBounds(route.waypoints.map(w => [w.lat, w.lng]));
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                }
            } catch (e) {
                console.error("Bounds error", e);
            }
        }
    }, [route, map]);
    return null;
};

interface MapComponentProps {
    route: OptimizedRoute | null;
    locations: Location[];
    isPremium: boolean;
    isNavigating: boolean; // Mantido props mas não usado para mudar view
    onStopNavigation: () => void;
    onRecalculate: () => Promise<void>;
    onOffRouteDetected: (currentLat: number, currentLng: number) => void;
    onUpdateLocation?: (index: number, newLoc: Location) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
    route, locations, isPremium, onUpdateLocation
}) => {
    const pointsToDisplay = route ? route.waypoints : locations;

    const getSegmentColor = (segment: any) => {
        if (segment.type === 'unpaved') return COLOR_UNPAVED;
        if (segment.direction === 'inbound') return COLOR_INBOUND;
        return COLOR_OUTBOUND; // Default or 'outbound'
    };

    // Helper for Cased Line (Border + Inner)
    const renderCasedLine = (segment: any, idx: number) => {
        const keyBase = `route-seg-${idx}-${route?.totalDistance}`;
        const color = getSegmentColor(segment);
        const isUnpaved = segment.type === 'unpaved';

        return (
            <React.Fragment key={keyBase}>
                {/* 1. Outer Casing (White Border) - Thicker */}
                <Polyline
                    positions={segment.coordinates}
                    pathOptions={{
                        color: 'white',
                        weight: isUnpaved ? 10 : 9,
                        opacity: 1, // Solid contrast
                        lineCap: 'round',
                        lineJoin: 'round'
                    }}
                />
                {/* 2. Inner Line (Colored) - Thinner */}
                <Polyline
                    positions={segment.coordinates}
                    pathOptions={{
                        color: color,
                        weight: isUnpaved ? 6 : 5,
                        dashArray: isUnpaved ? '10, 15' : undefined, // Dashed for dirt
                        opacity: 0.9,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }}
                />
            </React.Fragment>
        );
    };

    return (
        <div className="w-full h-full relative isolate overflow-hidden bg-gray-200">
            <MapContainer
                center={[-23.5505, -46.6333]}
                zoom={6}
                className="w-full h-full z-0"
                style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
                zoomControl={false}
                attributionControl={false}
            >
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Mapa Premium (CartoDB)">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Satélite (Google)">
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="OpenStreetMap (Padrão)">
                        <TileLayer
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                {/* Route Segments with Cased Line Style */}
                {route && route.segments.map((segment, idx) => renderCasedLine(segment, idx))}

                {/* Static Markers (Waypoints) */}
                {pointsToDisplay.map((loc, idx) => {
                    let color = COLOR_MARKER_DEFAULT;
                    let content: string | number = idx;
                    let zIndexOffset = 100;

                    if (idx === 0) {
                        color = COLOR_MARKER_START;
                        content = '▶'; // Play symbol
                        zIndexOffset = 200;
                    } else if (idx === pointsToDisplay.length - 1 && pointsToDisplay.length > 1) {
                        // Only mark as End if there's more than 1 point
                        color = COLOR_MARKER_END;
                        content = '🏁'; // Checkered Flag symbol
                        zIndexOffset = 200;
                    }

                    const eventHandlers = {
                        dragend(e: any) {
                            if (onUpdateLocation) {
                                const marker = e.target;
                                const position = marker.getLatLng();
                                if (position) {
                                    onUpdateLocation(idx, {
                                        ...loc,
                                        lat: position.lat,
                                        lng: position.lng,
                                        name: `${loc.name} (Ajustado)`
                                    });
                                }
                            }
                        },
                    };

                    return (
                        <Marker
                            key={`${loc.lat}-${loc.lng}-${idx}`}
                            position={[loc.lat, loc.lng]}
                            icon={createIcon(color, content)}
                            draggable={true}
                            zIndexOffset={zIndexOffset}
                            eventHandlers={eventHandlers}
                        >
                            <Popup>
                                <div className="text-center">
                                    <strong className="block mb-1 text-gray-800">{loc.name}</strong>
                                    <span className="text-xs text-gray-500 block mb-2">{loc.display_name}</span>
                                    <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium border border-blue-100">
                                        Arraste para ajustar
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Toll Markers - Optimized */}
                {route && route.tollDetails && route.tollDetails.map((toll, idx) => (
                    <Marker
                        key={`toll-${idx}`}
                        position={[toll.lat, toll.lng]}
                        zIndexOffset={50}
                        icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background-color: #f59e0b; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-size: 10px; font-weight: bold;">$</div>`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })}
                    >
                        <Popup>
                            <div className="flex flex-col gap-1 min-w-[150px]">
                                <strong className="text-amber-700 flex items-center gap-1">
                                    <span>💰</span> {toll.name || "Pedágio"}
                                </strong>
                                {toll.operator && <span className="text-xs text-gray-500">{toll.operator}</span>}
                                {toll.nearbyLocation && (
                                    <span className="text-xs text-emerald-600 font-semibold border-t pt-1 mt-1">
                                        📍 {toll.nearbyLocation}
                                    </span>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <AutoBounds route={route} />
            </MapContainer>

            {/* Legenda de Rotas - Compacta e Flutuante */}
            {route && (
                <div className="absolute bottom-6 left-6 z-[400] bg-white/90 p-3 rounded-lg shadow-xl border border-white/50 text-xs flex flex-col gap-2 backdrop-blur-md animate-in slide-in-from-left-4 duration-500">
                    <h4 className="font-bold text-gray-800 mb-1 flex items-center gap-1">
                        <span>🗺️</span> Legenda
                    </h4>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-1.5 rounded-full bg-blue-500 ring-1 ring-white shadow-sm"></div>
                        <span className="text-gray-600 font-medium">Ida</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-1.5 rounded-full bg-rose-500 ring-1 ring-white shadow-sm"></div>
                        <span className="text-gray-600 font-medium">Volta</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-1.5 rounded-full border border-dashed border-amber-700 bg-amber-100 flex items-center justify-center">
                            <div className="w-full border-t border-dashed border-amber-700 opacity-50"></div>
                        </div>
                        <span className="text-amber-800 font-medium">Terra / Não Pav.</span>
                    </div>
                </div>
            )}

            {/* Attribution / Legenda pequena */}
            <div className="absolute bottom-0.5 right-0.5 z-[400] text-[8px] text-gray-400 bg-white/60 px-1 rounded pointer-events-none backdrop-blur-sm">
                OSM &copy; CartoDB &copy;
            </div>
        </div >
    );
};

export default MapComponent;
