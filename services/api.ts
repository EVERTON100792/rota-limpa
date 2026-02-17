import { Location, OptimizedRoute, RouteSegment, OSRMTripResponse } from '../types';
import { MAX_FREE_STOPS } from '../constants';
import { getOptimizedRouteORS } from './orsApi';
import { StorageService } from './storage';

// --- Photon (Komoot) - Free, No Key, Good Text Search ---
const searchLocationPhoton = async (query: string): Promise<Location[]> => {
  if (!query) return [];
  try {
    // Photon optimized for Brazil
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lat=-14.2350&lon=-51.9253&lang=pt`
    );
    const data = await response.json();

    return data.features.map((item: any) => {
      const props = item.properties;
      const coords = item.geometry.coordinates;

      const street = props.street || "";
      const number = props.housenumber || "";
      const city = props.city || props.town || props.village || "";
      const state = props.state || "";
      const postcode = props.postcode || "";

      let mainName = props.name;
      if (!mainName || mainName === street) {
        if (street) mainName = `${street}${number ? ', ' + number : ''}`;
        else mainName = city;
      }

      return {
        lat: coords[1],
        lng: coords[0],
        originalLat: coords[1],
        originalLng: coords[0],
        name: mainName,
        display_name: `${mainName} - ${city}, ${state}`, // Simplified display
        address: {
          street,
          number,
          city,
          state,
          postcode
        }
      };
    });
  } catch (error) {
    console.error("Photon Geocoding error:", error);
    return [];
  }
};

// --- Nominatim (OpenStreetMap Geocoding) ---
const searchLocationNominatim = async (query: string): Promise<Location[]> => {
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
        originalLat: lat,
        originalLng: lng,
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

export const searchLocation = async (query: string): Promise<Location[]> => {
  // Strategy: Run both Photon (faster, better fuzzy) and Nominatim (structured)
  // Combine results, prioritizing those with HOUSE NUMBERS if the query has a number.

  const hasNumberQuery = /\d+/.test(query);

  const [nominatimRes, photonRes] = await Promise.all([
    searchLocationNominatim(query),
    searchLocationPhoton(query)
  ]);

  // Merge and Dedupe
  const combined = [...photonRes, ...nominatimRes];
  const seen = new Set();
  const unique = combined.filter(l => {
    const k = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Sort: Prioritize House Numbers if query had one
  return unique.sort((a, b) => {
    if (!hasNumberQuery) return 0;
    const aHasNum = !!a.address.number;
    const bHasNum = !!b.address.number;
    if (aHasNum && !bHasNum) return -1;
    if (!aHasNum && bHasNum) return 1;
    return 0;
  });
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

// --- Helpers for Route Processing ---

async function getRouteFromOSRM(locations: Location[], roundTrip: boolean, avoidDirt: boolean): Promise<any> {
  const coordinatesString = locations.map(loc => `${loc.lng},${loc.lat}`).join(';');
  let url = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson&steps=true`;

  if (avoidDirt) {
    url += `&exclude=ferry,unpaved`;
  }

  // For Route API, roundTrip just means we added the start node at the end manually? 
  // No, OSRM Route API visits points in order. 
  // If we want round trip geometry, we must append Start to end of locations list before calling this.
  // But wait, getOptimizedRoute calls this with `newOrder`. 
  // If `newOrder` already has Start at end? 
  // The heuristic logic below will ensure `newOrder` is correct.

  const response = await fetch(url);
  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null;
  return data.routes[0];
}

async function processRouteResponse(trip: any, stopsToProcess: Location[], roundTrip: boolean, originalSegments: any[] = []) {
  const segments: RouteSegment[] = [];
  let tollCount = 0;
  const tollDetails: { lat: number; lng: number; name?: string; operator?: string; nearbyLocation?: string; }[] = [];

  // Calculate total stops (start + destinations)
  const totalStops = stopsToProcess.length;

  if (trip.legs && Array.isArray(trip.legs)) {
    trip.legs.forEach((leg: any, legIndex: number) => {

      let direction: 'outbound' | 'inbound' = 'outbound';
      if (roundTrip) {
        // If it's the last leg, it's the return trip
        if (legIndex === trip.legs.length - 1) {
          direction = 'inbound';
        }
      }

      if (roundTrip && totalStops === 2 && legIndex === 1 && segments.length > 0) {
        // Force Symmetric Return logic (same as before)
        const outboundSegments = segments.filter(s => s.direction === 'outbound');
        const legSegments: RouteSegment[] = [];
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
        segments.push(...legSegments);
      } else {
        if (leg.steps && Array.isArray(leg.steps)) {
          leg.steps.forEach((step: any) => {
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

              segments.push({
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
    });
  }

  if (segments.length === 0) {
    let fullCoordinates: [number, number][] = [];
    if (trip.geometry && typeof trip.geometry === 'object' && 'coordinates' in trip.geometry) {
      fullCoordinates = processCoordinates((trip.geometry as any).coordinates);
    }
    segments.push({
      coordinates: fullCoordinates,
      type: 'paved',
      distance: trip.distance,
      duration: trip.duration,
      direction: 'outbound'
    });
  }

  // Recalculate Totals if we forced symmetry
  if (roundTrip && totalStops === 2) {
    const totalDist = segments.reduce((acc, s) => acc + s.distance, 0);
    const totalDur = segments.reduce((acc, s) => acc + s.duration, 0);
    trip.distance = totalDist;
    trip.duration = totalDur;
  }

  // --- Enhanced Toll Detection Logic (Overpass) ---
  try {
    // Logic assumes `stopsToProcess` are the ordered locations
    const bounds = getBoundsFromCoordinates(stopsToProcess);
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

  // --- Reverse Geocoding for Tolls ---
  const uniqueTolls = tollDetails;

  await Promise.all(uniqueTolls.map(async (toll) => {
    try {
      const locationData = await getReverseGeocoding(toll.lat, toll.lng);
      if (locationData && locationData.address) {
        const city = locationData.address.city || locationData.address.town || locationData.address.village || locationData.address.municipality;
        if (city) {
          toll.nearbyLocation = city;
          return;
        }
      }

      let closestDist = Infinity;
      let closestCity = "";
      stopsToProcess.forEach(wp => { // Using ordered stops
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

  return {
    totalDistance: trip.distance,
    totalDuration: trip.duration,
    totalAmount: 0, // Placeholder, calculated in frontend
    segments: segments,
    waypoints: stopsToProcess,
    tollCount: tollCount,
    tollDetails: tollDetails
  };
}


// --- Main Function ---

export const getOptimizedRoute = async (
  locations: Location[],
  isPremium: boolean,
  avoidDirt: boolean = false,
  roundTrip: boolean = false
): Promise<OptimizedRoute | null> => {

  const validLocations = locations.filter(l => l && typeof l.lat === 'number' && typeof l.lng === 'number');
  const stopsToProcess = isPremium ? validLocations : validLocations.slice(0, MAX_FREE_STOPS);

  if (stopsToProcess.length < 2) return null;

  // --- ORS Hybrid Logic (unchanged) ---
  const useORS = StorageService.getUseORS();
  const orsKey = StorageService.getORSKey();

  if (useORS && orsKey && avoidDirt) { // Only force ORS if avoidDirt is requested, as it's the main selling point
    console.log("Using OpenRouteService for Dirt Avoidance...");
    try {
      const osrmResult = await getOSRMMatrix(stopsToProcess, roundTrip);
      const orderedLocations = osrmResult.orderedLocations;
      const orsRoute = await getOptimizedRouteORS(orderedLocations, orsKey, avoidDirt);
      if (orsRoute) return orsRoute;
    } catch (e) {
      console.warn("ORS Failed, falling back to OSRM", e);
    }
  }

  // --- Standard OSRM Logic ---
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

    let trip = data.trips[0];
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

    // --- Closest First Heuristic (Fix for Counter-Intuitive Round Trips) ---
    // If Round Trip, OSRM might give Start -> Far -> Close -> Start.
    // User prefers Start -> Close -> Far -> Start.
    if (roundTrip && orderedLocations.length >= 3) {
      const start = orderedLocations[0];
      const first = orderedLocations[1];
      const last = orderedLocations[orderedLocations.length - 1]; // This is the last stop visited before returning to start

      const distFirst = calculateDistance(start.lat, start.lng, first.lat, first.lng);
      const distLast = calculateDistance(start.lat, start.lng, last.lat, last.lng);

      // If First is significantly further than Last (e.g. 20% further), prefer Last first.
      if (distFirst > distLast * 1.2) {
        console.log("Heuristic: Reversing route to visit closest stop first.");
        // Reverse the order of destinations (keep Start date 0)
        // Original: Start, A, B, C
        // Reverse dests: Start, C, B, A
        // We must also append Start to the end for the Route API to close the loop?
        // NO, OSRM Trip logic implies A->B->C->Start. 
        // If we use Route API, we MUST explicitly add Start at the end for a loop.

        const reversedDestinations = [...orderedLocations.slice(1)].reverse();
        const newOrder = [orderedLocations[0], ...reversedDestinations, orderedLocations[0]]; // Explicit Close Loop

        // Request Route Geometry for this forced order
        const altRoute = await getRouteFromOSRM(newOrder, false, avoidDirt); // roundTrip=false for Route API as we manually closed loop
        if (altRoute) {
          trip = altRoute;
          // For Route API, trip.legs usually matches steps.
          // We also need to update orderedLocations to match the newOrder (excluding the final start duplicate)
          orderedLocations = [orderedLocations[0], ...reversedDestinations];
        }
      }
    }

    // Process Segments using the (potentially new) trip and ordered locations
    const processed = await processRouteResponse(trip, orderedLocations, roundTrip);

    // --- Round Trip Visual Fix: Append Start to Waypoints ---
    const validWaypoints = processed.waypoints;
    if (roundTrip && validWaypoints.length > 0) {
      const startNode = validWaypoints[0];
      const lastNode = validWaypoints[validWaypoints.length - 1];
      const dist = calculateDistance(startNode.lat, startNode.lng, lastNode.lat, lastNode.lng);
      if (dist > 0.1) {
        validWaypoints.push({
          ...startNode,
          name: "Retorno ao Início",
          address: startNode.address
        });
      }
    }

    return processed;

  } catch (error) {
    console.error("Routing error details:", error);
    return null;
  }
};

// --- Helpers (unchanged) ---

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

export const processCoordinates = (coords: number[][]): [number, number][] => {
  if (!Array.isArray(coords)) return [];
  return coords.map(c => [c[1], c[0]]);
};
