import { supabase } from './supabase';

export interface GradingBracket {
  id: string;
  min_pct: number | '';
  max_pct: number | '';
  grade_title: string;
  result_status: 'pass' | 'fail';
  color_level: string;
  custom_hex?: string;
  custom_label?: string;
  remarks: string;
}

export interface GradeResult {
  grade: string;
  status: 'Pass' | 'Fail' | 'Absent';
  remarks: string;
  colorLevel: string;
  hexColor: string;
  pct: number;
}

const COLOR_HEX: Record<string, string> = {
  emerald: '#10b981',
  blue:    '#3b82f6',
  orange:  '#f97316',
  yellow:  '#eab308',
  red:     '#ef4444',
};

/** Fallback hardcoded grading when no policy is configured */
function fallbackGrade(pct: number): GradeResult {
  const grade =
    pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' :
    pct >= 60 ? 'C'  : pct >= 50 ? 'D' : 'F';
  const pass = pct >= 33;
  return {
    grade,
    status: pass ? 'Pass' : 'Fail',
    remarks: pass ? 'Satisfactory' : 'Needs Improvement',
    colorLevel: pass ? 'emerald' : 'red',
    hexColor:   pass ? '#10b981'  : '#ef4444',
    pct,
  };
}

/**
 * Derive grade, status, remarks from the school's grading policy.
 * Falls back to the built-in A+/A/B/C/D/F scale if no policy is defined.
 */
export function getGradeFromPolicy(
  obtained: number,
  total: number,
  brackets: GradingBracket[],
): GradeResult {
  if (total === 0) {
    return { grade: '—', status: 'Absent', remarks: '', colorLevel: 'red', hexColor: '#ef4444', pct: 0 };
  }

  const pct = Math.round((obtained / total) * 100);

  if (!brackets.length) return fallbackGrade(pct);

  // Sort descending so first match wins for highest bracket
  const sorted = [...brackets].sort((a, b) => Number(b.max_pct) - Number(a.max_pct));
  const match = sorted.find(b => pct >= Number(b.min_pct) && pct <= Number(b.max_pct));

  if (!match) return fallbackGrade(pct);

  const hexColor =
    match.color_level === 'custom'
      ? (match.custom_hex || '#6b7280')
      : (COLOR_HEX[match.color_level] || '#6b7280');

  return {
    grade:      match.grade_title,
    status:     match.result_status === 'pass' ? 'Pass' : 'Fail',
    remarks:    match.remarks || '',
    colorLevel: match.color_level,
    hexColor,
    pct,
  };
}

/** Fetch the school's grading policy brackets from form_settings */
export async function fetchGradingPolicy(schoolId: string): Promise<GradingBracket[]> {
  const { data } = await supabase
    .from('form_settings')
    .select('sections_config')
    .eq('school_id', schoolId)
    .eq('form_name', 'grading_policy')
    .maybeSingle();

  if (data?.sections_config && Array.isArray(data.sections_config)) {
    return data.sections_config as GradingBracket[];
  }
  return [];
}

/** Fetch the school's result display settings */
export async function fetchResultConfig(schoolId: string): Promise<{
  show_gpa: boolean;
  show_position: boolean;
  show_remarks: boolean;
  result_title: string;
}> {
  const defaults = { show_gpa: false, show_position: true, show_remarks: true, result_title: 'Result Card' };
  const { data } = await supabase
    .from('form_settings')
    .select('sections_config')
    .eq('school_id', schoolId)
    .eq('form_name', 'result_settings')
    .maybeSingle();

  if (data?.sections_config) return { ...defaults, ...data.sections_config };
  return defaults;
}

/** Map a grade title to a 4.0 GPA point (best-effort) */
export function calculateGPA(grade: string): number {
  const map: Record<string, number> = {
    'A+': 4.0, 'A': 3.7, 'A-': 3.3,
    'B+': 3.0, 'B': 2.7, 'B-': 2.3,
    'C+': 2.0, 'C': 1.7, 'C-': 1.3,
    'D+': 1.0, 'D': 0.7,
    'F': 0.0,
  };
  return map[grade] ?? (grade === 'F' ? 0.0 : 2.0);
}

/** Build merged activeFields array from rcSettings + resultConfig */
export function buildActiveFields(
  rcSettingsFields: string[] | undefined,
  resultConfig: { show_gpa: boolean; show_position: boolean; show_remarks: boolean } | null,
): string[] {
  const base = rcSettingsFields || ['school_logo', 'gpa_summary', 'teacher_remarks'];
  const merged = new Set(base);
  // Always include evaluation so CharacterAssessment renders when data exists
  merged.add('evaluation');
  if (resultConfig?.show_position) merged.add('position_rank');
  if (resultConfig?.show_gpa)      merged.add('gpa_summary');
  if (resultConfig?.show_remarks)  merged.add('grade_remarks');
  return Array.from(merged);
}
