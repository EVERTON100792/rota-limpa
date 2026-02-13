import React, { useState } from 'react';
import { X, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { searchLocation } from '../services/api';
import { Location } from '../types';

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (locations: Location[]) => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    if (!isOpen) return null;

    const handleImport = async () => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
        if (lines.length === 0) {
            alert("Cole uma lista de endereços válida (um por linha).");
            return;
        }

        setIsProcessing(true);
        setProgress({ current: 0, total: lines.length });
        const newLocations: Location[] = [];
        const failures: string[] = [];

        // Rate limit delay helper
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
                // Add a delay to respect Nominatim rate limits (1 req/sec recommended)
                if (i > 0) await delay(1100);

                const results = await searchLocation(line);
                if (results && results.length > 0) {
                    // Use the first result
                    newLocations.push(results[0]);
                } else {
                    failures.push(line);
                }
            } catch (e) {
                console.error(`Failed to geocode: ${line}`, e);
                failures.push(line);
            }
            setProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setIsProcessing(false);

        if (newLocations.length > 0) {
            onImport(newLocations);
            if (failures.length > 0) {
                alert(`Importação concluída com ${newLocations.length} sucessos.\n\nFalha ao encontrar:\n${failures.join('\n')}`);
            } else {
                alert(`Importação concluída! ${newLocations.length} endereços adicionados.`);
            }
            setText('');
            onClose();
        } else {
            alert("Nenhum endereço foi encontrado. Verifique a formatação e tente novamente.");
        }
    };

    return (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-emerald-50">
                    <div className="flex items-center gap-2 text-emerald-800">
                        <Upload size={20} />
                        <h2 className="font-bold text-lg">Importar Endereços</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="p-1 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="mb-4 bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex gap-2 items-start">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <p>
                            Cole sua lista abaixo. <strong>Um endereço por linha.</strong>
                            <br />
                            O sistema buscará automaticamente as coordenadas.
                        </p>
                    </div>

                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={isProcessing}
                        placeholder={`Exemplo:\nRua das Flores, 123, São Paulo\nAv. Paulista, 1000\nMercado Municipal, Curitiba`}
                        className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-mono text-sm"
                    />

                    {isProcessing && (
                        <div className="mt-4 flex items-center gap-3 text-emerald-700 bg-emerald-50 p-3 rounded-lg animate-pulse">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="font-medium">
                                Processando {progress.current} de {progress.total}...
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={isProcessing || text.trim().length < 3}
                        className={`
                px-4 py-2 rounded-lg font-bold text-white flex items-center gap-2 transition-all
                ${isProcessing || text.trim().length < 3
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl'
                            }
            `}
                    >
                        {isProcessing ? 'Processando...' : 'Importar Lista'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default BulkImportModal;
