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

export async function downloadDailyCashSummary(schoolId: string, date?: string) {
  try {
    const today = date || new Date().toISOString().split('T')[0];

    const [{ data: txns }, { data: school }] = await Promise.all([
      supabase.from('financial_transactions')
        .select('type, amount, category, payment_mode, remarks, date')
        .eq('school_id', schoolId)
        .eq('date', today)
        .order('type'),
      supabase.from('schools').select('name, address, logo_url').eq('id', schoolId).single(),
    ]);

    const income  = (txns || []).filter(t => t.type === 'income');
    const expense = (txns || []).filter(t => t.type === 'expense');
    const totalIn  = income.reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = expense.reduce((s, t) => s + Number(t.amount), 0);

    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;

    if (school?.logo_url) {
      try { doc.addImage(await getBase64Image(school.logo_url), 'PNG', 14, 10, 20, 20); } catch {}
    }
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(school?.name || 'School', pw / 2, 20, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(school?.address || '', pw / 2, 28, { align: 'center' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Daily Cash Summary', pw / 2, 40, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${formatDate(today)}`, pw / 2, 48, { align: 'center' });

    // Income table
    autoTable(doc, {
      startY: 58,
      head: [['#', 'Category', 'Mode', 'Remarks', 'Amount (Rs.)']],
      body: income.map((t, i) => [i + 1, t.category || '—', t.payment_mode || '—', t.remarks || '—', Number(t.amount).toLocaleString()]),
      foot: [['', '', '', 'Total Income', totalIn.toLocaleString()]],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [236, 253, 245], textColor: [4, 120, 87], fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' } },
      didDrawPage: (d) => {
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(16, 185, 129);
        doc.text('INCOME', 14, (d.settings.startY as number) - 4);
        doc.setTextColor(0, 0, 0);
      }
    });

    const afterIncome = (doc as any).lastAutoTable?.finalY + 10;

    // Expense table
    autoTable(doc, {
      startY: afterIncome,
      head: [['#', 'Category', 'Mode', 'Remarks', 'Amount (Rs.)']],
      body: expense.map((t, i) => [i + 1, t.category || '—', t.payment_mode || '—', t.remarks || '—', Number(t.amount).toLocaleString()]),
      foot: [['', '', '', 'Total Expense', totalOut.toLocaleString()]],
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [254, 242, 242], textColor: [185, 28, 28], fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' } },
      didDrawPage: (d) => {
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(239, 68, 68);
        doc.text('EXPENSES', 14, (d.settings.startY as number) - 4);
        doc.setTextColor(0, 0, 0);
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY + 8;
    const net = totalIn - totalOut;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY, pw - 28, 20, 3, 3, 'FD');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Net Cash in Hand:', 20, finalY + 13);
    doc.setTextColor(net >= 0 ? 16 : 239, net >= 0 ? 185 : 68, net >= 0 ? 129 : 68);
    doc.text(`Rs. ${Math.abs(net).toLocaleString()}${net < 0 ? ' (deficit)' : ''}`, pw - 20, finalY + 13, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(8); doc.setFont('helvetica', 'italic');
    doc.text(`Generated: ${formatDateTime(new Date())}`, 14, finalY + 28);

    doc.save(`Cash_Summary_${today}.pdf`);
  } catch (err: any) {
    console.error('Daily cash summary error:', err);
    alert('Failed to generate report: ' + err.message);
  }
}
