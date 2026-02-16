
import React, { useState, useEffect, useRef } from 'react';
import { Location, OptimizedRoute, Trip } from '../types';
import { searchLocation, getReverseGeocoding } from '../services/api';
import { StorageService } from '../services/storage';
import { MapPin, Navigation, Search, AlertTriangle, Star, Check, Trash2, Code, Calculator, Map as MapIcon, Loader2, Home, X, ExternalLink, Locate, Settings, FileText, Pencil, CheckCircle } from 'lucide-react';
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
    if (!locations || locations.length < 2) return;

    // Filter valid locations
    const validLocs = locations.filter(l => l.lat && l.lng);
    if (validLocs.length < 2) return;

    const origin = validLocs[0];
    const destination = validLocs[validLocs.length - 1];
    const waypoints = validLocs.slice(1, -1);

    // Google Maps URL Scheme with Fidelity (originalLat/Lng)
    const formatCoord = (l: Location) => `${l.originalLat || l.lat},${l.originalLng || l.lng}`;

    const originStr = formatCoord(origin);
    const destStr = formatCoord(destination);
    const waypointsStr = waypoints.map(formatCoord).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;
    if (waypoints.length > 0) {
      url += `&waypoints=${waypointsStr}`;
    }
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

  return (
    <div className="flex flex-col h-full bg-white shadow-xl w-full border-r border-gray-200">

      {/* Header */}
      <div className="p-4 bg-emerald-600 text-white flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-2">
          <Navigation className="h-6 w-6" />
          <h1 className="text-xl font-bold tracking-tight">RotaLimpa</h1>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={onOpenHistory} className="p-1.5 hover:bg-emerald-700 rounded transition-colors" title="Histórico">
            <FileText size={18} />
          </button>
          <button onClick={onOpenSettings} className="p-1.5 hover:bg-emerald-700 rounded transition-colors" title="Configurações">
            <Settings size={18} />
          </button>
          {/* Features Removed as per request (Bulk Import & Camera) */}

          {isPremium ? (
            <span className="bg-yellow-400 text-emerald-900 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <Star size={12} fill="currentColor" /> PRO
            </span>
          ) : (
            <button
              onClick={onUpgradeClick}
              className="text-xs bg-gray-900 hover:bg-gray-800 text-white px-2 py-1 rounded transition"
            >
              Seja Premium
            </button>
          )}
        </div>
      </div>

      {/* Main Content Scroll */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative">

        {/* Search Input Area */}
        <div className="space-y-3 relative z-50" ref={searchContainerRef}>
          <label className="text-sm font-medium text-gray-700">Planejar Viagem</label>

          <button
            onClick={handleUseCurrentLocation}
            disabled={isLoadingLocation || (!!route)}
            className="w-full py-2 px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors disabled:opacity-50 mb-2"
          >
            {isLoadingLocation ? <Loader2 className="animate-spin h-4 w-4" /> : <Locate className="h-4 w-4" />}
            Partir da Minha Localização
          </button>

          <div className="relative">
            <div className="relative flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                placeholder="Digite o endereço (Rua, Número, Cidade)..."
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-sm shadow-sm"
                disabled={!!route}
                autoComplete="off"
              />
              <div className="absolute left-3 top-3 text-gray-400">
                {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search className="h-5 w-5" />}
              </div>
              {query && (
                <button
                  onClick={() => { setQuery(''); setSearchResults([]); setShowDropdown(false); }}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Manual Add Button (visible when query exists) */}
            {/* Manual Add Button (visible when query exists) */}
            {query.length > 3 && (
              <button
                onClick={handleManualAdd}
                className="absolute right-3 top-2.5 text-emerald-600 hover:text-emerald-800 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md transition-colors"
              >
                ADICIONAR
              </button>
            )}

            {/* Autocomplete Dropdown */}
            {showDropdown && (searchResults.length > 0 || isSearching) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-[100] max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                {isSearching && searchResults.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Buscando endereços...
                  </div>
                )}

                {!isSearching && searchResults.length === 0 && query.length > 2 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Nenhum endereço encontrado. Tente simplificar.
                  </div>
                )}

                {searchResults.map((loc, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(loc.name);
                      setSearchResults([]);
                      // Do NOT add immediately. Let user edit.
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 cursor-pointer flex items-start gap-3 transition-colors border-b border-gray-50 last:border-0 group"
                  >
                    <div className="bg-gray-100 group-hover:bg-white group-hover:text-emerald-600 p-2.5 rounded-full shrink-0 text-gray-500 mt-0.5 transition-colors">
                      {loc.address?.number ? <Home size={18} /> : <MapPin size={18} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-gray-800 text-sm break-words group-hover:text-emerald-700">
                        {loc.name}
                      </span>
                      <span className="text-xs text-gray-500 break-words leading-tight mt-0.5">
                        {[
                          loc.address?.street !== loc.name ? loc.address?.street : null,
                          loc.address?.city,
                          loc.address?.state
                        ].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                  </button>
                ))}

                <div className="bg-gray-50 p-2 text-center text-[10px] text-gray-400 border-t border-gray-100 uppercase tracking-wider">
                  Resultados via OpenStreetMap
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location List */}
        <div className="space-y-2 z-0">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <MapPin size={16} /> Paradas
              <span className="text-xs font-normal text-gray-500">
                ({locations.length} / {isPremium ? '∞' : MAX_FREE_STOPS})
              </span>
            </h3>
            {locations.length > 0 && !route && (
              <button onClick={() => setLocations([])} className="text-xs text-red-500 hover:text-red-700">Limpar</button>
            )}
          </div>

          {locations.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
              <p className="text-gray-400 text-xs">Adicione endereços completos com número.</p>
            </div>
          ) : (
            <ul className="space-y-3 relative p-1 custom-scrollbar pb-20">
              {locations.map((loc, index) => (
                <LocationItem
                  key={index}
                  loc={loc}
                  index={index}
                  isLast={index === locations.length - 1}
                  isFirst={index === 0}
                  onRemove={() => removeLocation(index)}
                  onUpdate={(newLoc) => {
                    const newLocs = [...locations];
                    newLocs[index] = newLoc;
                    setLocations(newLocs);
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Route Details & Freight Calculator */}
        {route && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
            {/* Summary Card */}
            <div className="bg-slate-800 text-white p-4 rounded-lg space-y-3">
              <h3 className="font-bold border-b border-slate-600 pb-2">Resumo da Rota</h3>
              <div className="flex justify-between items-center bg-emerald-50 p-2 rounded border border-emerald-100 mb-2">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">Distância Total</span>
                  <span className="font-bold text-emerald-800 text-lg">{(route.totalDistance / 1000).toFixed(1)} km</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500">Tempo Estimado</span>
                  <span className="font-bold text-emerald-800 text-lg">{formatDuration(route.totalDuration)}</span>
                </div>
              </div>

              {/* Route Type Indicators & Legend */}
              <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm mb-2">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-700">Detalhes do Terreno</span>
                  {avoidDirt ? (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200">Modo: Evitar Terra</span>
                  ) : (
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">Modo: Padrão</span>
                  )}
                </div>

                {/* Warning if dirt is still present */}
                {route.segments.some(s => s.type === 'unpaved') ? (
                  <div className="flex items-start gap-2 bg-yellow-50 p-2 rounded text-yellow-800 text-xs mb-2 border border-yellow-100">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      <b>Atenção:</b> Mesmo evitando, esta rota possui trechos identificados como terra/não pavimentados.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-700 text-xs mb-2 px-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span>Rota 100% Pavimentada (Estimado)</span>
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] text-gray-500 bg-gray-50 p-1.5 rounded">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-1 bg-blue-500 rounded"></div>
                    <span>Asfalto</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-1 border-b-2 border-dashed border-red-500"></div>
                    <span>Terra/Chão</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Toll Identification */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm border-b border-gray-100 pb-2">
                <span className="bg-orange-100 text-orange-600 p-1 rounded"><AlertTriangle size={14} /></span>
                Pedágios Identificados
              </div>

              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 text-xs font-bold">Quantidade:</span>
                  <span className="text-sm font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{route.tollCount}</span>
                </div>

                {/* Toll List - Freemium Lock */}
                {route.tollDetails && route.tollDetails.length > 0 ? (
                  <div className="relative">
                    {!isPremium && (
                      <div className="absolute inset-0 z-10 bg-white/10 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="bg-gray-900/90 text-white text-xs p-2 rounded shadow-lg text-center">
                          <p className="font-bold mb-1">Detalhes Bloqueados</p>
                          <button onClick={onUpgradeClick} className="bg-emerald-500 hover:bg-emerald-600 px-2 py-1 rounded font-bold text-[10px] transition">
                            Ver Onde Pagar
                          </button>
                        </div>
                      </div>
                    )}
                    <ul className={`space-y-2 max-h-60 overflow-y-auto pr-1 ${!isPremium ? 'opacity-50 select-none pointer-events-none' : ''}`}>
                      {route.tollDetails.map((toll, idx) => (
                        <li key={idx} className="text-xs text-slate-700 flex flex-col border-b border-gray-50 pb-2 last:border-0 hover:bg-gray-50 p-1 rounded transition-colors">
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-gray-800">{toll.name || "Pedágio Identificado"}</span>
                          </div>

                          {toll.operator && (
                            <span className="text-[10px] text-gray-400 mt-0.5">Op: {toll.operator}</span>
                          )}

                          {toll.nearbyLocation && (
                            <div className="flex items-center gap-1 mt-1 text-emerald-600 font-medium">
                              <MapIcon size={10} />
                              <span className="text-[10px]">{toll.nearbyLocation}</span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">Nenhum pedágio identificado nesta rota.</span>
                )}
              </div>
            </div>

            {/* Freight Calculator */}
            {/* Freight Calculator */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-3 relative overflow-hidden">
              {!isPremium && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-center p-4">
                  <div className="bg-white p-3 rounded-full shadow-lg mb-2">
                    <Calculator className="text-emerald-600" size={20} />
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm">Calculadora de Frete</h4>
                  <p className="text-[10px] text-gray-500 mb-2">Calcule seus ganhos automaticamente.</p>
                  <button onClick={onUpgradeClick} className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-black transition">
                    Desbloquear
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm border-b border-gray-100 pb-2">
                <Calculator size={16} /> Calculadora de Frete
              </div>

              <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded">
                O valor é calculado sobre a <strong>distância total planejada</strong> da rota. Não se altera automaticamente durante o trajeto.
              </p>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Valor por KM (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">R$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.10"
                    placeholder="0,00"
                    value={freightPricePerKm}
                    onChange={(e) => {
                      setFreightPricePerKm(e.target.value);
                      localStorage.setItem('freightPricePerKm', e.target.value);
                    }}
                    disabled={!isPremium}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-bold text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-md flex justify-between items-center mb-4">
                <span className="text-sm text-emerald-800 font-medium">Frete Total Estimado</span>
                <span className="text-lg font-bold text-emerald-700">
                  {freightPricePerKm && !isNaN(parseFloat(freightPricePerKm))
                    ? formatCurrency((route.totalDistance / 1000) * parseFloat(freightPricePerKm))
                    : 'R$ --'}
                </span>
              </div>

              {/* Fuel & Profit Calculator */}
              <div className="relative pt-4 border-t border-dashed border-gray-200">
                {!isPremium && (
                  <div className="absolute inset-x-0 -bottom-2 top-0 bg-white/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-center p-2">
                    <span className="text-xs font-bold text-gray-500 mb-1">Calculadora de Lucro Líquido</span>
                    <button onClick={onUpgradeClick} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-2 py-1 rounded font-bold transition">
                      Desbloquear
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-1">Consumo (km/L)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="Ex: 10"
                      value={fuelConsumption}
                      onChange={(e) => {
                        setFuelConsumption(e.target.value);
                        localStorage.setItem('fuelConsumption', e.target.value);
                      }}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-1">Preço Combustível (R$)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="Ex: 5.50"
                      value={fuelPrice}
                      onChange={(e) => {
                        setFuelPrice(e.target.value);
                        localStorage.setItem('fuelPrice', e.target.value);
                      }}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {(fuelConsumption && fuelPrice && !isNaN(parseFloat(fuelConsumption)) && !isNaN(parseFloat(fuelPrice))) && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-red-600">
                      <span>Custo Combustível:</span>
                      <span className="font-bold">
                        {formatCurrency(((route.totalDistance / 1000) / parseFloat(fuelConsumption)) * parseFloat(fuelPrice))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100">
                      <span className="font-bold">Lucro Líquido Estimado:</span>
                      <span className="font-bold text-lg">
                        {freightPricePerKm && !isNaN(parseFloat(freightPricePerKm))
                          ? formatCurrency(
                            ((route.totalDistance / 1000) * parseFloat(freightPricePerKm)) -
                            (((route.totalDistance / 1000) / parseFloat(fuelConsumption)) * parseFloat(fuelPrice))
                          )
                          : 'R$ --'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Warnings */}
            {!isPremium && (
              <div className="bg-amber-900/50 p-2 rounded border border-amber-700 text-xs text-amber-200 flex items-start gap-2 mt-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p>Detecção de estrada de terra oculta. Assine Premium.</p>
              </div>
            )}

            {isPremium && (
              <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2 mt-2">
                <Check size={16} className="shrink-0 mt-0.5" />
                <p>Rota verificada: Trechos de terra identificados.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer / Actions */}
        <div className="p-4 bg-white border-t border-gray-100 space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">

          {/* Main Action Button */}
          <button
            onClick={route ? openNavigation : onOptimize}
            disabled={locations.length < 2 || isOptimizing}
            className={`
              w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]
              ${locations.length < 2
                ? 'bg-gray-300 cursor-not-allowed shadow-none'
                : route
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }
            `}
          >
            {isOptimizing ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Calculando Rota...
              </>
            ) : route ? (
              <>
                <Navigation size={20} /> Navegar (Google Maps)
              </>
            ) : (
              <>
                <MapPin size={20} /> Otimizar Rota
              </>
            )}
          </button>

          {/* Secondary Actions Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Finalizar Serviço */}
            <button
              onClick={handleFinishTrip}
              disabled={!route}
              className={`
                  flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 transition-all
                  ${!route
                  ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                  : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200'
                }
                `}
            >
              <CheckCircle size={16} /> Finalizar
            </button>

            {/* Round Trip Toggle */}
            <button
              onClick={onToggleRoundTrip}
              className={`
                  flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 transition-all
                   ${roundTrip
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }
                `}
            >
              <Calculator size={16} /> {roundTrip ? 'Ida e Volta' : 'Só Ida'}
            </button>
          </div>

          {/* Dirt Road Toggle */}
          <div
            onClick={onToggleAvoidDirt}
            className={`
                flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
                ${avoidDirt
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-100 hover:border-gray-200 bg-gray-50'
              }
              `}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className={avoidDirt ? "text-amber-600" : "text-gray-400"} />
              <span className={`text-sm font-semibold ${avoidDirt ? "text-amber-800" : "text-gray-500"}`}>
                Evitar Estradas de Terra
              </span>
            </div>

            <div className={`w-10 h-5 rounded-full relative transition-colors ${avoidDirt ? "bg-amber-500" : "bg-gray-300"}`}>
              <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${avoidDirt ? "translate-x-5" : "translate-x-0"}`} />
            </div>
          </div>

          {/* Stats Panel (Only if route exists) */}
          {route && (
            <div className="bg-gray-900 text-white rounded-xl p-4 mt-2">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">Distância</p>
                  <p className="text-xl font-bold">{(route.totalDistance / 1000).toFixed(1)} <span className="text-sm text-gray-400">km</span></p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">Tempo</p>
                  <p className="text-xl font-bold">{~~(route.totalDuration / 3600)}h {~~((route.totalDuration % 3600) / 60)}m</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div >
  );
};

export default Sidebar;
