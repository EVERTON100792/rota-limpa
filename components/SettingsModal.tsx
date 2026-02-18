import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { X, Check, Eye, EyeOff, Truck, Settings as SettingsIcon } from 'lucide-react';
import { VehicleConfig } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isPremium?: boolean;
    onUpgrade?: () => void;
    vehicleConfig: VehicleConfig;
    setVehicleConfig: (config: VehicleConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isPremium = false, onUpgrade, vehicleConfig, setVehicleConfig }) => {
    const [orsKey, setOrsKey] = useState('');
    const [useORS, setUseORS] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'veiculo'>('geral');

    // Local state for vehicle config to allow cancel
    const [localVehicleConfig, setLocalVehicleConfig] = useState<VehicleConfig>(vehicleConfig);

    useEffect(() => {
        if (isOpen) {
            setOrsKey(StorageService.getORSKey());
            setUseORS(StorageService.getUseORS());
            setLocalVehicleConfig(vehicleConfig); // Sync on open
        }
    }, [isOpen, vehicleConfig]);

    const handleSave = () => {
        StorageService.setORSKey(orsKey);
        StorageService.setUseORS(useORS);
        setVehicleConfig(localVehicleConfig); // Save vehicle config
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md p-6 relative animate-in zoom-in-95 duration-200">

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-gray-800 mb-1">Configurações</h2>
                <p className="text-sm text-gray-500 mb-6">Personalize sua experiência de roteamento.</p>

                <h2 className="text-xl font-bold text-gray-800 mb-1">Configurações</h2>
                <p className="text-sm text-gray-500 mb-6">Personalize sua experiência de roteamento.</p>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-100 pb-1">
                    <button
                        onClick={() => setActiveTab('geral')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${activeTab === 'geral' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <SettingsIcon size={16} /> Geral
                    </button>
                    <button
                        onClick={() => setActiveTab('veiculo')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${activeTab === 'veiculo' ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Truck size={16} /> Veículo & Custos
                    </button>
                </div>

                <div className="space-y-6 min-h-[300px]">

                    {/* --- GERAL TAB --- */}
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">

                            {/* Premium Status */}
                            <div className={`${isPremium ? 'bg-gradient-to-r from-emerald-900 to-emerald-800' : 'bg-gray-100'} p-4 rounded-xl flex justify-between items-center`}>
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${isPremium ? 'text-emerald-400' : 'text-gray-500'}`}>
                                        Seu Plano
                                    </p>
                                    <p className={`text-lg font-bold ${isPremium ? 'text-white' : 'text-gray-700'}`}>
                                        {isPremium ? 'RotaLimpa Premium' : 'Gratuito'}
                                    </p>
                                </div>
                                {!isPremium && onUpgrade && (
                                    <button
                                        onClick={() => {
                                            onClose();
                                            onUpgrade();
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-lg"
                                    >
                                        FAZER UPGRADE
                                    </button>
                                )}
                            </div>

                            {/* ORS Section */}
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                                <div className="flex justify-between items-start mb-2">
                                    <label className="text-sm font-bold text-emerald-800">
                                        Mode Avançado (OpenRouteService)
                                    </label>
                                    <div className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={useORS}
                                            onChange={(e) => setUseORS(e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </div>
                                </div>

                                <p className="text-[11px] text-emerald-700 leading-tight mb-3">
                                    Ativa o roteamento via OpenRouteService para evitar estradas de terra com precisão superior ao padrão.
                                    Necessário criar uma chave gratuita em <b>openrouteservice.org</b>.
                                </p>

                                <div className={`transition-all duration-300 ${useORS ? 'opacity-100 max-h-24' : 'opacity-50 grayscale max-h-24'}`}>
                                    <label className="text-xs font-semibold text-gray-600 mb-1 block">API Key</label>
                                    <div className="relative">
                                        <input
                                            type={showKey ? "text" : "password"}
                                            value={orsKey}
                                            onChange={(e) => setOrsKey(e.target.value)}
                                            placeholder="Cole sua chave aqui..."
                                            className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            disabled={!useORS}
                                        />
                                        <button
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
                                            disabled={!useORS}
                                        >
                                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* --- VEICULO TAB --- */}
                    {activeTab === 'veiculo' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">

                            {/* Preset Buttons */}
                            <div className="flex gap-2 mb-2">
                                {(['Fiorino', 'Van', 'Caminhão'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            const defaults = {
                                                'Fiorino': { consumption: 10, fuelType: 'Gasolina', fuelPrice: 5.89, freightPrice: 2.50 },
                                                'Van': { consumption: 8, fuelType: 'Diesel', fuelPrice: 6.19, freightPrice: 3.50 },
                                                'Caminhão': { consumption: 4, fuelType: 'Diesel', fuelPrice: 6.19, freightPrice: 6.00 },
                                            }[type];
                                            setLocalVehicleConfig({ ...localVehicleConfig, type, ...defaults } as any);
                                        }}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${localVehicleConfig.type === type
                                            ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-300'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Combustível</label>
                                    <select
                                        value={localVehicleConfig.fuelType}
                                        onChange={(e) => setLocalVehicleConfig({ ...localVehicleConfig, fuelType: e.target.value as any })}
                                        className="w-full p-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                                    >
                                        <option value="Gasolina">Gasolina</option>
                                        <option value="Diesel">Diesel</option>
                                        <option value="Etanol">Etanol</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Consumo (km/L)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={localVehicleConfig.consumption}
                                            onChange={(e) => setLocalVehicleConfig({ ...localVehicleConfig, consumption: parseFloat(e.target.value) || 0 })}
                                            className="w-full p-2.5 pl-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">km/L</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Preço Combustível</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">R$</span>
                                        <input
                                            type="number" step="0.01"
                                            value={localVehicleConfig.fuelPrice}
                                            onChange={(e) => setLocalVehicleConfig({ ...localVehicleConfig, fuelPrice: parseFloat(e.target.value) || 0 })}
                                            className="w-full p-2.5 pl-8 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Valor Frete (R$/km)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">R$</span>
                                        <input
                                            type="number" step="0.01"
                                            value={localVehicleConfig.freightPrice}
                                            onChange={(e) => setLocalVehicleConfig({ ...localVehicleConfig, freightPrice: parseFloat(e.target.value) || 0 })}
                                            className="w-full p-2.5 pl-8 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800">
                                <p>ℹ️ Estes valores serão usados para calcular o lucro estimado e o lucro real nos relatórios.</p>
                            </div>
                        </div>
                    )}

                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-lg hover:bg-emerald-700 hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={16} /> Salvar
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SettingsModal;
