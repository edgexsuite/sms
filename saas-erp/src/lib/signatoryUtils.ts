import { supabase } from './supabase';

export type DocumentType = 
  | 'appointment_letter' 
  | 'experience_certificate' 
  | 'fee_challan' 
  | 'student_leaving' 
  | 'report_card';

export interface AuthorizedSignatory {
  id: string;
  name: string;
  designation: string; // e.g. "Director", "Principal", "Vice Principal", "Administrator", "Registrar", "Accountant"
  phone?: string;
  email?: string;
  signature_url?: string;
  stamp_url?: string;
  is_active: boolean;
  applies_to: DocumentType[];
  is_default_for: DocumentType[];
  created_at?: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  appointment_letter: 'Appointment Letter',
  experience_certificate: 'Experience Certificate',
  fee_challan: 'Fee Challan',
  student_leaving: 'Leaving Certificate',
  report_card: 'Report Card',
};

export const STANDARD_DESIGNATIONS = [
  'Director',
  'Principal',
  'Vice Principal',
  'Administrator',
  'Registrar / HR Management',
  'Accountant',
  'Coordinator',
  'Headmistress / Headmaster',
];

/**
 * Fetches all authorized signatories for the specified school from form_settings
 */
export async function fetchSchoolSignatories(schoolId: string): Promise<AuthorizedSignatory[]> {
  try {
    const { data, error } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', schoolId)
      .eq('form_name', 'authorized_signatories')
      .maybeSingle();

    if (error) {
      console.warn('Error fetching school signatories:', error);
      return [];
    }

    const signatories = (data?.sections_config?.signatories as AuthorizedSignatory[]) || [];
    return signatories;
  } catch (err) {
    console.error('Failed to load signatories:', err);
    return [];
  }
}

/**
 * Saves the full list of authorized signatories for a school
 */
export async function saveSchoolSignatories(
  schoolId: string, 
  signatories: AuthorizedSignatory[]
): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('form_settings')
      .upsert(
        {
          school_id: schoolId,
          form_name: 'authorized_signatories',
          sections_config: { signatories },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'school_id,form_name' }
      );

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error saving signatories:', err);
    return { success: false, error: err };
  }
}

/**
 * Returns the default active signatory for a specific document type,
 * or the first active matching signatory, or null.
 */
export function getDefaultSignatory(
  signatories: AuthorizedSignatory[], 
  docType: DocumentType
): AuthorizedSignatory | null {
  const active = signatories.filter(s => s.is_active);
  if (active.length === 0) return null;

  // 1. Look for explicit default for this document type
  const explicitDefault = active.find(s => s.is_default_for?.includes(docType));
  if (explicitDefault) return explicitDefault;

  // 2. Look for signatory configured for this document type
  const matching = active.find(s => s.applies_to?.includes(docType));
  if (matching) return matching;

  // 3. Fallback to first active signatory
  return active[0];
}
