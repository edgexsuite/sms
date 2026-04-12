export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string
          name: string
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          school_id: string
          role: 'admin' | 'teacher' | 'staff' | 'parent'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          school_id: string
          role: 'admin' | 'teacher' | 'staff' | 'parent'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          school_id?: string
          role?: 'admin' | 'teacher' | 'staff' | 'parent'
          created_at?: string
        }
      }
      classes: {
        Row: {
          id: string
          school_id: string
          name: string
          section: string
          class_teacher_id: string | null
        }
        Insert: {
          id?: string
          school_id: string
          name: string
          section: string
          class_teacher_id?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          name?: string
          section?: string
          class_teacher_id?: string | null
        }
      }
      students: {
        Row: {
          id: string
          school_id: string
          parent_id: string | null
          class_id: string | null
          b_form_cnic: string | null
          roll_number: number
          full_name: string
          dob: string | null
          gender: string | null
          blood_group: string | null
          address: string | null
          religion: string | null
          nationality: string | null
          father_name: string | null
          father_cnic: string | null
          father_contact: string | null
          father_occupation: string | null
          mother_name: string | null
          mother_cnic: string | null
          mother_contact: string | null
          mother_occupation: string | null
          siblings_in_school: string | null
          height: string | null
          weight: string | null
          eyesight: string | null
          medical_issues: string | null
          admission_date: string
          status: 'active' | 'left' | 'graduated'
        }
        Insert: {
          id?: string
          school_id: string
          parent_id?: string | null
          class_id?: string | null
          b_form_cnic?: string | null
          roll_number?: number
          full_name: string
          dob?: string | null
          gender?: string | null
          blood_group?: string | null
          address?: string | null
          religion?: string | null
          nationality?: string | null
          father_name?: string | null
          father_cnic?: string | null
          father_contact?: string | null
          father_occupation?: string | null
          mother_name?: string | null
          mother_cnic?: string | null
          mother_contact?: string | null
          mother_occupation?: string | null
          siblings_in_school?: string | null
          height?: string | null
          weight?: string | null
          eyesight?: string | null
          medical_issues?: string | null
          admission_date?: string
          status?: 'active' | 'left' | 'graduated'
        }
        Update: {
          id?: string
          school_id?: string
          parent_id?: string | null
          class_id?: string | null
          b_form_cnic?: string | null
          roll_number?: number
          full_name?: string
          dob?: string | null
          gender?: string | null
          blood_group?: string | null
          address?: string | null
          religion?: string | null
          nationality?: string | null
          father_name?: string | null
          father_cnic?: string | null
          father_contact?: string | null
          father_occupation?: string | null
          mother_name?: string | null
          mother_cnic?: string | null
          mother_contact?: string | null
          mother_occupation?: string | null
          siblings_in_school?: string | null
          height?: string | null
          weight?: string | null
          eyesight?: string | null
          medical_issues?: string | null
          admission_date?: string
          status?: 'active' | 'left' | 'graduated'
        }
      }
      // Add other tables (fees, attendance, exams) similarly
    }
  }
}
