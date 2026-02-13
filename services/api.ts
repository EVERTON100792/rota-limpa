
import { Location, OptimizedRoute, RouteSegment, OSRMTripResponse } from '../types';
import { MAX_FREE_STOPS } from '../constants';

// --- Nominatim (OpenStreetMap Geocoding) ---
export const searchLocation = async (query: string): Promise<Location[]> => {
  if (!query) return [];
  try {
    // Increased limit to 10 to provide more "Did you mean?" options for the user
    // addressdetails=1 is crucial for parsing the "Better Name"
    // Use /api/nominatim proxy to allow CORS
    const response = await fetch(
      `/api/nominatim/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`
    );
    const data = await response.json();

    // Deduplicate logic: Nominatim sometimes returns the same place multiple times (e.g. as node and way)
    const seen = new Set();

    return data.map((item: any) => {
      const addr = item.address || {};

      // Extract key components
      const street = addr.road || addr.pedestrian || addr.street || addr.highway || "";
      const number = addr.house_number || "";
      const neighborhood = addr.suburb || addr.neighbourhood || "";
      const city = addr.city || addr.town || addr.village || addr.municipality || "";
      const state = addr.state || "";
      const postcode = addr.postcode || "";

      // Logic to create a "Better Name" than just the raw display_name
      // If we have a street, use "Street, Number" as the main name
      let mainName = item.name;

      if (!mainName || mainName === number || (street && mainName.indexOf(street) === -1)) {
        if (street) {
          mainName = `${street}${number ? ', ' + number : ''}`;
        } else if (city) {
          mainName = city;
        }
      } else {
        // If name exists (e.g., "Shopping Center X"), append number if available and not present
        if (number && mainName.indexOf(number) === -1) {
          mainName += `, ${number}`;
        }
      }

      return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: mainName,
        display_name: item.display_name,
        address: {
          street,
          number,
          city: city || neighborhood, // Fallback to neighborhood if city is missing
          state,
          postcode
        }
      };
    }).filter((loc: any) => {
      // Simple deduplication based on lat/lng to prevent visual clutter
      const key = `${loc.lat.toFixed(4)}-${loc.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  } catch (error) {
    console.error("Geocoding error:", error);
    return [];
  }
};

export const getReverseGeocoding = async (lat: number, lng: number): Promise<Location | null> => {
  try {
    // Use /api/nominatim proxy
    const response = await fetch(
      `/api/nominatim/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
    );
    const data = await response.json();

    if (data && data.address) {
      const addr = data.address;
      const street = addr.road || addr.pedestrian || addr.suburb || "Local Selecionado";
      const number = addr.house_number || "";

      const mainName = number ? `${street}, ${number}` : street;

      return {
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        name: `Minha Localização (${mainName})`,
        display_name: data.display_name,
        address: {
          street: addr.road,
          number: addr.house_number,
          city: addr.city || addr.town,
          state: addr.state
        }
      };
    }
    return {
      lat,
      lng,
      name: "Minha Localização",
      display_name: `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return {
      lat,
      lng,
      name: "Minha Localização",
      display_name: "Localização Atual (GPS)"
    };
  }
};

// --- OSRM (Routing & Optimization) ---

const processCoordinates = (coords: number[][]): [number, number][] => {
  if (!Array.isArray(coords)) return [];
  return coords.map(c => [c[1], c[0]]);
};

export const getOptimizedRoute = async (
  locations: Location[],
  isPremium: boolean,
  avoidDirt: boolean = false,
  roundTrip: boolean = false
): Promise<OptimizedRoute | null> => {

  // Robust check for missing data
  const validLocations = locations.filter(l => l && typeof l.lat === 'number' && typeof l.lng === 'number');
  const stopsToProcess = isPremium ? validLocations : validLocations.slice(0, MAX_FREE_STOPS);

  if (stopsToProcess.length < 2) return null;

  const coordinatesString = stopsToProcess
    .map(loc => `${loc.lng},${loc.lat}`)
    .join(';');

  try {
    // We request 'geojson' explicitly to get [lon, lat] arrays
    // steps=true is required to analyze route segments for surface type
    let url = `https://router.project-osrm.org/trip/v1/driving/${coordinatesString}?source=first&roundtrip=${roundTrip}&overview=full&geometries=geojson&steps=true`;

    // Fix: OSRM Public API does not support 'exclude' with 'roundtrip' (Trip Service)
    // If roundTrip is true, we must ignore avoidDirt to prevent 400 Bad Request
    if (avoidDirt && !roundTrip) {
      url += `&exclude=ferry,unpaved`;
    }

    const response = await fetch(url);
    const data: OSRMTripResponse = await response.json();

    if (data.code !== 'Ok' || !data.trips || data.trips.length === 0) {
      console.warn("OSRM returned no trips:", data);
      throw new Error("Could not calculate route");
    }

    const trip = data.trips[0];
    const waypoints = data.waypoints;

    if (!trip) {
      throw new Error("Trip data is missing");
    }

    let orderedLocations: Location[] = [];

    // OSRM Trip plugin returns a 'permutation' array which maps the input indices to the optimized order.
    // Example: Input [A, B, C] -> Permutation [0, 2, 1] -> Output [A, C, B]
    if (trip.permutation) {
      orderedLocations = trip.permutation.map((index: number) => stopsToProcess[index]);
    } else {
      // Fallback: Use waypoints matching (usually input order, but safer than nothing)
      orderedLocations = new Array(stopsToProcess.length);
      waypoints.forEach((wp) => {
        if (stopsToProcess[wp.waypoint_index]) {
          orderedLocations[wp.waypoint_index] = stopsToProcess[wp.waypoint_index];
        }
      });
    }

    const segments: RouteSegment[] = [];
    let tollCount = 0;
    const tollDetails: { lat: number; lng: number; name?: string; operator?: string; nearbyLocation?: string; }[] = [];

    // Process legs and steps to separate segments by type
    if (trip.legs && Array.isArray(trip.legs)) {
      trip.legs.forEach((leg: any) => {
        if (leg.steps && Array.isArray(leg.steps)) {
          leg.steps.forEach((step: any) => {
            // Toll Detection Logic
            let isToll = false;

            if (step.maneuver && step.maneuver.type === 'toll_booth') {
              isToll = true;
            } else if (step.intersections && step.intersections.some((i: any) => i.classes && i.classes.includes('toll'))) {
              isToll = true;
            }

            if (isToll) {
              // Store OSRM toll detection as fallback
              if (step.maneuver && step.maneuver.location) {
                // OSRM returns [lng, lat]
                tollDetails.push({
                  lat: step.maneuver.location[1],
                  lng: step.maneuver.location[0],
                  name: "Pedágio (OSRM)",
                  operator: "Desconhecido"
                });
              }
            }

            if (step.geometry && step.geometry.coordinates) {
              const stepCoords = processCoordinates(step.geometry.coordinates);

              // Heuristic for unpaved detection
              // Since standard public OSRM doesn't always return 'surface', 
              // we check for common terms in road names or fallback to paved.
              const name = step.name ? step.name.toLowerCase() : '';
              const isUnpaved =
                name.includes('terra') ||
                name.includes('rural') ||
                name.includes('estrada de chão') ||
                name.includes('não pavimentada');

              segments.push({
                coordinates: stepCoords,
                type: isUnpaved ? 'unpaved' : 'paved',
                distance: step.distance || 0,
                duration: step.duration || 0
              });
            }
          });
        }
      });
    }

    // Fallback: If steps processing failed to yield segments, use main geometry
    if (segments.length === 0) {
      let fullCoordinates: [number, number][] = [];

      // 1. Try Main Geometry
      if (trip.geometry && typeof trip.geometry === 'object' && 'coordinates' in trip.geometry) {
        fullCoordinates = processCoordinates((trip.geometry as any).coordinates);
      }

      segments.push({
        coordinates: fullCoordinates,
        type: 'paved',
        distance: trip.distance,
        duration: trip.duration
      });
    }

    // --- Enhanced Toll Detection via Overpass API ---
    // OSRM often misses toll flags on simple nodes. We query OSM directly.
    try {
      const bounds = getBoundsFromCoordinates(orderedLocations.filter(l => l) as Location[]);
      // Expand bounds slightly to ensure we catch everything
      const south = bounds.minLat - 0.05;
      const west = bounds.minLng - 0.05;
      const north = bounds.maxLat + 0.05;
      const east = bounds.maxLng + 0.05;

      // Query for toll booths
      const overpassQuery = `[out:json][timeout:5];
            (
              node["barrier"="toll_booth"](${south},${west},${north},${east});
              node["toll:type"](${south},${west},${north},${east});
            );
            out body;`;

      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
      const opRes = await fetch(overpassUrl);
      const opData = await opRes.json();

      if (opData && opData.elements) {
        const routePath = segments.flatMap(s => s.coordinates); // flattened [lat, lng] array
        const overpassTolls: { lat: number; lng: number; name?: string; operator?: string; nearbyLocation?: string; }[] = [];

        opData.elements.forEach((el: any) => {
          const tollLat = el.lat;
          const tollLng = el.lon;

          // Check if this toll is actually on our route (within ~100 meters - increased from 30m)
          if (isPointNearPolyline([tollLat, tollLng], routePath, 0.001)) {
            // Avoid duplicates locally within Overpass results
            const isDuplicate = overpassTolls.some(existing =>
              calculateDistance(existing.lat, existing.lng, tollLat, tollLng) < 0.2
            );

            if (!isDuplicate) {
              overpassTolls.push({
                lat: tollLat,
                lng: tollLng,
                name: el.tags?.name || "Pedágio",
                operator: el.tags?.operator
              });
            }
          }
        });

        // Merge Overpass results with OSRM results
        // Priority: Overpass (has names) > OSRM (fallback)

        // Remove OSRM tolls that are close to Overpass tolls (likely same toll)
        const uniqueOsrmTolls = tollDetails.filter(osrmToll => {
          return !overpassTolls.some(opToll =>
            calculateDistance(osrmToll.lat, osrmToll.lng, opToll.lat, opToll.lng) < 0.5 // 500m radius
          );
        });

        // Replace tollDetails with generic OSRM + rich Overpass
        // clear array and push new
        tollDetails.length = 0;
        tollDetails.push(...overpassTolls, ...uniqueOsrmTolls);
      }
    } catch (err) {
      console.warn("Overpass API failed (using OSRM fallback):", err);
    }

    // Final count update and Proximity Calculation
    tollCount = tollDetails.length;

    // Calculate "Near X" for each toll
    const validWaypoints = orderedLocations.filter(l => l !== undefined);

    tollDetails.forEach(toll => {
      let closestDist = Infinity;
      let closestName = "";

      validWaypoints.forEach(wp => {
        const d = calculateDistance(toll.lat, toll.lng, wp.lat, wp.lng);
        if (d < closestDist) {
          closestDist = d;
          // Use city if available, otherwise name
          closestName = wp.address?.city || wp.name.split(',')[0];
        }
      });

      if (closestName) {
        toll.nearbyLocation = `Aprox. ${Math.round(closestDist)}km de ${closestName}`;
      }
    });

    return {
      totalDistance: trip.distance,
      totalDuration: trip.duration,
      segments: segments,
      waypoints: validWaypoints,
      tollCount: tollCount,
      tollDetails: tollDetails
    };

  } catch (error) {
    console.error("Routing error details:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    }
    return null;
  }
};

// --- Helpers ---

function getBoundsFromCoordinates(locations: Location[]) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  locations.forEach(l => {
    if (l.lat < minLat) minLat = l.lat;
    if (l.lat > maxLat) maxLat = l.lat;
    if (l.lng < minLng) minLng = l.lng;
    if (l.lng > maxLng) maxLng = l.lng;
  });
  return { minLat, maxLat, minLng, maxLng };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointNearPolyline(point: [number, number], polyline: [number, number][], threshold: number) {
  // Simple verification: check distance to any point in polyline
  // For route arrays which are dense (geojson), this is often efficient enough for client-side
  // Optimization: check bounding box first or use spatial index if needed, but for typical routes < 1000 points loop is fine.

  // Sampling optimization: check every nth point if route is huge
  const step = polyline.length > 2000 ? 5 : 1;

  for (let i = 0; i < polyline.length; i += step) {
    const [pLat, pLng] = polyline[i];
    // Manhattan distance check first for speed
    if (Math.abs(pLat - point[0]) < threshold && Math.abs(pLng - point[1]) < threshold) {
      // Euclidean check
      const dist = Math.sqrt(Math.pow(pLat - point[0], 2) + Math.pow(pLng - point[1], 2));
      if (dist < threshold) return true;
    }
  }
  return false;
}
