import jsPDF from 'jspdf';
import { formatDate } from './utils';

export const toBase64 = (url: string): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = url;
  });

interface HeaderOptions {
  doc: jsPDF;
  schoolInfo: any;
  title: string;
  subtitle?: string;
  reportId: string;
  logoBase64: string;
  isLandscape?: boolean;
}

export const addPdfHeader = ({ doc, schoolInfo, title, subtitle, reportId, logoBase64, isLandscape = false }: HeaderOptions) => {
  const sName = schoolInfo?.name || 'Academic Institution';
  const sAddr = schoolInfo?.address || '';
  const sPhone = schoolInfo?.contact_phone || '';

  const pageWidth = isLandscape ? 297 : 210;
  const margin = 15;
  const col2X = pageWidth - margin;

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', margin, 12, 22, 22); } catch (e) {}
  }
  const textX = logoBase64 ? 42 : margin;

  // School Name (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(sName, textX, 17, { maxWidth: 100 });
  
  // Subtitle (Left)
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text(subtitle || 'OFFICIAL ACADEMIC RECORD', textX, 23, { maxWidth: 100 });
  
  // Address (Left)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  let contactStr = sAddr;
  if (sPhone) contactStr += (contactStr ? '  |  ' : '') + 'Ph: ' + sPhone;
  if (contactStr) {
    const splitContact = doc.splitTextToSize(contactStr, 90);
    doc.text(splitContact, textX, 28);
  }

  // Right side: Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title.toUpperCase(), col2X, 16, { align: 'right' });
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`DATE: ${formatDate(new Date())}`, col2X, 21, { align: 'right' });
  doc.text(`REF: ${reportId.toUpperCase()}-${Date.now().toString().substring(4,10)}`, col2X, 25, { align: 'right' });

  // Footer lines
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 34, col2X, 34);
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(1.5);
  doc.line(margin, 34, margin + 30, 34);
};
