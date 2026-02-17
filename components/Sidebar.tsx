
import React, { useState, useEffect, useRef } from 'react';
import { getGoogleMapsUrl, openWazeLink } from '../services/NavigationService';
import { Location, OptimizedRoute, Trip } from '../types';
import { searchLocation, getReverseGeocoding } from '../services/api';
import { StorageService } from '../services/storage';
import { MapPin, Navigation, Search, AlertTriangle, Star, Check, Trash2, Code, Calculator, Map as MapIcon, Loader2, Home, X, ExternalLink, Locate, Settings, FileText, Pencil, CheckCircle, MapPinOff } from 'lucide-react';
import { MAX_FREE_STOPS } from '../constants';
import LocationItem from './LocationItem';


interface SidebarProps {
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  isPremium: boolean;
  onOptimize: () => void;
  isOptimizing: boolean;
  route: OptimizedRoute | null;
  onUpgradeClick: () => void;
  onShowDevCode: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenHelp: () => void;
  onStartNavigation: () => void; // Mantido para compatibilidade, mas não usado internamente
  isNavigating: boolean;
  avoidDirt: boolean;
  onToggleAvoidDirt: () => void;
  roundTrip: boolean;
  onToggleRoundTrip: () => void;
  setRoundTrip: (value: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  locations,
  setLocations,
  isPremium,
  onOptimize,
  isOptimizing,
  route,
  onUpgradeClick,
  onShowDevCode,
  onOpenSettings,
  onOpenHistory,
  onOpenHelp,
  avoidDirt,
  onToggleAvoidDirt,
  roundTrip,
  onToggleRoundTrip,
  setRoundTrip,
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  // Removed BulkImport/OCR state as per request

  // Freight Calculation State
  const [freightPricePerKm, setFreightPricePerKm] = useState<string>(() => {
    return localStorage.getItem('freightPricePerKm') || '';
  });

  // Fuel Calculation State
  const [fuelConsumption, setFuelConsumption] = useState<string>(() => {
    return localStorage.getItem('fuelConsumption') || '';
  });
  const [fuelPrice, setFuelPrice] = useState<string>(() => {
    return localStorage.getItem('fuelPrice') || '';
  });

  // Ref to handle clicking outside
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Debounce Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setIsSearching(true);
        setShowDropdown(true);
        try {
          const results = await searchLocation(query);
          setSearchResults(results);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 600); // Wait 600ms after user stops typing

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Seu navegador não suporta geolocalização.");
      return;
    }

    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const locationData = await getReverseGeocoding(latitude, longitude);

