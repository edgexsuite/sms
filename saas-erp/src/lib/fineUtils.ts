import { supabase } from './supabase';

export interface FineRule {
  id: string;
  name: string;
  type: 'flat' | 'per_day' | 'percentage';
  amount: number;
  grace_days: number;
}

/**
 * Calculates the total fine for an overdue invoice based on the provided rules.
 * @param invoice The invoice record (must contain due_date and total_amount)
 * @param rules Array of FineRule objects
 * @returns Object containing totalFine and appliedRule details
 */
export function calculateLateFine(invoice: any, rules: FineRule[], currentDate: Date = new Date()) {
  if (!invoice.due_date || invoice.status === 'paid') return { totalFine: 0, daysLate: 0 };

  const dueDate = new Date(invoice.due_date);
  // Reset times to compare dates only
  dueDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);

  if (currentDate <= dueDate) return { totalFine: 0, daysLate: 0 };

  const diffTime = Math.abs(currentDate.getTime() - dueDate.getTime());
  const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let totalFine = 0;
  const appliedRules: string[] = [];

  rules.forEach(rule => {
    if (daysLate <= rule.grace_days) return;

    let fineAmount = 0;
    const effectiveDays = daysLate - rule.grace_days;

    if (rule.type === 'flat') {
      fineAmount = rule.amount;
    } else if (rule.type === 'per_day') {
      fineAmount = rule.amount * effectiveDays;
    } else if (rule.type === 'percentage') {
      fineAmount = (invoice.total_amount * rule.amount) / 100;
    }

    if (fineAmount > 0) {
      totalFine += fineAmount;
      appliedRules.push(rule.name);
    }
  });

  return { 
    totalFine: Math.round(totalFine), 
    daysLate, 
    appliedRules: appliedRules.join(', ')
  };
}

/**
 * Fetches the fine policy rules for a specific school.
 */
export async function getFineRules(schoolId: string): Promise<FineRule[]> {
  const { data } = await supabase
    .from('form_settings')
    .select('sections_config')
    .eq('school_id', schoolId)
    .eq('form_name', 'fine_policy')
    .maybeSingle();
  
  return data?.sections_config?.rules ?? [];
}
