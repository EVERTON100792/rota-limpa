import React, { useRef, useState } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';

interface CameraInputProps {
    onCapture: (file: File) => void;
    disabled?: boolean;
}

const CameraInput: React.FC<CameraInputProps> = ({ onCapture, disabled }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            processFile(file);
        }
    };

    const processFile = (file: File) => {
        setIsProcessing(true);
        // Here we could add client-side compression if needed
        // For now, pass directly
        onCapture(file);
        setIsProcessing(false);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <input
                type="file"
                accept="image/*"
                capture="environment" // Prefer rear camera on mobile
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={disabled}
            />

            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isProcessing}
                className="p-1.5 hover:bg-emerald-700 rounded transition-colors text-white relative group"
                title="Tirar Foto / Upload"
            >
                {isProcessing ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : (
                    <Camera size={18} />
                )}

                {/* Tooltip */}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Foto para Rota
                </span>
            </button>
        </>
    );
};

export default CameraInput;
