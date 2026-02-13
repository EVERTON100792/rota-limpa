import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Trip } from '../types';

export const generateTripPDF = (trip: Trip) => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("RotaLimpa - Comprovante de Serviço", 105, 13, { align: 'center' });

    // Job Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    let y = 30;
    doc.text(`Data do Serviço: ${new Date(trip.date).toLocaleString('pt-BR')}`, 14, y);
    doc.text(`ID da Viagem: #${trip.id.slice(0, 8).toUpperCase()}`, 14, y + 6);

    // Financial Box
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.rect(120, 25, 75, 25);

    doc.setFontSize(9);
    doc.text("Distância Total:", 125, 32);
    doc.text(`${(trip.totalDistance / 1000).toFixed(1)} km`, 185, 32, { align: 'right' });

    doc.text("Valor por KM:", 125, 38);
    doc.text(`R$ ${trip.costPerKm.toFixed(2)}`, 185, 38, { align: 'right' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text("TOTAL:", 125, 46);
    doc.text(`R$ ${trip.totalAmount.toFixed(2)}`, 185, 46, { align: 'right' });

    // Stops Table
    y = 60;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text("Lista de Entregas / Paradas", 14, 55);

    const tableBody = trip.locations.map((loc, index) => {
        let label = index.toString();
        if (index === 0) label = "INÍCIO";
        else if (index === trip.locations.length - 1 && trip.locations.length > 1) label = "FIM";

        return [
            label,
            loc.clientId || '-',
            loc.name,
            loc.address?.city || '-'
        ];
    });

    autoTable(doc, {
        startY: 60,
        head: [['#', 'ID Cliente', 'Endereço', 'Cidade']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 30 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 40 }
        }
    });

    // Footer / Signature
    const finalY = (doc as any).lastAutoTable.finalY + 40;

    doc.setDrawColor(0, 0, 0);
    doc.line(14, finalY, 100, finalY);
    doc.setFontSize(8);
    doc.text("Assinatura do Responsável", 14, finalY + 5);

    doc.line(110, finalY, 196, finalY);
    doc.text("Assinatura do Recebedor", 110, finalY + 5);

    doc.text("Gerado via App RotaLimpa", 105, 285, { align: 'center' });

    // Save
    doc.save(`RotaLimpa_Servico_${trip.id.slice(0, 6)}.pdf`);
};
