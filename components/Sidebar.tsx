
import React, { useState, useEffect, useRef } from 'react';
import { getGoogleMapsUrl, openWazeLink } from '../services/NavigationService';
import { Location, OptimizedRoute, Trip } from '../types';
import { searchLocation, getReverseGeocoding } from '../services/api';
import { StorageService } from '../services/storage';
import { MapPin, Navigation, Search, AlertTriangle, Star, Check, Trash2, Code, Calculator, Map as MapIcon, Loader2, Home, X, ExternalLink, Locate, Settings, FileText, Pencil, CheckCircle, MapPinOff, Truck, Car, Fuel, Wrench, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
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
  // --- Advanced Inputs State ---
  const [vehicleType, setVehicleType] = useState<'Fiorino' | 'Van' | 'Caminhão'>('Fiorino');
  const [fuelType, setFuelType] = useState<'Gasolina' | 'Diesel' | 'Etanol'>('Gasolina');
  const [fuelPrice, setFuelPrice] = useState<number | ''>(5.89); // Default Gasolina
  const [consumption, setConsumption] = useState<number | ''>(10); // Default Fiorino
  // Maintenance removed as per request
  const [freightPrice, setFreightPrice] = useState<number | ''>(2.500); // R$/km charged (3 decimals)
  const [showCostInputs, setShowCostInputs] = useState(false);

  // Trip Finish State
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [realKm, setRealKm] = useState<number | ''>(0);

  // Auto-fill defaults when vehicle changes
  useEffect(() => {
    switch (vehicleType) {
      case 'Fiorino':
        setConsumption(10); // km/L
        setFuelType('Gasolina');
        setFuelPrice(5.89);
        setFreightPrice(2.500);
        break;
      case 'Van':
        setConsumption(8); // km/L
        setFuelType('Diesel');
        setFuelPrice(6.19);
        setFreightPrice(3.500);
        break;
      case 'Caminhão':
        setConsumption(4); // km/L
        setFuelType('Diesel');
        setFuelPrice(6.19);
        setFreightPrice(6.000);
        break;
    }
  }, [vehicleType]);

  // Auto-set Real KM estimate when route changes
  useEffect(() => {
    if (route) {
      setRealKm(parseFloat((route.totalDistance / 1000).toFixed(1)));
    }
  }, [route]);

  // Auto-calculate total freight logic removed (now direct calculation)

  // Calculate Financials (Estimated)
  const calculateFinancials = () => {
    if (!route) return null;
    const distanceKm = route.totalDistance / 1000;

    const cons = typeof consumption === 'number' ? consumption : 1; // Prevent div by zero
    const fPrice = typeof fuelPrice === 'number' ? fuelPrice : 0;
    const frPrice = typeof freightPrice === 'number' ? freightPrice : 0;

    const fuelCostTotal = (distanceKm / cons) * fPrice;

    // Calculate based on ESTIMATED distance
    const grossIncome = distanceKm * frPrice;

    const netProfit = grossIncome - fuelCostTotal;

    return {
      distanceKm,
      fuelCostTotal,
      grossIncome,
      netProfit
    };
  };
  // Removed BulkImport/OCR state as per request

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

  // --- Report Generation ---
  const handleCopyReport = () => {
    if (!route) return;

    // Calculate Final Values based on REAL KM
    const fuelCostFinal = ((typeof realKm === 'number' ? realKm : 0) / (typeof consumption === 'number' ? consumption : 1)) * (typeof fuelPrice === 'number' ? fuelPrice : 0);
    const grossIncomeFinal = (typeof realKm === 'number' ? realKm : 0) * (typeof freightPrice === 'number' ? freightPrice : 0);
    const netProfitFinal = grossIncomeFinal - fuelCostFinal;

    const reportText = `
🚛 *RELATÓRIO DE VIAGEM - ${new Date().toLocaleDateString()}*

📍 *Rota:* ${locations[0].name} ➝ ${locations[locations.length - 1].name}
🛣️ *Distância Real:* ${(typeof realKm === 'number' ? realKm : 0).toFixed(1)} km
⛽ *Veículo:* ${vehicleType} (${fuelType})

💰 *RESUMO FINANCEIRO:*
💵 *Valor a Receber:* R$ ${grossIncomeFinal.toFixed(2)}
⛽ *Custo Combustível:* R$ ${fuelCostFinal.toFixed(2)}
✅ *Lucro Líquido:* R$ ${netProfitFinal.toFixed(2)}

*Gerado por RotaLimpa*
    `.trim();

    navigator.clipboard.writeText(reportText);
    alert("Relatório copiado! Cole no WhatsApp.");
  };

  const confirmFinishTrip = () => {
    // Save to History using Real Values
    const fuelCostFinal = ((typeof realKm === 'number' ? realKm : 0) / (typeof consumption === 'number' ? consumption : 1)) * (typeof fuelPrice === 'number' ? fuelPrice : 0);
    const grossIncomeFinal = (typeof realKm === 'number' ? realKm : 0) * (typeof freightPrice === 'number' ? freightPrice : 0);

    const newTrip: Trip = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      totalDistance: (typeof realKm === 'number' ? realKm : 0) * 1000, // Convert back to meters for storage consistency
      totalDuration: route!.totalDuration,
      costPerKm: (typeof freightPrice === 'number' ? freightPrice : 0),
      totalAmount: grossIncomeFinal,
      locations: locations,
      routeSummary: `${locations[0].name} -> ${locations[locations.length - 1].name}`
    };

    StorageService.saveTrip(newTrip);
    onOpenHistory();
    setLocations([]);
    // setRoute(null); // Assuming setRoute is available from parent or context
    setShowFinishModal(false);
  };

  const handleFinishTrip = () => {
    if (!route || locations.length < 2) {
      alert("Não há uma rota ativa para finalizar.");
      return;
    }
    setShowFinishModal(true);
  };

  // --- Redesigned UI ---

  const SidebarFooter = () => (
    <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
      {/* Route Info if optimized */}
      {route && (
        <div className="mb-3 space-y-2">
          {/* Standard Metrics */}
          <div className="flex justify-between items-center text-sm font-medium text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <div className="flex items-center gap-1">
              <Navigation size={14} className="text-emerald-600" />
              <span>{formatDistance(route.totalDistance)}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle size={14} className="text-emerald-600" />
              <span>{formatDuration(route.totalDuration)}</span>
            </div>
            {/* Shows Gross Income */}
            <div className="flex items-center gap-1 font-bold text-emerald-700">
              <Calculator size={14} />
              <span>{(() => {
                const financials = calculateFinancials();
                return formatCurrency(financials ? financials.grossIncome : 0);
              })()}</span>
            </div>
          </div>

          {/* Financial Breakdown (Profit) */}
          {(() => {
            const financials = calculateFinancials();
            if (financials) {
              return (
                <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="text-gray-500 flex justify-between">
                    <span>Combustível (Est.):</span>
                    <span className="font-semibold text-red-400">-{formatCurrency(financials.fuelCostTotal)}</span>
                  </div>
                  <div className="text-gray-500 flex justify-between">
                    <span>Lucro Bruto:</span>
                    {/* Just show gross for clarity if needed, or skip */}
                    <span className="font-semibold text-gray-700">{formatCurrency(financials.grossIncome)}</span>
                  </div>
                  <div className="col-span-2 pt-1 mt-1 border-t border-gray-200 flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-600">Lucro Previsto:</span>
                    <span className="font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                      {formatCurrency(financials.netProfit)}
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}
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
            {/* Re-optimize Button */}
            <button
              onClick={onOptimize}
              disabled={isOptimizing}
              className="col-span-2 w-full py-2 bg-emerald-100/50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 mb-1"
            >
              <Loader2 size={16} className={isOptimizing ? "animate-spin" : ""} />
              {isOptimizing ? "Recalculando..." : "Recalcular / Otimizar Novamente"}
            </button>

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
    <>
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

              {/* --- Advanced Inputs Section --- */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowCostInputs(!showCostInputs)}
                  className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <Truck size={16} className="text-emerald-600" />
                    Veículo & Custos
                  </div>
                  {showCostInputs ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>

                {showCostInputs && (
                  <div className="p-3 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Vehicle Type */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Veículo</label>
                        <div className="relative">
                          <select
                            value={vehicleType}
                            onChange={(e) => setVehicleType(e.target.value as any)}
                            className="w-full p-2 pl-8 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none font-medium"
                          >
                            <option value="Fiorino">Fiorino</option>
                            <option value="Van">Van</option>
                            <option value="Caminhão">Caminhão</option>
                          </select>
                          <Truck size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Combustível</label>
                        <div className="relative">
                          <select
                            value={fuelType}
                            onChange={(e) => setFuelType(e.target.value as any)}
                            className="w-full p-2 pl-8 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none font-medium"
                          >
                            <option value="Gasolina">Gasolina</option>
                            <option value="Diesel">Diesel</option>
                            <option value="Etanol">Etanol</option>
                          </select>
                          <Fuel size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Costs Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Consumption */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Consumo (km/L)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={consumption}
                            onChange={(e) => setConsumption(parseFloat(e.target.value) || '')}
                            className="w-full p-2 pl-7 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                          <div className="absolute left-2.5 top-2.5 text-xs text-gray-400 font-bold">km</div>
                        </div>
                      </div>

                      {/* Fuel Price */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Preço (R$/L)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={fuelPrice}
                            onChange={(e) => setFuelPrice(parseFloat(e.target.value) || '')}
                            className="w-full p-2 pl-7 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                          <div className="absolute left-2.5 top-2.5 text-xs text-gray-400 font-bold">R$</div>
                        </div>
                      </div>

                      {/* Freight Price (Per KM) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Valor Frete (R$/km)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.001"
                            value={freightPrice}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setFreightPrice(isNaN(val) ? '' : val);
                            }}
                            className="w-full p-2 pl-7 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                          <div className="absolute left-2.5 top-2.5 text-xs text-gray-400 font-bold">R$</div>
                        </div>
                      </div>

                      {/* Total Freight (Calculated/Manual) - Only show if route exists for context? Or always? */}
                      {/* Let's show it always, but it might be 0 if no route */}
                      {/* Total Freight (Calculated - Read Only) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-emerald-600 uppercase">Valor a Receber</label>
                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            value={route ? formatCurrency((route.totalDistance / 1000) * (typeof freightPrice === 'number' ? freightPrice : 0)) : 'R$ 0,00'}
                            className="w-full p-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg outline-none cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* --- End Advanced Inputs --- */}
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

      {/* Trip Finish Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-4 text-white text-center">
              <CheckCircle size={32} className="mx-auto mb-2 opacity-90" />
              <h3 className="font-bold text-lg">Finalizar Viagem</h3>
              <p className="text-emerald-100 text-xs">Confirme os dados reais para o relatório</p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KM Real Rodado</label>
                <p className="text-xs text-gray-500 mb-2">O sistema estimou {route ? (route.totalDistance / 1000).toFixed(1) : 0} km. Insira o valor do hodômetro.</p>
                <div className="relative">
                  <input
                    type="number"
                    value={realKm}
                    onChange={(e) => setRealKm(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                  />
                  <div className="absolute left-3 top-3.5 text-gray-400 font-bold">KM</div>
                </div>
              </div>

              {/* Live Calculation Preview */}
              {(() => {
                const rKm = typeof realKm === 'number' ? realKm : 0;
                const cons = typeof consumption === 'number' ? consumption : 1;
                const fPrice = typeof fuelPrice === 'number' ? fuelPrice : 0;
                const frPrice = typeof freightPrice === 'number' ? freightPrice : 0;
                const fuelCost = (rKm / cons) * fPrice;
                const income = rKm * frPrice;
                const profit = income - fuelCost;

                return (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor a Receber:</span>
                      <span className="font-bold text-emerald-700">
                        {formatCurrency(income)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Custo Combustível:</span>
                      <span className="font-bold text-red-500">
                        -{formatCurrency(fuelCost)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between font-bold">
                      <span>Lucro Real:</span>
                      <span className="text-emerald-600">
                        {formatCurrency(profit)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCopyReport}
                  className="flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                >
                  <FileText size={18} />
                  Relatório
                </button>
                <button
                  onClick={confirmFinishTrip}
                  className="flex items-center justify-center gap-2 p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold shadow-md transition-all active:scale-95"
                >
                  <Check size={18} />
                  Concluir
                </button>
              </div>

              <button
                onClick={() => setShowFinishModal(false)}
                className="w-full text-center text-gray-400 text-sm mt-2 hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