        if (locationData) {
          setLocations(prev => [locationData, ...prev]);
          // Auto-enable Round Trip as per user request
          setRoundTrip(true);
        }
        setIsLoadingLocation(false);
      },
      (error) => {
        console.error(error);
        alert("Erro ao obter localização. Verifique as permissões do GPS.");
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const addLocation = (loc: Location) => {
    // Premium check removed (Unlimited stops for everyone)
    setLocations([...locations, loc]);
    setSearchResults([]);
    setQuery('');
    setShowDropdown(false);
  };

  const handleManualAdd = async () => {
    if (!query) return;
    setIsSearching(true);
    try {
      // Geocode the full string (Street + Number)
      const results = await searchLocation(query);
      if (results && results.length > 0) {
        // Use the first result which should be the most relevant (and hopefully has the number)
        addLocation(results[0]);
      } else {
        alert("Endereço não encontrado. Tente verificar o número ou o nome da rua.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao buscar endereço.");
    } finally {
      setIsSearching(false);
    }
  };

  // Removed handleCameraCapture logic

  const removeLocation = (index: number) => {
    const newLocs = [...locations];
    newLocs.splice(index, 1);
    setLocations(newLocs);
  };

  const updateLocation = (index: number, newLocation: Location) => {
    const updatedLocations = [...locations];
    updatedLocations[index] = newLocation;
    setLocations(updatedLocations);
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatCurrency = (val: number) => {
    if (isNaN(val)) return 'R$ 0,00';
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    } catch (e) {
      return 'R$ 0,00';
    }
  }

  // --- Navigation Logic ---
  const openNavigation = () => {
    const url = getGoogleMapsUrl(route, locations, avoidDirt);
    window.open(url, '_blank');
  };

  const handleFinishTrip = () => {
    if (!route || locations.length < 2) {
      alert("Não há uma rota ativa para finalizar.");
      return;
    }

    const pricePerKmStr = StorageService.getFreightPrice();
    let finalPrice = parseFloat(pricePerKmStr) || 0;

    if (finalPrice === 0) {
      const input = prompt("Qual o valor por KM cobrado? (Ex: 1.50)");
      if (input) {
        const parsed = parseFloat(input.replace(',', '.'));
        if (!isNaN(parsed)) {
          finalPrice = parsed;
          StorageService.setFreightPrice(parsed.toString());
        }
      }
    }

    const distanceKm = route.totalDistance / 1000;
    const totalAmount = distanceKm * finalPrice;

    if (confirm(`Finalizar a viagem?\n\nDistância: ${distanceKm.toFixed(1)}km\nTotal: R$ ${totalAmount.toFixed(2)}\n\nIsso salvará o histórico e limpará a rota atual.`)) {
      const newTrip: Trip = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        totalDistance: route.totalDistance,
        totalDuration: route.totalDuration,
        costPerKm: finalPrice,
        totalAmount: totalAmount,
        locations: locations,
        routeSummary: locations.map(l => l.name).join(' -> ')
      };

      StorageService.saveTrip(newTrip);
      onOpenHistory();
      setLocations([]);
    }
  };

  // --- Redesigned UI ---

  const SidebarFooter = () => (
    <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
      {/* Route Info if optimized */}
      {route && (
        <div className="mb-3 flex justify-between items-center text-sm font-medium text-gray-700 bg-gray-50 p-2 rounded-lg">
          <div className="flex items-center gap-1">
            <Navigation size={14} className="text-emerald-600" />
            <span>{formatDistance(route.totalDistance)}</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle size={14} className="text-emerald-600" />
            <span>{formatDuration(route.totalDuration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calculator size={14} className="text-emerald-600" />
            <span>{formatCurrency(route.totalAmount)}</span>
          </div>
        </div>
      )}

      {/* Main Actions */}
      <div className="grid grid-cols-2 gap-3">
        {(!route && locations.length >= 2) ? (
          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            className="col-span-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isOptimizing ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Calculando...
              </>
            ) : (
              <>
                <MapIcon size={20} />
                Otimizar Rota
              </>
            )}
          </button>
        ) : route ? (
          <>
            <button
              onClick={setRoundTrip ? () => setRoundTrip(!roundTrip) : undefined}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${roundTrip
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 text-gray-500 hover:border-emerald-300'
                }`}
            >
              <span className="text-xs font-bold">Ida e Volta</span>
              <span className="text-[10px]">{roundTrip ? 'ATIVADO' : 'DESATIVADO'}</span>
            </button>

            <button
              onClick={onToggleAvoidDirt}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${avoidDirt
                ? 'border-amber-600 bg-amber-50 text-amber-700'
                : 'border-gray-200 text-gray-500 hover:border-amber-300'
                }`}
            >
              <span className="text-xs font-bold">Evitar Terra</span>
              <span className="text-[10px]">{avoidDirt ? 'ATIVADO' : 'DESATIVADO'}</span>
            </button>

            <button
              onClick={openNavigation}
              className="col-span-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              <Navigation size={20} />
              Iniciar Navegação
            </button>

            <button
              onClick={handleFinishTrip}
              className="col-span-2 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Check size={16} />
              Finalizar Viagem
            </button>
          </>
        ) : (
          <div className="col-span-2 text-center text-gray-400 text-sm py-2">
            Adicione pelo menos 2 locais para traçar rota.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 shadow-xl w-full border-r border-gray-200 font-sans">

      {/* Header - Compact & Premium Look */}
      <div className="p-3 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-100 p-1.5 rounded-lg">
            <Navigation className="h-5 w-5 text-emerald-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">RotaLimpa</h1>
        </div>

        <div className="flex gap-1">
          <button onClick={onOpenHelp} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-600 rounded-full transition-colors" title="Ajuda">
            <CheckCircle size={18} />
          </button>
          <button onClick={onOpenHistory} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-full transition-colors" title="Histórico">
            <FileText size={18} />
          </button>
          <button onClick={onOpenSettings} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-full transition-colors" title="Configurações">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto relative scroll-smooth">
        <div className="p-4 space-y-5">

          {/* Search Section */}
          <div className="space-y-2 relative z-50" ref={searchContainerRef}>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar endereço (Rua, Número, Cidade)"
                className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent"></div>
                </div>
              )}
            </div>

            {/* Search Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-[100] max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => addLocation(result)}
                    className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-start gap-3 transition-colors"
                  >
                    <MapPin size={16} className="mt-1 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{result.name.split(',')[0]}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{result.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleUseCurrentLocation}
              disabled={isLoadingLocation}
              className="w-full py-2.5 px-3 bg-white text-emerald-700 border border-emerald-100 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-50 hover:shadow-sm transition-all disabled:opacity-50"
            >
              {isLoadingLocation ? <Loader2 className="animate-spin" size={16} /> : <Locate size={16} />}
              Usar Minha Localização
            </button>

            {/* Premium Badge */}
            {!isPremium && (
              <div
                onClick={onUpgradeClick}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl text-white shadow-md cursor-pointer hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide">Seja Premium</span>
                    <span className="text-[10px] text-gray-400 leading-tight">Desbloqueie todos os recursos</span>
                  </div>
                </div>
                <ExternalLink size={14} className="text-gray-400" />
              </div>
            )}

          </div>

          {/* Locations List */}
          {/* Locations List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1">
                Paradas ({locations.length})
              </h2>
              {locations.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Limpar todas as paradas?")) setLocations([]);
                  }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline transition-all"
                >
                  LIMPAR TUDO
                </button>
              )}
            </div>

            {locations.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <MapPinOff className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-sm text-gray-500 font-medium">Nenhuma parada adicionada</p>
                <p className="text-xs text-gray-400 mt-1">Busque um endereço acima para começar.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {locations.map((loc, index) => (
                  <LocationItem
                    key={index}
                    loc={loc}
                    index={index}
                    isLast={index === locations.length - 1}
                    onRemove={() => removeLocation(index)}
                    isFirst={index === 0}
                    onUpdate={(newLoc) => updateLocation(index, newLoc)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <SidebarFooter />

    </div>
  );
};

export default Sidebar;
