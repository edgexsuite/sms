/**
 * auditLog.ts
 * Fire-and-forget audit logging helper.
 * Import and call logActivity() from any page — never blocks the UI.
 *
 * Usage:
 *   logActivity({
 *     school_id: userRole.school_id,
 *     user_id:   userRole.user_id,
 *     user_name: staffName,
 *     user_role: userRole.role,
 *     action:    'CREATE',
 *     module:    'Students',
 *     entity_name: student.full_name,
 *     description: `Added student ${student.full_name} to Class 5A`,
 *   });
 */
import { supabase } from './supabase';

export type AuditAction =
  | 'LOGIN' | 'LOGOUT'
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'PAY' | 'REFUND'
  | 'EXPORT' | 'PRINT'
  | 'APPROVE' | 'REJECT'
  | 'ASSIGN' | 'MARK';

export type AuditModule =
  | 'Auth'
  | 'Students' | 'Staff' | 'Parents'
  | 'Fees' | 'Expenses' | 'Payroll' | 'Accounting'
  | 'Attendance' | 'Results' | 'Timetable'
  | 'Leave' | 'Diary' | 'Library'
  | 'Transport' | 'Inventory' | 'Settings'
  | 'Reports' | 'Communication';

export interface AuditParams {
  school_id:   string;
  user_id?:    string;
  user_name?:  string;
  user_role?:  string;
  action:      AuditAction;
  module:      AuditModule;
  entity_type?: string;
  entity_id?:   string;
  entity_name?: string;
  description:  string;
  metadata?:    Record<string, any>;
}

export function logActivity(params: AuditParams): void {
  supabase.from('audit_logs').insert({
    school_id:   params.school_id,
    user_id:     params.user_id   || null,
    user_name:   params.user_name || 'System',
    user_role:   params.user_role || 'unknown',
    action:      params.action,
    module:      params.module,
    entity_type: params.entity_type || null,
    entity_id:   params.entity_id   || null,
    entity_name: params.entity_name || null,
    description: params.description,
    metadata:    params.metadata    || null,
  }).then(({ error }) => {
    if (error) console.warn('[AuditLog]', error.message);
  });
}
