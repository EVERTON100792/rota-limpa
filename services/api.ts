import { Location, OptimizedRoute, RouteSegment, OSRMTripResponse } from '../types';
import { MAX_FREE_STOPS } from '../constants';
import { getOptimizedRouteORS } from './orsApi';
import { StorageService } from './storage';

// --- Nominatim (OpenStreetMap Geocoding) ---
export const searchLocation = async (query: string): Promise<Location[]> => {
  if (!query) return [];
  try {
    const response = await fetch(
      `/api/nominatim/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=br`
    );
    const data = await response.json();

    const seen = new Set();

    return data.map((item: any) => {
      const addr = item.address || {};
      const street = addr.road || addr.pedestrian || addr.street || addr.highway || "";
      const number = addr.house_number || "";
      const neighborhood = addr.suburb || addr.neighbourhood || "";
      const city = addr.city || addr.town || addr.village || addr.municipality || "";
      const state = addr.state || "";
      const postcode = addr.postcode || "";

      let mainName = item.name;

      if (!mainName) {
        if (street) {
          mainName = `${street}${number ? ', ' + number : ''}`;
        } else if (city) {
          mainName = city;
        } else {
          mainName = item.display_name.split(',')[0];
        }
      }

      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);

      return {
        lat: lat,
        lng: lng,
        originalLat: lat, // Persist exact geocode
        originalLng: lng, // Persist exact geocode
        name: mainName,
        display_name: item.display_name,
        address: {
          street,
          number,
          city: city || neighborhood,
          state,
          postcode
        }
      };
    }).sort((a: any, b: any) => {
      // Prioritize results that have a house number if the query looks like it has a number
      const hasNumberA = !!a.address.number;
      const hasNumberB = !!b.address.number;
      if (hasNumberA && !hasNumberB) return -1;
      if (!hasNumberA && hasNumberB) return 1;
      return 0;
    }).filter((loc: any) => {
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
        originalLat: parseFloat(data.lat),
        originalLng: parseFloat(data.lon),
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
      originalLat: lat,
      originalLng: lng,
      name: "Minha Localização",
      display_name: `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return {
      lat,
      lng,
      originalLat: lat,
      originalLng: lng,
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

  const validLocations = locations.filter(l => l && typeof l.lat === 'number' && typeof l.lng === 'number');
  const stopsToProcess = isPremium ? validLocations : validLocations.slice(0, MAX_FREE_STOPS);

  if (stopsToProcess.length < 2) return null;

  // --- ORS Hybrid Logic ---
  const useORS = StorageService.getUseORS();
  const orsKey = StorageService.getORSKey();

  if (useORS && orsKey && avoidDirt) { // Only force ORS if avoidDirt is requested, as it's the main selling point
    console.log("Using OpenRouteService for Dirt Avoidance...");
    try {
      // Note: ORS Directions does NOT reorder (TSP).
      // Strategy: Use OSRM to get Order, THEN ORS for path?
      // For now, to keep it simple and robust:
      // If the user enabled ORS, we use ORS. If they need optimization, they should trust ORS path or 
      // we assume they manually ordered it/we trust OSRM order logic from a previous step?
      // Let's implement the FULL HYBRID:
      // 1. Get Optimized Order from OSRM (Trip API) - Fast & Good TSP.
      // 2. Use that Order to request ORS (Directions API) - Good Dirt Avoidance.

      // Step 1: OSRM Optimization (Order Only)
      const osrmResult = await getOSRMMatrix(stopsToProcess, roundTrip);
      const orderedLocations = osrmResult.orderedLocations;

      // Step 2: ORS Pathing (Geometry + Fidelity)
      const orsRoute = await getOptimizedRouteORS(orderedLocations, orsKey, avoidDirt);
      if (orsRoute) {
        // Merge details? ORS lacks tolls.
        // We can run the Overpass Toll check on the ORS route geometry!
        // For now, let's just return ORS route.
        return orsRoute;
      }
    } catch (e) {
      console.warn("ORS Failed, falling back to OSRM", e);
    }
  }

  // --- Standard OSRM Logic (Fallback/Default) ---
  const coordinatesString = stopsToProcess
    .map(loc => `${loc.lng},${loc.lat}`)
    .join(';');

  try {
    let url = `https://router.project-osrm.org/trip/v1/driving/${coordinatesString}?source=first&roundtrip=${roundTrip}&overview=full&geometries=geojson&steps=true`;

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

    let orderedLocations: Location[] = [];

    if (trip.permutation) {
      orderedLocations = trip.permutation.map((index: number) => stopsToProcess[index]);
    } else {
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

    // --- Improved Segment Processing for Direction & Symmetry ---

    // Calculate total stops (start + destinations)
    const totalStops = stopsToProcess.length;

    if (trip.legs && Array.isArray(trip.legs)) {
      trip.legs.forEach((leg: any, legIndex: number) => {

        // Determine segment direction
        // Rule:
        // - If RoundTrip is active:
        //   - For 2 stops (A->B->A): leg 0 is outbound, leg 1 is inbound.
        //   - For N stops (A->B->C->A): Last leg is inbound? Or just sequential?
        //   - User Interpretation: "Ida" = sequence to last destination. "Volta" = return to start.
        //   - In OSRM RoundTrip: It visits all points then returns.
        //   - So, Leg 0 to N-2 are "Outbound". Last Leg (N-1) is "Inbound" (Back to start).

        let direction: 'outbound' | 'inbound' = 'outbound';
        if (roundTrip) {
          // If it's the last leg, it's the return trip
          if (legIndex === trip.legs.length - 1) {
            direction = 'inbound';
          }
        }

        // --- Force Symmetric Return for 2-point Round Trip ---
        // If we have exactly 2 locations (Start + 1 Dest) and RoundTrip is true:
        // Leg 0 is Start->Dest. Leg 1 is Dest->Start.
        // To ensure "Same Path" and "Same Mileage", we can ignore OSRM's Leg 1 geometry
        // and simply Reverse Leg 0 geometry.

        let legSegments: RouteSegment[] = [];

        if (roundTrip && totalStops === 2 && legIndex === 1 && segments.length > 0) {
          // Clone segments from Leg 0 (Outbound)
          // This assumes segments are stored sequentially. 
          // We need to retrieve the outbound segments.
          // Since we push to `segments` array immediately, we can filter by 'outbound'
          const outboundSegments = segments.filter(s => s.direction === 'outbound');

          // Create reversed segments
          // Iterate backwards through outbound segments
          for (let i = outboundSegments.length - 1; i >= 0; i--) {
            const seg = outboundSegments[i];
            const reverseCoords = [...seg.coordinates].reverse();

            legSegments.push({
              coordinates: reverseCoords,
              type: seg.type,
              distance: seg.distance,
              duration: seg.duration,
              direction: 'inbound'
            });
          }

          // Overwrite trip totals to be exactly double the outbound
          // (This is a visual hack, but user asked for "Same Kilometragem")
          // We might need to adjust `trip.distance` return value too at the end.
        } else {
          // Standard Processing
          if (leg.steps && Array.isArray(leg.steps)) {
            leg.steps.forEach((step: any) => {
              // ... Toll logic (omitted, handled by existing loop if we kept it inside, but I'm replacing the block)
              // Wait, I need to keep toll logic inside the loop or re-run it?
              // The previous code had Toll logic mixed in. I should preserve it.
              // For brevity, I'll extract standard processing.

              let isToll = false;
              if (step.maneuver && step.maneuver.type === 'toll_booth') isToll = true;
              else if (step.intersections && step.intersections.some((i: any) => i.classes && i.classes.includes('toll'))) isToll = true;

              if (isToll && step.maneuver && step.maneuver.location) {
                tollDetails.push({
                  lat: step.maneuver.location[1],
                  lng: step.maneuver.location[0],
                  name: "Pedágio (OSRM)",
                  operator: "Desconhecido"
                });
              }

              if (step.geometry && step.geometry.coordinates) {
                const stepCoords = processCoordinates(step.geometry.coordinates);
                const name = step.name ? step.name.toLowerCase() : '';
                const isUnpaved = name.includes('terra') || name.includes('rural') || name.includes('estrada de chão') || name.includes('não pavimentada');

                legSegments.push({
                  coordinates: stepCoords,
                  type: isUnpaved ? 'unpaved' : 'paved',
                  distance: step.distance || 0,
                  duration: step.duration || 0,
                  direction: direction
                });
              }
            });
          }
        }

        segments.push(...legSegments);
      });
    }

    if (segments.length === 0) {
      // Fallback for overview geometry if no steps
      let fullCoordinates: [number, number][] = [];
      if (trip.geometry && typeof trip.geometry === 'object' && 'coordinates' in trip.geometry) {
        fullCoordinates = processCoordinates((trip.geometry as any).coordinates);
      }
      segments.push({
        coordinates: fullCoordinates,
        type: 'paved',
        distance: trip.distance,
        duration: trip.duration,
        direction: 'outbound' // Default
      });
    }

    // Recalculate Totals if we forced symmetry
    if (roundTrip && totalStops === 2) {
      // Sum segments
      const totalDist = segments.reduce((acc, s) => acc + s.distance, 0);
      const totalDur = segments.reduce((acc, s) => acc + s.duration, 0);
      trip.distance = totalDist;
      trip.duration = totalDur;
    }

    // --- Enhanced Toll Detection Logic (Same as before) ---
    // (Preserving logic for Overpass API call... simplified for brevity in this replace block, 
    // but implies we should keep the existing helper logic separate if reusing. 
    // Since I am replacing the whole file, I will rewrite the Overpass logic here.)

    try {
      const bounds = getBoundsFromCoordinates(orderedLocations.filter(l => l) as Location[]);
      const south = bounds.minLat - 0.05;
      const west = bounds.minLng - 0.05;
      const north = bounds.maxLat + 0.05;
      const east = bounds.maxLng + 0.05;

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
        const routePath = segments.flatMap(s => s.coordinates);
        const overpassTolls: { lat: number; lng: number; name?: string; operator?: string; nearbyLocation?: string; }[] = [];

        opData.elements.forEach((el: any) => {
          const tollLat = el.lat;
          const tollLng = el.lon;

          if (isPointNearPolyline([tollLat, tollLng], routePath, 0.001)) {
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

        const uniqueOsrmTolls = tollDetails.filter(osrmToll => {
          return !overpassTolls.some(opToll =>
            calculateDistance(osrmToll.lat, osrmToll.lng, opToll.lat, opToll.lng) < 0.5
          );
        });

        tollDetails.length = 0;
        tollDetails.push(...overpassTolls, ...uniqueOsrmTolls);
      }
    } catch (err) {
      console.warn("Overpass API failed (using OSRM fallback):", err);
    }

    tollCount = tollDetails.length;
    const validWaypoints = orderedLocations.filter(l => l !== undefined);

    // --- Accurate City Naming via Reverse Geocoding ---
    // User Feedback: "Proximo a Rolandia" was wrong, should be "Jataizinho".
    // Old logic only checked distance to Waypoints. New logic: Reverse Geocode the TOLL itself.

    // We limit this to avoid rate limits if there are huge numbers of tolls, 
    // but typically a route has < 10 tolls.
    const uniqueTolls = tollDetails; // already deduped above

    await Promise.all(uniqueTolls.map(async (toll) => {
      try {
        // 1. Try to get City from Overpass Tags (if we had them here, but we normalized `tollDetails` structure)
        // Since we don't store raw tags in `tollDetails`, we skip to Reverse Geocoding.

        // 2. Reverse Geocode the Toll Location
        // Use a slight delay or just run parallel (Nominatim might rate limit, but usually fine for small batches)
        const locationData = await getReverseGeocoding(toll.lat, toll.lng);

        if (locationData && locationData.address) {
          const city = locationData.address.city || locationData.address.town || locationData.address.village || locationData.address.municipality;
          if (city) {
            toll.nearbyLocation = city; // Direct City Name: "Jataizinho"
            return;
          }
        }

        // 3. Fallback: Distance to closest Waypoint (Old Logic)
        let closestDist = Infinity;
        let closestCity = "";
        validWaypoints.forEach(wp => {
          const d = calculateDistance(toll.lat, toll.lng, wp.lat, wp.lng);
          if (d < closestDist) {
            closestDist = d;
            const addr = wp.address || {};
            closestCity = addr.city || addr.town || addr.village || addr.municipality || "";
            if (!closestCity && wp.name && !/\d/.test(wp.name) && !wp.name.includes(',')) {
              closestCity = wp.name;
            }
          }
        });
        toll.nearbyLocation = closestCity ? `Próximo a ${closestCity}` : `Aprox. ${Math.round(closestDist)}km`;

      } catch (e) {
        console.warn("Toll Reverse Geocode Failed", e);
        toll.nearbyLocation = "Local Desconhecido";
      }
    }));

    // --- Round Trip Visual Fix: Append Start to Waypoints ---
    // User wants the "Finish Flag" (Checkered) at the Start Location for Round Trips.
    // MapComponent uses the last waypoint for the flag.
    if (roundTrip && validWaypoints.length > 0) {
      // Check if the last waypoint is already the start (OSRM usually doesn't do this for 'waypoints' array)
      const startNode = validWaypoints[0];
      const lastNode = validWaypoints[validWaypoints.length - 1];

      // If last node is not physically the start node (approx check)
      const dist = calculateDistance(startNode.lat, startNode.lng, lastNode.lat, lastNode.lng);
      if (dist > 0.1) {
        // Append a distinct copy of the start node as the "Arrival" point
        validWaypoints.push({
          ...startNode,
          name: "Retorno ao Início",
          address: startNode.address
        });
      }
    }

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
    return null;
  }
};

// --- Helpers ---

// Split extraction for reuse
async function getOSRMMatrix(locations: Location[], roundTrip: boolean) {
  // Helper to just get order from OSRM without caring about path details
  const coordinatesString = locations.map(loc => `${loc.lng},${loc.lat}`).join(';');
  const url = `https://router.project-osrm.org/trip/v1/driving/${coordinatesString}?source=first&roundtrip=${roundTrip}&overview=false`;

  const response = await fetch(url);
  const data = await response.json();
  if (data.code !== 'Ok' || !data.trips) throw new Error("OSRM Matrix Failed");

  const trip = data.trips[0];
  const waypoints = data.waypoints;
  let orderedLocations: Location[] = [];

  if (trip.permutation) {
    orderedLocations = trip.permutation.map((index: number) => locations[index]);
  } else {
    orderedLocations = locations;
  }

  return { orderedLocations };
}

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
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointNearPolyline(point: [number, number], polyline: [number, number][], threshold: number) {
  const step = polyline.length > 2000 ? 5 : 1;
  for (let i = 0; i < polyline.length; i += step) {
    const [pLat, pLng] = polyline[i];
    if (Math.abs(pLat - point[0]) < threshold && Math.abs(pLng - point[1]) < threshold) {
      const dist = Math.sqrt(Math.pow(pLat - point[0], 2) + Math.pow(pLng - point[1], 2));
      if (dist < threshold) return true;
    }
  }
  return false;
}
