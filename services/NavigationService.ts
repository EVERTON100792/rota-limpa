import { OptimizedRoute, Location } from '../types';

/**
 * Generates a Google Maps navigation URL.
 * If avoidDirt is true, it attempts to "force" the path by adding intermediate "ghost" waypoints
 * sampled from the route geometry.
 */
export const getGoogleMapsUrl = (route: OptimizedRoute | null, locations: Location[], avoidDirt: boolean): string => {
    if (!route || locations.length < 2) return '#';

    const origin = locations[0];
    const destination = locations[locations.length - 1];
    const realWaypoints = locations.slice(1, -1);

    const formatCoord = (lat: number, lng: number) => `${lat},${lng}`;
    const originStr = formatCoord(origin.lat, origin.lng);
    const destStr = formatCoord(destination.lat, destination.lng);

    let finalWaypoints: string[] = [];

    // Check if we should use High Fidelity Mode (Ghost Waypoints)
    // We use it if avoidDirt is on (to force paved roads) OR if it's a Round Trip (to force return path adherence)
    // We infer round trip if first and last locations are close (< 200m)
    const isRoundTrip = locations.length > 2 &&
        (Math.abs(origin.lat - destination.lat) < 0.002 && Math.abs(origin.lng - destination.lng) < 0.002);

    if (avoidDirt || isRoundTrip) {
        // --- High Fidelity Mode (Ghost Waypoints) ---
        // Strategy: We have the full route geometry in `route.segments`.
        // We have the Real Waypoints (Stops) that MUST be visited.
        // We need to insert Ghost Points *between* the Real Waypoints to force the path.

        // 1. Flatten all coordinates
        const allCoords = route.segments.flatMap(s => s.coordinates);

        if (allCoords.length > 0) {
            // 2. Find indices of Real Waypoints in the geometry
            // validWaypointsIndices[i] corresponds to realWaypoints[i]
            const waypointIndices: number[] = [];

            realWaypoints.forEach(wp => {
                let minDist = Infinity;
                let bestIdx = -1;

                // Optimization: Search only forward from last found index to preserve order
                const searchStart = waypointIndices.length > 0 ? waypointIndices[waypointIndices.length - 1] : 0;

                // We scan a reasonable window ahead to find the match. (Full scan is fine for <10k points)
                for (let i = searchStart; i < allCoords.length; i++) {
                    const c = allCoords[i];
                    const dist = Math.sqrt(Math.pow(c[0] - wp.lng, 2) + Math.pow(c[1] - wp.lat, 2));
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                    // Stop searching if we passed it and are moving away fast? 
                    // No, simpler to just find global best in remaining array.
                }

                // If we found a matching point reasonably close (approx < 1km in degrees)
                if (bestIdx !== -1 && minDist < 0.01) {
                    waypointIndices.push(bestIdx);
                } else {
                    // Fallback: If not found on path, push a placeholder index to keep array aligned?
                    // Actually, if we can't map the waypoint to the path, we can't safely interleave.
                    // Just push the previous index or skip? 
                    // Let's push -1 to signal "Just insert the waypoint here without ghosts before it".
                    waypointIndices.push(-1);
                }
            });

            // 3. Generate Waypoint List (Ghost + Real)
            let lastIdx = 0;

            realWaypoints.forEach((wp, i) => {
                const targetIdx = waypointIndices[i];

                if (targetIdx > lastIdx) {
                    // Sample ghosts between lastIdx and targetIdx
                    const segmentLen = targetIdx - lastIdx;
                    // Density: One ghost every ~50-100 points or fixed count?
                    // Fixed count per segment is safer for URL limits.
                    // If we have 5 stops, max 2-3 ghosts per leg.
                    const ghostsPerLeg = 2;
                    const step = Math.floor(segmentLen / (ghostsPerLeg + 1));

                    if (step > 10) {
                        for (let k = 1; k <= ghostsPerLeg; k++) {
                            const idx = lastIdx + (step * k);
                            if (idx < targetIdx) {
                                const c = allCoords[idx];
                                finalWaypoints.push(formatCoord(c[0], c[1]));
                            }
                        }
                    }
                    lastIdx = targetIdx;
                }

                // ADD THE REAL WAYPOINT
                finalWaypoints.push(formatCoord(wp.originalLat || wp.lat, wp.originalLng || wp.lng));
            });

            // 4. Ghost points for the FINAL leg (Last WP -> Destination)
            const endIdx = allCoords.length - 1;
            if (endIdx > lastIdx) {
                const segmentLen = endIdx - lastIdx;
                const ghostsPerLeg = 2;
                const step = Math.floor(segmentLen / (ghostsPerLeg + 1));
                if (step > 10) {
                    for (let k = 1; k <= ghostsPerLeg; k++) {
                        const idx = lastIdx + (step * k);
                        if (idx < endIdx) {
                            const c = allCoords[idx];
                            finalWaypoints.push(formatCoord(c[0], c[1]));
                        }
                    }
                }
            }
        } else {
            // Fallback: No geometry
            finalWaypoints = realWaypoints.map(l => formatCoord(l.originalLat || l.lat, l.originalLng || l.lng));
        }

    } else {
        // Standard Behavior (Just Real Stops)
        finalWaypoints = realWaypoints.map(l => formatCoord(l.originalLat || l.lat, l.originalLng || l.lng));
    }

    let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;

    if (finalWaypoints.length > 0) {
        url += `&waypoints=${finalWaypoints.join('|')}`;
    }

    return url;
};

export const openWazeLink = (lat: number, lng: number) => {
    // Waze deep link to a specific coordinate
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
};
