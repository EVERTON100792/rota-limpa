import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { generateTripPDF } from '../services/pdfGenerator';
import { Trip } from '../types';
import { X, FileText, Trash2, MapPin, Calendar, DollarSign } from 'lucide-react';

interface TripHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadTrip: (trip: Trip) => void;
}

const TripHistoryModal: React.FC<TripHistoryModalProps> = ({ isOpen, onClose, onLoadTrip }) => {
    const [trips, setTrips] = useState<Trip[]>([]);

    useEffect(() => {
        if (isOpen) {
            setTrips(StorageService.getTrips());
        }
    }, [isOpen]);

    const handleDelete = (id: string) => {
        if (confirm("Tem certeza que deseja excluir este histórico?")) {
            StorageService.deleteTrip(id);
            setTrips(StorageService.getTrips());
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-[95%] max-w-3xl max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200">

                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Histórico de Viagens</h2>
                        <p className="text-sm text-gray-500">Seus comprovantes e rotas salvas.</p>
                    </div>
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow-sm hover:bg-gray-100 transition-colors">
                        <X size={20} className="text-gray-600" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {trips.length === 0 ? (
                        <div className="text-center py-20 opacity-50">
                            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-400 text-lg">Nenhuma viagem salva ainda.</p>
                        </div>
                    ) : (
                        trips.map((trip) => (
                            <div key={trip.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group">

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                            Concluído
                                        </span>
                                        <span className="text-gray-400 text-xs flex items-center gap-1">
                                            <Calendar size={12} /> {new Date(trip.date).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-bold text-gray-800 text-lg">
                                            {(trip.totalDistance / 1000).toFixed(1)} km
                                        </h3>
                                        <span className="text-gray-300">|</span>
                                        <span className="font-bold text-emerald-600 text-lg flex items-center">
                                            R$ {trip.totalAmount.toFixed(2)}
                                        </span>
                                    </div>

                                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                        <MapPin size={12} />
                                        {trip.locations.length} Paradas • {trip.locations[0]?.name.split(',')[0]} ... {trip.locations[trip.locations.length - 1]?.name.split(',')[0]}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                                    <button
                                        onClick={() => { onLoadTrip(trip); onClose(); }}
                                        className="flex-1 md:flex-none py-2 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        <MapPin size={14} /> Mapa
                                    </button>

                                    <button
                                        onClick={() => generateTripPDF(trip)}
                                        className="flex-1 md:flex-none py-2 px-3 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-emerald-100"
                                    >
                                        <FileText size={14} /> PDF
                                    </button>

                                    <button
                                        onClick={() => handleDelete(trip.id)}
                                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
};

export default TripHistoryModal;
