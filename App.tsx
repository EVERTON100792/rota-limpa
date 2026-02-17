
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import PremiumModal from './components/PremiumModal';
import SettingsModal from './components/SettingsModal';
import TripHistoryModal from './components/TripHistoryModal';
import HelpModal from './components/HelpModal';
import { Location, OptimizedRoute, Trip } from './types';
import { getOptimizedRoute } from './services/api';
import { Menu, X } from 'lucide-react';
import OptimizationOverlay from './components/OptimizationOverlay';

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
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false); // New State

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

  // Mobile: Auto-close sidebar when route is optimized
  useEffect(() => {
    if (route && isMobile) {
      setIsSidebarOpen(false);
    }
  }, [route, isMobile]);

  const handleLoadTrip = (trip: Trip) => {
    // Restore state from trip history
    setLocations(trip.locations);
    // Note: We don't restore the route object directly because it might be huge or incompatible. 
    // We re-set locations and let user re-optimize if they want exact same path, 
    // OR we could store the simpler route geometry. 
    // For now, let's just restore locations so they can "Ver no Mapa" via re-optimization or just seeing the pins.
    // Ideally, we should restore `trip.route` if it matches `OptimizedRoute` type.
    // The `Trip` type has `locations`. Let's assume loading history = loading the stops.
    setRoute(null); // Clear current route to force re-optimization or fresh view
    alert("Viagem carregada! Clique em 'Otimizar Rota' para traçar o caminho novamente.");
  };

  const handleOptimize = async () => {
    if (locations.length < 2) return;
    setIsOptimizing(true);

    // Minimum duration for the premium animation (3.5s)
    const minDuration = 3500;
    const startTime = Date.now();

    const res = await getOptimizedRoute(locations, isPremium, avoidDirt, roundTrip);

    const elapsedTime = Date.now() - startTime;
    if (elapsedTime < minDuration) {
      await new Promise(resolve => setTimeout(resolve, minDuration - elapsedTime));
    }

    if (res) {
      setRoute(res);
      // Atualiza a lista de locations com a ordem otimizada para que a navegação siga o trajeto correto
      setLocations(res.waypoints);
      // Se estiver no celular, fecha a sidebar APÓS a otimização para mostrar o resultado no mapa
      if (isMobile) setIsSidebarOpen(false);
    } else {
      alert("Não foi possível calcular a rota. Verifique os endereços.");
    }
    setIsOptimizing(false);
  };

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-gray-100 relative">

      {/* Botão Flutuante do Menu (Apenas Mobile/Quando fechado) */}
      <button
        onClick={toggleSidebar}
        className={`absolute top-4 left-4 z-[2000] bg-white p-3 rounded-full shadow-lg text-emerald-700 transition-all duration-300 ${isSidebarOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'} `}
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
          onOpenSettings={() => setShowSettings(true)}
          onOpenHistory={() => setShowHistory(true)}
          onOpenHelp={() => setShowHelp(true)} // Pass new prop
          onStartNavigation={() => { }}
          isNavigating={false}
          avoidDirt={avoidDirt}
          onToggleAvoidDirt={() => setAvoidDirt(prev => !prev)}
          roundTrip={roundTrip}
          onToggleRoundTrip={() => setRoundTrip(prev => !prev)}
          setRoundTrip={setRoundTrip} // Expose setter for auto-enable
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
          onUpdateLocation={(index, newLoc) => {
            const newLocations = [...locations];
            newLocations[index] = newLoc;
            setLocations(newLocations);
            // If we drag a pin, the current route is invalid. Force re-optimization or clear it.
            if (route) {
              // Optional: Auto-recalculate? Or just clear and warn.
              // User wants precision. Let's clear route to force them to click "Optimize" again with new coords, 
              // OR just update the route state if we could. 
              // Simple approach: Clear route to avoid visual glich (path pointing to old coord).
              setRoute(null);
            }
          }}
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

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isPremium={isPremium}
        onUpgrade={() => setShowPremiumModal(true)}
      />

      <TripHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onLoadTrip={handleLoadTrip}
      />

      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Premium Optimization Animation Overlay */}
      <OptimizationOverlay isVisible={isOptimizing} />

    </div>
  );
};

export default App;
