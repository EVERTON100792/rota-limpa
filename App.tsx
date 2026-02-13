import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import PremiumModal from './components/PremiumModal';
import { Location, OptimizedRoute } from './types';
import { getOptimizedRoute } from './services/api';
import { Menu, X } from 'lucide-react';

const App: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [avoidDirt, setAvoidDirt] = useState(false);
  const [roundTrip, setRoundTrip] = useState(false);

  // Estado inicial da sidebar: aberta em desktop, fechada em mobile
  // Usamos uma função lazy para inicializar o estado apenas uma vez
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showDevCode, setShowDevCode] = useState(false);

  // Monitorar redimensionamento da tela
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Se mudou para desktop e o menu estava fechado, abre automaticamente
      if (!mobile) {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear route when locations are cleared
  useEffect(() => {
    if (locations.length === 0) {
      setRoute(null);
    }
  }, [locations]);

  const handleOptimize = async () => {
    if (locations.length < 2) return;
    setIsOptimizing(true);

    // Se estiver no celular, fecha a sidebar para mostrar o resultado no mapa
    if (isMobile) setIsSidebarOpen(false);

    const res = await getOptimizedRoute(locations, isPremium, avoidDirt, roundTrip);
    if (res) {
      setRoute(res);
    } else {
      alert("Não foi possível calcular a rota. Verifique os endereços.");
    }
    setIsOptimizing(false);
  };

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100 relative">

      {/* Botão Flutuante do Menu (Apenas Mobile/Quando fechado) */}
      <button
        onClick={toggleSidebar}
        className={`absolute top-4 left-4 z-[2000] bg-white p-3 rounded-full shadow-lg text-emerald-700 transition-all duration-300 ${isSidebarOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
        aria-label="Abrir Menu"
      >
        <Menu size={24} />
      </button>

      {/* Sidebar Container (Drawer) */}
      <div
        className={`
          absolute inset-y-0 left-0 z-[3000] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col
          w-full md:w-[400px] h-full
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Botão Fechar Sidebar (Apenas Mobile) */}
        {isMobile && (
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-3 right-3 z-[3010] bg-gray-100 p-2 rounded-full text-gray-600 hover:bg-gray-200"
          >
            <X size={20} />
          </button>
        )}

        <Sidebar
          locations={locations}
          setLocations={setLocations}
          isPremium={isPremium}
          onOptimize={handleOptimize}
          isOptimizing={isOptimizing}
          route={route}
          onUpgradeClick={() => {
            setShowPremiumModal(true);
            setShowDevCode(false);
          }}
          onShowDevCode={() => {
            setShowPremiumModal(true);
            setShowDevCode(true);
          }}
          onStartNavigation={() => { }}
          isNavigating={false}
          avoidDirt={avoidDirt}
          onToggleAvoidDirt={() => setAvoidDirt(prev => !prev)}
          roundTrip={roundTrip}
          onToggleRoundTrip={() => setRoundTrip(prev => !prev)}
        />
      </div>

      {/* Overlay Escuro para Mobile quando Sidebar aberta */}
      {isMobile && isSidebarOpen && (
        <div
          className="absolute inset-0 z-[2500] bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mapa (Fundo) */}
      <div className="absolute inset-0 z-0">
        <MapComponent
          locations={locations}
          route={route}
          isPremium={isPremium}
          isNavigating={false}
          onStopNavigation={() => { }}
          onRecalculate={async () => { }}
          onOffRouteDetected={() => { }}
        />
      </div>

      {/* Modais */}
      {showPremiumModal && (
        <PremiumModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          onConfirm={() => {
            setIsPremium(true);
            setShowPremiumModal(false);
          }}
          showDevCode={showDevCode}
        />
      )}
    </div>
  );
};

export default App;