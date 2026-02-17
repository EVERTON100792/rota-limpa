
import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, ShieldCheck, Map, Smartphone, Satellite } from 'lucide-react';

interface OptimizationOverlayProps {
    isVisible: boolean;
    onComplete?: () => void; // Optional callback if we want the animation to control the flow
}

const steps = [
    { icon: Satellite, text: 'Conectando ao satélite...', subtext: 'Triangulando posição exata' },
    { icon: Map, text: 'Carregando dados do mapa...', subtext: 'Verificando vias e restrições' },
    { icon: ShieldCheck, text: 'Validando segurança...', subtext: 'Evitando áreas de risco e terra' },
    { icon: Smartphone, text: 'Otimizando rota...', subtext: 'Calculando o melhor trajeto para você' },
    { icon: CheckCircle, text: 'Rota Pronta!', subtext: 'Iniciando navegação segura' },
];

const OptimizationOverlay: React.FC<OptimizationOverlayProps> = ({ isVisible }) => {
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if (isVisible) {
            setCurrentStep(0);
            const interval = setInterval(() => {
                setCurrentStep((prev) => {
                    if (prev < steps.length - 1) return prev + 1;
                    clearInterval(interval);
                    return prev;
                });
            }, 800); // 800ms per step = ~3.2s total animation

            return () => clearInterval(interval);
        }
    }, [isVisible]);

    if (!isVisible) return null;

    const StepIcon = steps[currentStep].icon;

    return (
        <div className="fixed inset-0 z-[9999] bg-gray-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 transition-all duration-300">

            {/* Pulse Effect Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">

                {/* Animated Icon Container */}
                <div className="relative mb-8">
                    {/* Rotating Rings */}
                    <div className="absolute inset-0 border-4 border-emerald-500/30 rounded-full animate-[spin_3s_linear_infinite]"></div>
                    <div className="absolute inset-2 border-4 border-emerald-400/20 rounded-full animate-[spin_4s_linear_infinite_reverse]"></div>

                    <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center shadow-2xl border border-gray-700 relative overflow-hidden">

                        {/* Scan line effect */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent animate-[scan_2s_linear_infinite]"></div>

                        <StepIcon size={40} className={`text-emerald-400 transition-all duration-500 ${currentStep === steps.length - 1 ? 'scale-110' : 'animate-pulse'}`} />
                    </div>

                    {/* Status Badge */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg uppercase tracking-wider">
                        Processando
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-2 animate-in slide-in-from-bottom-5 duration-500 fade-in">
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                        {steps[currentStep].text}
                    </h2>
                    <p className="text-sm text-gray-400 font-medium">
                        {steps[currentStep].subtext}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mt-8 w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-300 ease-out"
                        style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    ></div>
                </div>

                <p className="mt-4 text-[10px] text-gray-500 font-mono">
                    SECURE CONNECTION • ENCRYPTED DATA
                </p>

            </div>
        </div>
    );
};

export default OptimizationOverlay;
