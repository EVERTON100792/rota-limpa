import { Trip } from '../types';

const KEYS = {
    TRIPS: 'rota_limpa_trips',
    ORS_KEY: 'rota_limpa_ors_key',
    USE_ORS: 'rota_limpa_use_ors',
    GOOGLE_KEY: 'rota_limpa_google_key',
    USE_GOOGLE: 'rota_limpa_use_google',
    FREIGHT_PRICE: 'freightPricePerKm'
};

export const StorageService = {
    // Trips
    saveTrip: (trip: Trip) => {
        const trips = StorageService.getTrips();
        trips.unshift(trip); // Add to top
        localStorage.setItem(KEYS.TRIPS, JSON.stringify(trips));
    },

    getTrips: (): Trip[] => {
        try {
            const data = localStorage.getItem(KEYS.TRIPS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error parsing trips", e);
            return [];
        }
    },

    deleteTrip: (id: string) => {
        const trips = StorageService.getTrips().filter(t => t.id !== id);
        localStorage.setItem(KEYS.TRIPS, JSON.stringify(trips));
    },

    // Settings
    setORSKey: (key: string) => {
        localStorage.setItem(KEYS.ORS_KEY, key);
    },

    getORSKey: (): string => {
        return localStorage.getItem(KEYS.ORS_KEY) || '';
    },

    setUseORS: (use: boolean) => {
        localStorage.setItem(KEYS.USE_ORS, JSON.stringify(use));
    },

    getUseORS: (): boolean => {
        const val = localStorage.getItem(KEYS.USE_ORS);
        return val ? JSON.parse(val) : false;
    },

    setGoogleKey: (key: string) => {
        localStorage.setItem(KEYS.GOOGLE_KEY, key);
    },

    getGoogleKey: (): string => {
        return localStorage.getItem(KEYS.GOOGLE_KEY) || '';
    },

    setUseGoogle: (use: boolean) => {
        localStorage.setItem(KEYS.USE_GOOGLE, JSON.stringify(use));
    },

    getUseGoogle: (): boolean => {
        const val = localStorage.getItem(KEYS.USE_GOOGLE);
        return val ? JSON.parse(val) : false;
    },

    setFreightPrice: (price: string) => {
        localStorage.setItem(KEYS.FREIGHT_PRICE, price);
    },

    getFreightPrice: (): string => {
        return localStorage.getItem(KEYS.FREIGHT_PRICE) || '';
    }
};
