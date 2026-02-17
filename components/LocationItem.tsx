import React, { useState } from 'react';
import { Location } from '../types';
import { Trash2, Pencil, CheckCircle, MapPin, Play, Flag, Navigation } from 'lucide-react';
import { searchLocation } from '../services/api';

interface LocationItemProps {
    loc: Location;
    index: number;
    isLast: boolean;
    isFirst: boolean;
    onRemove: () => void;
    onUpdate: (loc: Location) => void;
}

const LocationItem: React.FC<LocationItemProps> = ({ loc, index, isLast, isFirst, onRemove, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editQuery, setEditQuery] = useState(loc.name);
    const [clientId, setClientId] = useState(loc.clientId || '');

    const handleSaveEdit = async () => {
        if (editQuery !== loc.name) {
            // Re-geocode if name changed to ensure coords match
            try {
                const results = await searchLocation(editQuery);
                if (results && results.length > 0) {
                    const newLoc = results[0];
                    onUpdate({ ...newLoc, clientId }); // Preserve Client ID
                } else {
                    // Fallback: Just update name if not found (keep old coords? dangerous for fidelity)
                    // Better: Alert user
                    alert("Endereço não encontrado ao salvar. Mantenha o original ou tente novamente.");
                    return;
                }
            } catch (e) {
                alert("Erro ao buscar endereço.");
                return;
            }
        } else {
            // Just updating Client ID
            onUpdate({ ...loc, clientId });
        }
        setIsEditing(false);
    };

    return (
        <div className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-3 flex items-start justify-between relative overflow-hidden">
            {!isLast && (
                <div className="absolute left-[19px] top-[40px] bottom-[-20px] w-[2px] bg-gray-100 z-0 group-hover:bg-emerald-100 transition-colors"></div>
            )}

            <div className="flex items-start gap-3 relative z-10 w-full">
                <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${isFirst ? 'bg-emerald-100 border-emerald-200 text-emerald-700' :
                    isLast ? 'bg-slate-800 border-slate-700 text-white' :
                        'bg-white border-gray-200 text-gray-500'
                    }`}>
                    {isFirst ? (
                        <Play size={14} className="fill-current" />
                    ) : isLast ? (
                        <Flag size={14} className="fill-current" />
                    ) : (
                        <span className="text-xs font-bold font-heading">{index}</span>
                    )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">

                    {isEditing ? (
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={editQuery}
                                onChange={(e) => setEditQuery(e.target.value)}
                                className="w-full text-sm border border-emerald-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                placeholder="Endereço..."
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    placeholder="Ref/ID Cliente"
                                    className="w-24 text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50"
                                />
                                <button
                                    onClick={handleSaveEdit}
                                    className="bg-emerald-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1 hover:bg-emerald-600"
                                >
                                    <CheckCircle size={12} /> Salvar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-800 truncate leading-tight" title={loc.name}>
                                    {loc.name}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {loc.clientId && (
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono border border-gray-200">
                                        #{loc.clientId}
                                    </span>
                                )}
                                <p className="text-[11px] text-gray-500 truncate flex-1 block">
                                    {loc.address?.city || "Cidade não ident."}
                                </p>
                            </div>
                        </>
                    )}

                </div>

                <div className="flex flex-col gap-1">
                    {!isEditing && (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                                title="Editar"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                onClick={onRemove}
                                className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                title="Remover"
                            >
                                <Trash2 size={14} />
                            </button>
                            <div className="h-px bg-gray-100 my-0.5" />
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-300 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                                title="Google Maps"
                            >
                                <MapPin size={14} />
                            </a>
                            <a
                                href={`https://waze.com/ul?ll=${loc.lat},${loc.lng}&navigate=yes`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-300 hover:text-cyan-500 hover:bg-cyan-50 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                                title="Waze"
                            >
                                <Navigation size={14} />
                            </a>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LocationItem;
