
import React, { useState, useEffect, useRef } from 'react';
import { Location, OptimizedRoute } from '../types';
import { searchLocation, getReverseGeocoding } from '../services/api';
import { MapPin, Navigation, Search, AlertTriangle, Star, Check, Trash2, Code, Calculator, Map as MapIcon, Loader2, Home, X, ExternalLink, Locate } from 'lucide-react';
import { MAX_FREE_STOPS } from '../constants';

interface SidebarProps {
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  isPremium: boolean;
  onOptimize: () => void;
  isOptimizing: boolean;
  route: OptimizedRoute | null;
  onUpgradeClick: () => void;
  onShowDevCode: () => void;
  onStartNavigation: () => void; // Mantido para compatibilidade, mas não usado internamente
  isNavigating: boolean;
  avoidDirt: boolean;
  onToggleAvoidDirt: () => void;
  roundTrip: boolean;
  onToggleRoundTrip: () => void;
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
  avoidDirt,
  onToggleAvoidDirt,
  roundTrip,
  onToggleRoundTrip,
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Freight Calculation State
  const [freightPricePerKm, setFreightPricePerKm] = useState<string>(() => {
    return localStorage.getItem('freightPricePerKm') || '';
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
          if (!isPremium && locations.length >= MAX_FREE_STOPS) {
            alert(`Versão gratuita cheia. Remova uma cidade ou atualize.`);
          } else {
            setLocations(prev => [locationData, ...prev]);
          }
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
    if (!isPremium && locations.length >= MAX_FREE_STOPS) {
      alert(`Versão gratuita limitada a ${MAX_FREE_STOPS} paradas. Atualize para Premium!`);
      onUpgradeClick();
      return;
    }
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

  // --- External GPS Logic ---
  const openExternalGPS = (app: 'google' | 'waze') => {
    if (!route || route.waypoints.length < 2) return;

    const origin = route.waypoints[0];
    const destination = route.waypoints[route.waypoints.length - 1];
    const waypoints = route.waypoints.slice(1, -1); // Intermediate stops

    if (app === 'google') {
      // Google Maps URL Scheme
      const originStr = `${origin.lat},${origin.lng}`;
      const destStr = `${destination.lat},${destination.lng}`;
      const waypointsStr = waypoints.map(w => `${w.lat},${w.lng}`).join('|');

      let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;
      if (waypoints.length > 0) {
        url += `&waypoints=${waypointsStr}`;
      }
      window.open(url, '_blank');
    } else if (app === 'waze') {
      if (waypoints.length > 0) {
        alert("Aviso: O Waze pode não respeitar as paradas intermediárias (waypoints) via link direto. Para garantir a rota exata evitando terra, recomendamos o Google Maps.");
      }
      const url = `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
      window.open(url, '_blank');
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
        <div className="flex gap-2">
          <button onClick={onShowDevCode} className="p-1 hover:bg-emerald-700 rounded" title="Ver Código Backend">
            <Code size={18} />
          </button>
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
            {query.length > 3 && (
              <button
                onClick={handleManualAdd}
                className="absolute right-10 top-3 text-emerald-600 hover:text-emerald-800 font-bold text-sm bg-white px-2"
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
            <ul className="space-y-2 relative">
              {/* Show connector line behind items */}
              {locations.length > 1 && (
                <div className="absolute left-[1.65rem] top-4 bottom-4 w-0.5 bg-gray-300 -z-0"></div>
              )}

              {(route ? route.waypoints : locations).map((loc, idx) => (
                <li key={idx} className={`relative p-3 rounded-md flex justify-between items-center shadow-sm z-10 ${idx === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-200'}`}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                      {idx + 1}
                    </span>
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate text-sm font-medium text-gray-800">{loc.name}</span>
                      {/* Display City context for stops */}
                      {loc.address?.city && (
                        <span className="text-[10px] text-gray-500 truncate">{loc.address.city}, {loc.address.state}</span>
                      )}
                      {idx === 0 && <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-0.5">Partida</span>}
                    </div>
                  </div>
                  {!route && (
                    <button onClick={() => removeLocation(idx)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
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

                {route.tollDetails && route.tollDetails.length > 0 ? (
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {route.tollDetails.map((toll, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex flex-col border-b border-gray-50 pb-2 last:border-0 hover:bg-gray-50 p-1 rounded transition-colors">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-gray-800">{toll.name || "Pedágio identificado"}</span>
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
                ) : (
                  <span className="text-xs text-gray-400 italic">Nenhum pedágio identificado nesta rota.</span>
                )}
              </div>
            </div>

            {/* Freight Calculator */}
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-3">
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
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-bold text-gray-800"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-md flex justify-between items-center">
                <span className="text-sm text-emerald-800 font-medium">Frete Total Estimado</span>
                <span className="text-lg font-bold text-emerald-700">
                  {freightPricePerKm && !isNaN(parseFloat(freightPricePerKm))
                    ? formatCurrency((route.totalDistance / 1000) * parseFloat(freightPricePerKm))
                    : 'R$ --'}
                </span>
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
      </div>

      {/* Footer / Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0">
        {!route ? (
          <div className="space-y-3">
            {/* Options */}
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full ${avoidDirt ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                  <div className="h-4 w-4 flex items-center justify-center font-bold text-xs">
                    {avoidDirt ? <Check size={12} /> : <X size={12} />}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700">Evitar Estrada de Terra</span>
                  <span className="text-[10px] text-gray-400 leading-tight">Priorizar asfalto (pode aumentar a distância)</span>
                </div>
              </div>
              <button
                onClick={onToggleAvoidDirt}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${avoidDirt ? 'bg-emerald-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${avoidDirt ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Round Trip Option */}
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full ${roundTrip ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                  <div className="h-4 w-4 flex items-center justify-center font-bold text-xs">
                    {roundTrip ? <Navigation size={12} className="rotate-180" /> : <X size={12} />}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700">Ida e Volta</span>
                  <span className="text-[10px] text-gray-400 leading-tight">Retornar ao início</span>
                </div>
              </div>
              <button
                onClick={onToggleRoundTrip}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${roundTrip ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${roundTrip ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <button
              onClick={onOptimize}
              disabled={locations.length < 2 || isOptimizing}
              className={`w-full py-3 rounded-lg text-white font-bold text-lg shadow-lg flex justify-center items-center gap-2 transition-all ${locations.length < 2
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:transform active:scale-95'
                }`}
            >
              {isOptimizing ? (
                <span className="animate-pulse">Calculando...</span>
              ) : (
                <>
                  <Navigation size={20} /> Otimizar Rota
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Iniciar Navegação GPS</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => openExternalGPS('google')}
                  className="py-3 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex justify-center items-center gap-2 active:transform active:scale-95"
                >
                  <MapIcon size={18} /> Google Maps
                </button>
                <button
                  onClick={() => openExternalGPS('waze')}
                  className="py-3 px-2 rounded-lg bg-cyan-400 hover:bg-cyan-500 text-white font-bold text-sm shadow-md flex justify-center items-center gap-2 active:transform active:scale-95"
                >
                  <ExternalLink size={18} /> Waze
                </button>
              </div>
            </div>

            <button
              onClick={() => setLocations([])} // Reset
              className="w-full py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium mt-2"
            >
              Nova Rota
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
