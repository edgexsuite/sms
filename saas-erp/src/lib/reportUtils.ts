import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { formatDate, formatDateTime, getBase64Image } from './utils';

export async function downloadDailyCollectionReport(schoolId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: transactions, error } = await supabase
      .from('financial_transactions')
      .select(`
        *,
        fee_records (
          students (
            full_name,
            roll_number,
            classes (name, section)
          )
        )
      `)
      .eq('school_id', schoolId)
      .eq('type', 'income')
      .eq('category', 'Fee Collection')
      .gte('date', today)
      .lte('date', today);

    if (error) throw error;

    const { data: school } = await supabase
      .from('schools')
      .select('name, address, logo_url')
      .eq('id', schoolId)
      .single();

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Logo
    if (school?.logo_url) {
      try {
        const logoBase64 = await getBase64Image(school.logo_url);
        doc.addImage(logoBase64, 'PNG', 14, 10, 20, 20);
      } catch (e) { console.warn('Logo load failed', e); }
    }

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(school?.name || 'School Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(school?.address || '', pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Fee Collection Report', pageWidth / 2, 40, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Date: ${formatDate(today)}`, pageWidth / 2, 48, { align: 'center' });

    // Table
    const tableData = (transactions || []).map((t, index) => {
      const student = (t as any).fee_records?.students;
      return [
        index + 1,
        student?.full_name || t.remarks?.split('—')[0]?.trim() || 'N/A',
        student?.roll_number || 'N/A',
        student?.classes ? `${student.classes.name} ${student.classes.section || ''}` : 'N/A',
        t.payment_mode || 'N/A',
        t.reference_number || '-',
        Number(t.amount).toLocaleString()
      ];
    });

    const totalAmount = (transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);

    autoTable(doc, {
      startY: 60,
      head: [['#', 'Student Name', 'Roll #', 'Class', 'Mode', 'Ref #', 'Amount']],
      body: tableData,
      foot: [['', '', '', '', '', 'Total', totalAmount.toLocaleString()]],
      theme: 'grid',
      headStyles: { fillColor: [13, 21, 38], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        6: { halign: 'right' }
      }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || 60;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated on: ${formatDateTime(new Date())}`, 14, finalY + 10);
    doc.text('System Generated Report', pageWidth - 14, finalY + 10, { align: 'right' });

    doc.save(`Daily_Collection_${today}.pdf`);
  } catch (err: any) {
    console.error('Error generating report:', err);
    alert('Failed to generate report: ' + err.message);
  }
}
