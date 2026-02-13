import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { X, Check, Eye, EyeOff } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [orsKey, setOrsKey] = useState('');
    const [useORS, setUseORS] = useState(false);
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setOrsKey(StorageService.getORSKey());
            setUseORS(StorageService.getUseORS());
        }
    }, [isOpen]);

    const handleSave = () => {
        StorageService.setORSKey(orsKey);
        StorageService.setUseORS(useORS);
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

                <div className="space-y-6">

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
