/**
 * All templates return a plain-text string ready for wa.me URL encoding.
 */
import { formatDate } from './utils';

export interface TemplateVars {
  studentName?: string;
  parentName?: string;
  schoolName?: string;
  className?: string;
  invoiceNumber?: string;
  balance?: number | string;
  dueDate?: string;
  month?: string;
  attendanceDate?: string;
  absenceReason?: string;
  examName?: string;
  resultSummary?: string;
  leaveFrom?: string;
  leaveTo?: string;
  leaveReason?: string;
  customMessage?: string;
  amount?: number | string;
  staffName?: string;
  arrivalTime?: string;
  symptoms?: string;
  admissionDate?: string;
}

const fmt = (n: number | string | undefined) =>
  n !== undefined ? Number(n).toLocaleString() : '0';

/** Fee reminder — sent when a fee invoice is pending */
export function feeDueTemplate(vars: TemplateVars): string {
  return `Dear Parent,\n\nThis is a friendly reminder that the fee for *${vars.studentName}* (${vars.className}) for *${vars.month || 'this month'}* is pending. \n\n*Amount Due:* Rs. ${fmt(vars.balance)}\n*Due Date:* ${vars.dueDate || 'N/A'}\n\nPlease ignore if already paid.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Overdue fee reminder — sent when a fee is past the due date */
export function overdueFeeTemplate(vars: TemplateVars): string {
  return `⚠️ *URGENT: OVERDUE FEE NOTICE*\n\nDear Parent,\n\nThe fee for *${vars.studentName}* (${vars.className}) for *${vars.month || 'this month'}* is now *OVERDUE*.\n\n*Outstanding Amount:* Rs. ${fmt(vars.balance)}\n*Original Due Date:* ${vars.dueDate || 'N/A'}\n\nPlease settle this balance immediately to avoid late payment penalties and ensure uninterrupted school services.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Absence alert — sent on the same day a student is marked absent */
export function absenceAlertTemplate(vars: TemplateVars): string {
  return `Dear Parent,\n\nYour child *${vars.studentName}* was marked *absent* from school today (*${formatDate(vars.attendanceDate || new Date())}*).\n\nRegular attendance is crucial for academic success. Please provide a reason for the absence.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Late arrival notice — sent for students who are continuously late */
export function lateArrivalTemplate(vars: TemplateVars): string {
  return `Dear Parent,\n\nWe noticed that *${vars.studentName}* arrived late today at *${vars.arrivalTime || 'N/A'}*. \n\nContinuously late arrival disrupts the student's learning and the class schedule. We request your cooperation in ensuring your child reaches school on time.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Health issue notification */
export function healthIssueTemplate(vars: TemplateVars): string {
  return `Dear Parent,\n\nThis is to inform you that *${vars.studentName}* is feeling unwell at school today. \n\n*Symptoms:* ${vars.symptoms || 'Minor health concern'}\n\nPlease contact the school office or visit to pick up your child if necessary.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Admission confirmation */
export function admissionConfirmationTemplate(vars: TemplateVars): string {
  return `Dear Parent,\n\nCongratulations! We are delighted to confirm the admission of *${vars.studentName}* into Class *${vars.className}* at *${vars.schoolName}*.\n\n*Admission Date:* ${formatDate(vars.admissionDate || new Date())}\n\nWelcome to our school family! We look forward to a successful academic journey together.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Result notification — sent after results are published */
export function resultNotificationTemplate(vars: TemplateVars): string {
  return `Dear Parent,\n\nThe result for *${vars.examName}* has been published for *${vars.studentName}* (${vars.className}).\n\n${vars.resultSummary ? vars.resultSummary + '\n\n' : ''}Please log in to the Parent Portal to view the detailed result card.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Fee payment receipt — sent after a successful fee collection */
export function paymentReceiptTemplate(vars: TemplateVars): string {
  return `✅ *Fee Receipt Confirmation*\n\nDear Parent,\n\nWe acknowledge receipt of the following payment:\n\n*Student:* ${vars.studentName}\n*Class:* ${vars.className}\n*Month(s):* ${vars.month || '—'}\n*Amount Paid:* Rs. ${fmt(vars.amount)}\n*Payment Mode:* ${vars.customMessage || '—'}\n*Date:* ${vars.dueDate || '—'}\n\nThank you for the timely payment.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Staff salary slip notification */
export function staffPayslipTemplate(vars: TemplateVars): string {
  return `💼 *Salary Slip — ${vars.month || ''}*\n\nDear ${vars.staffName || 'Staff'},\n\nYour salary for *${vars.month}* has been processed.\n\n*Net Salary:* Rs. ${fmt(vars.amount)}\n\nPlease contact accounts for your printed salary slip.\n\n— ${vars.schoolName || 'School Management'}`;
}

/** Custom / general announcement */
export function customTemplate(vars: TemplateVars): string {
  return `Dear ${vars.parentName || 'Parent'},\n\n${vars.customMessage || ''}\n\n— ${vars.schoolName || 'School Management'}`;
}

/**
 * Clean and format phone numbers for WhatsApp.
 * Handles Pakistan formats: 03..., 3..., 92...
 * Also strips prefixes like "Chat on WhatsApp with "
 */
export function cleanWhatsAppNumber(phone: string): string {
  // Step 1: Strip all non-digits
  let cleaned = (phone || '').replace(/\D/g, '');
  
  // Step 2: Handle Pakistan specific formatting
  // Case 1: 03001234567 -> 923001234567
  if (cleaned.length === 11 && cleaned.startsWith('03')) {
    cleaned = '92' + cleaned.substring(1);
  }
  // Case 2: 3001234567 -> 923001234567
  else if (cleaned.length === 10 && cleaned.startsWith('3')) {
    cleaned = '92' + cleaned;
  }
  
  return cleaned;
}

/** Open WhatsApp for a given phone number with pre-filled message */
export function openWhatsApp(phone: string, message: string): void {
  const cleaned = cleanWhatsAppNumber(phone);
  window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`, '_blank');
}

/** Build wa.me link without opening it (for generating links) */
export function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = cleanWhatsAppNumber(phone);
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}
