
import React from 'react';
import { Star, CheckCircle, X } from 'lucide-react';
import { SQL_SETUP_SCRIPT, STRIPE_INTEGRATION_CODE } from '../backend_setup';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  showDevCode: boolean;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose, onConfirm, showDevCode }) => {
  if (!isOpen) return null;

  if (showDevCode) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Configuração Backend (Dev)</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
          </div>
          <div className="p-6 overflow-y-auto bg-gray-50 font-mono text-sm flex-1">
             <h3 className="font-bold text-purple-700 mb-2">// 1. Supabase SQL Setup</h3>
             <pre className="bg-slate-800 text-slate-200 p-4 rounded mb-6 overflow-x-auto whitespace-pre-wrap">
                {SQL_SETUP_SCRIPT || "Carregando script..."}
             </pre>

             <h3 className="font-bold text-purple-700 mb-2">// 2. Stripe Integration (Node.js)</h3>
             <pre className="bg-slate-800 text-slate-200 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                {STRIPE_INTEGRATION_CODE || "Carregando código..."}
             </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform transition-all">
        
        {/* Header Image/Gradient */}
        <div className="bg-gradient-to-r from-gray-900 to-emerald-900 p-8 text-center text-white relative overflow-hidden">
          {/* Simple pattern overlay using CSS radial gradient instead of external image to prevent load errors */}
          <div className="absolute top-0 left-0 w-full h-full opacity-20" style={{backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
          
          <div className="relative z-10">
            <div className="mx-auto bg-yellow-400 text-gray-900 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <Star size={32} fill="currentColor" />
            </div>
            <h2 className="text-3xl font-bold">RotaLimpa Premium</h2>
            <p className="text-emerald-200 mt-2">Chegue seguro, evite o barro.</p>
          </div>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-emerald-500 shrink-0" />
              <span className="text-gray-700">Paradas ilimitadas (TSP Solver)</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="text-emerald-500 shrink-0" />
              <span className="text-gray-700">Detecção de estrada de terra (Surface Tag)</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="text-emerald-500 shrink-0" />
              <span className="text-gray-700">Mapas Offline (Em breve)</span>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-sm text-gray-500 line-through">R$ 29,90</p>
                <p className="text-3xl font-bold text-gray-900">R$ 14,90<span className="text-sm font-normal text-gray-500">/mês</span></p>
              </div>
            </div>
            
            <button 
              onClick={onConfirm}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition transform active:scale-95 flex justify-center items-center gap-2"
            >
              Assinar Agora
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">Pagamento seguro via Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
