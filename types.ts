
export interface Location {
  lat: number;
  lng: number;
  name: string;
  display_name?: string;
  address?: {
    street?: string;
    number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    neighbourhood?: string;
    state?: string;
    postcode?: string;
  };
  clientId?: string;
  originalLat?: number;
  originalLng?: number;
}

export interface Trip {
  id: string;
  date: string;
  totalDistance: number;
  totalDuration: number;
  costPerKm: number;
  totalAmount: number;
  locations: Location[];
  routeSummary?: string;
}

export interface RouteSegment {
  coordinates: [number, number][];
  type: 'paved' | 'unpaved';
  distance: number; // meters
  duration: number; // seconds
}

export interface OptimizedRoute {
  totalDistance: number;
  totalDuration: number;
  segments: RouteSegment[];
  waypoints: Location[]; // The ordered list of stops
  tollCount: number;
  tollDetails: { lat: number; lng: number; name?: string; operator?: string; nearbyLocation?: string; }[];
}

export interface UserProfile {
  id: string;
  email: string;
  is_premium: boolean;
}

export enum ViewState {
  INPUT = 'INPUT',
  MAP = 'MAP',
  CHECKOUT = 'CHECKOUT'
}

// OSRM API Response Types (Partial)
export interface OSRMWaypoint {
  hint: string;
  distance: number;
  name: string;
  location: [number, number];
  waypoint_index: number;
  trips_index: number;
}

export interface OSRMRoute {
  geometry: { coordinates: number[][] } | string | null;
  legs: any[];
  weight_name: string;
  weight: number;
  duration: number;
  distance: number;
  permutation?: number[];
}

export interface OSRMTripResponse {
  code: string;
  waypoints: OSRMWaypoint[];
  trips: OSRMRoute[];
}
