import React from 'react';
import { X, MapPin, Calculator, Navigation, FileText, CheckCircle } from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-emerald-600 p-4 flex justify-between items-center shrink-0">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <FileText size={20} /> Guia Rápido do Motorista
                    </h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto space-y-8">

                    {/* Step 1: Start */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                            1
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-800 text-lg">Iniciando a Rota</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Abra o aplicativo e clique em <strong>"Partir da Minha Localização"</strong> ou digite o endereço do primeiro cliente.
                                Adicione todas as paradas da sua lista. O sistema aceita copiar e colar múltiplos endereços se necessário.
                            </p>
                        </div>
                    </section>

                    {/* Step 2: Costs */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                            2
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-800 text-lg">Definindo Veículo e Custos</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Abra a aba <strong>"Veículo & Custos"</strong> para configurar:
                                <br />
                                • <strong>Tipo de Veículo:</strong> Selecione Fiorino, Van ou Caminhão para ter uma estimativa automática.
                                <br />
                                • <strong>Combustível:</strong> Ajuste o preço e o consumo do seu veículo.
                                <br />
                                • <strong>Valor Frete:</strong> Defina o valor por KM ou edite o <strong>Valor Total</strong> manualmente.
                                <br />
                                • <strong>Finalizar Viagem:</strong> Ao concluir, insira o <strong>KM Real</strong> para ter um relatório preciso de lucro e custos.
                                <br />
                                <span className="text-xs text-emerald-600 font-bold block mt-1">O sistema calculará seu Lucro Líquido automaticamente!</span>
                            </p>
                        </div>
                    </section>

                    {/* Step 3: Optimization & Dirt Roads */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                            3
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-800 text-lg">Evitar Terra & Otimizar</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Se você estiver em um veículo que não pode pegar estrada de chão, ative a opção <strong>"Evitar Estradas de Terra"</strong> (Recurso Premium).
                                <br />
                                Em seguida, clique em <strong>"Otimizar Rota"</strong>. O sistema vai reorganizar suas paradas para economizar tempo e combustível.
                            </p>
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 mt-2">
                                <strong>Importante:</strong> Ao clicar em "Navegar", o sistema enviará a rota calculada para o Google Maps. Siga fielmente o GPS.
                            </div>
                        </div>
                    </section>

                    {/* Step 4: Finishing */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                            4
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-800 text-lg">Finalizando & Relatórios</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Ao entregar no último ponto, clique em <strong>"Finalizar"</strong>.
                                O app gerará um resumo completo com KM total, tempo e seu lucro líquido.
                                Esse histórico fica salvo para você consultar depois.
                            </p>
                            <button onClick={onClose} className="mt-4 w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition shadow-lg">
                                Entendi, Vamos Começar!
                            </button>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};

export default HelpModal;
