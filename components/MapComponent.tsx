
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { OptimizedRoute, Location } from '../types';
import { COLOR_PAVED, COLOR_UNPAVED, COLOR_MARKER_START, COLOR_MARKER_END, COLOR_MARKER_DEFAULT } from '../constants';

// Fix Leaflet default icon issue in React
const createIcon = (color: string, number?: number) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number || ''}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
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
}

const MapComponent: React.FC<MapComponentProps> = ({
    route, locations, isPremium
}) => {
    const pointsToDisplay = route ? route.waypoints : locations;

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
                    <LayersControl.BaseLayer checked name="Mapa Rodoviário">
                        <TileLayer
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Satélite">
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                {/* Route Segments */}
                {route && route.segments.map((segment, idx) => (
                    <Polyline
                        key={`route-seg-${idx}-${route.totalDistance}`}
                        positions={segment.coordinates}
                        pathOptions={{
                            color: segment.type === 'unpaved' ? COLOR_UNPAVED : COLOR_PAVED,
                            weight: segment.type === 'unpaved' ? 8 : 6,
                            dashArray: segment.type === 'unpaved' ? '10, 10' : undefined,
                            opacity: 0.8,
                            lineCap: 'round',
                            lineJoin: 'round'
                        }}
                    />
                ))}

                {/* Static Markers (Waypoints) */}
                {pointsToDisplay.map((loc, idx) => {
                    let color = COLOR_MARKER_DEFAULT;
                    if (route) {
                        if (idx === 0) color = COLOR_MARKER_START;
                        else if (idx === pointsToDisplay.length - 1) color = COLOR_MARKER_END;
                    }

                    return (
                        <Marker
                            key={`${loc.lat}-${loc.lng}-${idx}`}
                            position={[loc.lat, loc.lng]}
                            icon={createIcon(color, idx + 1)}
                        >
                            <Popup>
                                <strong>{loc.name}</strong>
                                <br />
                                {loc.display_name}
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Toll Markers */}
                {route && route.tollDetails && route.tollDetails.map((toll, idx) => (
                    <Marker
                        key={`toll-${idx}`}
                        position={[toll.lat, toll.lng]}
                        icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background-color: #f59e0b; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px; font-weight: bold;">$</div>`,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })}
                    >
                        <Popup>
                            <div className="flex flex-col gap-1">
                                <strong className="text-orange-700">{toll.name || "Pedágio Identificado"}</strong>
                                {toll.operator && <span className="text-xs text-gray-500">{toll.operator}</span>}
                                {toll.nearbyLocation && (
                                    <span className="text-xs text-emerald-600 font-semibold border-t pt-1 mt-1">
                                        {toll.nearbyLocation}
                                    </span>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}

                <AutoBounds route={route} />
            </MapContainer>

            {/* Attribution / Legenda pequena */}
            <div className="absolute bottom-1 right-1 z-[400] text-[10px] text-gray-500 bg-white/70 px-1 rounded pointer-events-none">
                OpenStreetMap &copy;
            </div>
        </div >
    );
};

export default MapComponent;
