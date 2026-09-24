# 🏫 EdgeX Suite SaaS ERP — Master System Knowledge & AI Agent Guide
*Last updated: September 2026 | Definitive Technical & Architecture Reference for AI Agents*

> **Target Audience**: AI Agents (Antigravity, Claude, Gemini, Copilot) and Software Engineers.
> **Purpose**: Single source of truth for the entire EdgeX School SaaS ERP ecosystem. Read this guide before writing, refactoring, or querying any part of the codebase.

---

## 📑 Table of Contents
1. [Executive Overview & Business Domain](#1-executive-overview--business-domain)
2. [Technology Stack & Core Dependencies](#2-technology-stack--core-dependencies)
3. [Architecture, Tenancy & Security](#3-architecture-tenancy--security)
4. [Role Hierarchy & Granular RBAC](#4-role-hierarchy--granular-rbac)
5. [Complete Database Schema (69+ Tables)](#5-complete-database-schema)
6. [Frontend Codebase & Directory Map](#6-frontend-codebase--directory-map)
7. [Critical Conventions & Hard-Learned Gotchas](#7-critical-conventions--hard-learned-gotchas)
8. [PDF Generation & Printing Engine](#8-pdf-generation--printing-engine)
9. [Audit Logging Architecture](#9-audit-logging-architecture)
10. [Core Business Workflows](#10-core-business-workflows)
11. [Developer Commands & Verification Protocol](#11-developer-commands--verification-protocol)

---

## 1. Executive Overview & Business Domain

**EdgeX Suite** is a full-featured, multi-tenant Software-as-a-Service (SaaS) School Enterprise Resource Planning (ERP) platform. It manages all operational, academic, financial, and administrative aspects of modern K-12 institutions.

### Domain Characteristics
- **Bilingual & RTL**: Fully supports English (`en`) and Urdu (`ur`) with automated Right-To-Left (`dir="rtl"`) layout adjustments.
- **Pakistani & International School Standards**:
  - Currency: Pakistani Rupee (`₨` / `PKR`).
  - Fee Billing: 3-copy bank challans (School Copy, Bank Copy, Student/Parent Copy) with fine policies, sibling discounts, and advance payments.
  - Academic Structures: Multi-section classes (e.g. EF-1 BEG, Grade 1 through Grade 10/Matric/O-Levels), class teacher (incharge) roles, subject allocations.
  - Grading & Reporting: Custom grading scales (A+, A, B, C, D, F), position-in-class rankings, roll number admit cards, character/leaving certificates.
  - Primary Benchmark Tenant: "The Edge School Bahawalpur" (`school_id: aed24dc2-c3ac-47a1-9287-3b003934f720`).

---

## 2. Technology Stack & Core Dependencies

| Layer | Technology | Key Details & Version |
|---|---|---|
| **Frontend Framework** | React 19 / React 18 | `react`, `react-dom` (`^19.0.0`) with TypeScript (`^5.8.0`) |
| **Build Tool & Dev Server**| Vite | `vite` (`^5.4.14`), dev server on port 3000 (`0.0.0.0`) |
| **Styling** | Tailwind CSS v4 | `@tailwindcss/vite` (`^4.1.14`). **NO `tailwind.config.js`** — configured natively via `@theme` in `src/index.css`. |
| **Animations** | Motion v12 | `motion` (`^12.23.24`). Import from `motion/react`, **NEVER `framer-motion`**. |
| **Icons** | Lucide React | `lucide-react` (`^0.546.0`) |
| **Routing** | React Router v7 | `react-router-dom` (`^7.13.2`) |
| **Database & Auth** | Supabase | `@supabase/supabase-js` (`^2.100.0`), PostgreSQL with PostgREST, RLS on every table. |
| **Edge Functions** | Deno | Supabase Edge Functions (`supabase/functions/`) using `https://esm.sh` imports. |
| **PDF Generation** | jsPDF & jsPDF-AutoTable | `jspdf` (`^4.2.1`), `jspdf-autotable` (`^5.0.7`) |
| **Charts & Graphs** | Recharts | `recharts` (`^3.8.0`) |
| **Data Import/Export** | PapaParse & SheetJS | `papaparse` (`^5.5.3`), `xlsx` (`^0.18.5`) |
| **QR Codes** | HTML5-QRCode & React-QR-Code| `html5-qrcode` (`^2.3.8`) for scanning, `react-qr-code` (`^2.0.18`) for printing. |
| **AI Assistant** | Google Gemini SDK | `@google/genai` (`^1.29.0`) |
| **i18n** | i18next & react-i18next | `i18next` (`^25.10.5`), `react-i18next` (`^16.5.4`) |

---

## 3. Architecture, Tenancy & Security

### Multi-Tenant Model
1. **Tenant Key**: `school_id` (UUID). Every single business table includes `school_id`.
2. **Row-Level Security (RLS)**: Active across all Supabase tables. Queries without `school_id` are restricted by Postgres policies referencing `auth.uid()` mapped in `user_roles`.
3. **Application Query Rule**: Even with RLS active, **ALWAYS explicitly filter by `userRole.school_id`** in frontend queries:
   ```typescript
   const { data } = await supabase
     .from('students')
     .select('*')
     .eq('school_id', userRole.school_id);
   ```

### Auth & User Context (`src/contexts/AuthContext.tsx`)
The `useAuth()` hook provides:
```typescript
interface UserRole {
  role: 'admin' | 'director' | 'principal' | 'vice_principal'
      | 'academic_coordinator' | 'campus_coordinator' | 'section_coordinator'
      | 'accountant' | 'teacher' | 'staff' | 'librarian'
      | 'parent' | 'student';
  school_id: string;
  user_id: string;
  staff_id?: string;
  permissions?: {
    modules: Record<string, boolean>; // e.g. { fees: true, payroll: false }
    actions: Record<string, boolean>; // e.g. { force_delete: true, refund: false }
  };
  is_active?: boolean;
}
```
- `canAccess(moduleName)`: Returns `true` if `userRole.role === 'admin'` or `permissions.modules[moduleName] !== false`.
- `canDo(actionName)`: Returns `true` if `userRole.role === 'admin'` or `permissions.actions[actionName] === true`.

---

## 4. Role Hierarchy & Granular RBAC

The navigation and UI dynamically adjust based on user role and permissions defined in `src/constants/navigation.ts`:

### Role Definitions
1. **`admin` / `superadmin`**: Full institutional power across all schools or tenant modules, system settings, audit logs, and dangerous force-deletes.
2. **`director`**: High-level governance, executive financial summaries, P&L, KPI dashboards.
3. **`principal`**: Campus head with complete operational and academic visibility, approvals, and report signing.
4. **`vice_principal`**: Day-to-day academic administration, teacher diaries, substitutions, and discipline.
5. **Coordinators (`academic_coordinator`, `campus_coordinator`, `section_coordinator`)**: Dedicated coordinators monitoring assigned classes/sections, daily diaries, timetables, and teacher evaluations via `CoordinatorDashboard.tsx`.
6. **`accountant`**: Financial management: fee collections, monthly invoices, challan generation, expense vouchers, chart of accounts, payroll.
7. **`teacher`**: Academic execution: daily attendance, mark entry (`TeacherMarks.tsx`), teacher diary submission, lesson plans. If assigned as `class_incharge_id`, gains directory access to their class.
8. **`staff`**: General support staff (non-teaching) with profile, attendance, and leave requests.
9. **`librarian`**: Library catalog, book check-in/out, inventory, fines.
10. **`parent` & `student`**: Dedicated self-service portals (`ParentPortal.tsx`, `StudentPortal.tsx`) for fees, diaries, results, and timetables.

### Navigation Role Groups
```typescript
ALL_ADMIN    = ['admin', 'principal', 'director']
ALL_STAFF    = ['admin', 'principal', 'director', 'staff']
ALL_ACADEMIC = ['admin', 'principal', 'director', 'teacher', 'staff']
ALL_FINANCE  = ['admin', 'staff', 'accountant', 'principal', 'director']
ALL_REPORTS  = ['admin', 'staff', 'accountant', 'principal', 'director']
COORDINATOR_ROLES = ['academic_coordinator', 'campus_coordinator', 'section_coordinator']
```

---

## 5. Complete Database Schema

The database consists of 69+ interrelated tables in PostgreSQL:

### A. Core & Multi-Tenancy
- **`schools`**: Tenants. Columns: `id`, `name`, `school_code`, `logo_url`, `address`, `contact_phone`, `contact_email`, `status`.
- **`user_roles`**: Links Supabase Auth `user_id` to `school_id`, `role`, `staff_id`, `permissions` (JSONB), `is_active`, `last_login`.
- **`audit_logs`**: System audit trail. Columns: `id`, `school_id`, `action`, `module`, `entity_type`, `entity_id`, `entity_name`, `description`, `details` (JSONB), `metadata` (JSONB), `performed_by` (UUID), `created_at`.

### B. Academics & Curriculum
- **`academic_sessions`**: School years (e.g. "2025-2026", `is_current`).
- **`classes`**: Grade levels (`name`, `school_id`, `numeric_level`).
- **`sections`**: Class sections (`name`, `class_id`, `school_id`, `capacity`).
- **`subjects`**: Courses (`name`, `code`, `class_id`, `total_marks`, `passing_marks`, `school_id`).
- **`academic_coordinators`**: Links staff coordinators to classes or sections.

### C. People & Profiles
- **`students`**: Student directory. Columns: `id`, `school_id`, `admission_number`, `roll_number`, `first_name`, `last_name`, `father_name`, `gender`, `dob`, `class_id`, `section_id`, `photograph_url`, `status` (`active`/`inactive`), `monthly_discount`.
- **`parents`**: Guardian records (`full_name`, `phone`, `cnic`, `occupation`, `address`).
- **`student_parent_relations`**: Many-to-many relationship linking `student_id` and `parent_id` with `relationship_type` (Father, Mother, Guardian).
- **`family_groups` & `family_group_students`**: Sibling grouping for automated family discount calculations.
- **`staff`**: Employee registry. Columns: `id`, `school_id`, `employee_code`, `full_name`, `father_name`, `designation`, `department`, `phone`, `email`, `base_salary`, `class_incharge_id` (FK to `classes`), `status`.

### D. Fees, Billing & General Ledger
- **`fee_structures`**: Base monthly/term fees per class (`class_id`, `tuition_fee`, `admission_fee`, etc.).
- **`fee_criteria`**: Rule-based fee assignments.
- **`fee_records`**: Core student fee invoices. Columns: `id`, `school_id`, `student_id`, `class_id`, `month_year` (**always `YYYY-MM-01`**), `amount`, `paid_amount`, `discount_amount`, `fine_amount`, `status` (`paid`, `unpaid`, `partial`), `paid_date`, `challan_number`.
- **`student_fee_discounts`**: Custom recurring fee concessions per student.
- **`advance_fees`**: Credit balances paid ahead of billing cycles.
- **`chart_of_accounts`**: Financial hierarchy (`code`, `name`, `type`: Asset, Liability, Equity, Revenue, Expense).
- **`journal_entries` & `journal_entry_lines`**: Double-entry general ledger records posted automatically from fee collections and expense vouchers.
- **`daily_expenses`**: Expense voucher records (`expense_head_id`, `payment_source_id`, `amount`, `date`, `receipt_url`).
- **`expense_heads`** & **`payment_sources`**: Expense categorization and cash/bank accounts.

### E. Attendance
- **`attendance`**: Daily student attendance (`student_id`, `class_id`, `date`, `status`: `P` Present, `A` Absent, `L` Leave, `Late`).
- **`staff_attendance`**: Daily employee check-in/out records.
- **`qr_attendance_logs`**: Raw QR scan timestamps for student and staff kiosks.

### F. Timetable, Substitutions & Diary
- **`timetable_slots`**: Period schedule. **CRITICAL**: Uses `teacher_id` (FK to `staff.id`), NOT `staff_id`. Columns: `class_id`, `subject_id`, `teacher_id`, `day_of_week`, `period_number`, `room_number`.
- **`timetable_settings`**: Global schedule parameters (period duration, break times).
- **`teacher_substitutions`**: Temporary teacher reassignments for absent staff.
- **`teacher_diary`**: Daily class log. **CRITICAL**: Uses `teacher_id` (FK to `staff.id`). Columns: `class_id`, `subject_id`, `teacher_id`, `date`, `topic`, `homework`, `remarks`, `status`.
- **`lesson_plans`**: Curriculum syllabus breakdown and progress trackers.

### G. Examinations & Report Cards
- **`exam_types`**: Term evaluations (Mid-Term, Final, Monthly Test, `session_id`).
- **`exam_schedules`**: Exam date sheets and timings.
- **`exam_subject_configs`**: Total and passing marks configuration per exam and subject.
- **`exam_results`**: Marks sheet. Columns: `exam_type_id`, `student_id`, `subject_id`, `class_id`, `obtained_marks`, `total_marks`, `is_absent` (boolean), `remarks`.
- **`grading_rules`**: Letter grade rules (A+, A, B...) based on percentage ranges.
- **`report_card_settings`**: Design customizations for the 8 report card templates.

### H. Inventory & Stationery
- **`stationary_items`**, **`stationary_categories`**: Item catalog and stock tracking.
- **`stationary_sales`** & **`stationary_sale_items`**: POS sales to students/parents.
- **`stationary_transactions`**: Inventory restock and adjustment ledger.

### I. Operations & Logistics
- **`transport_routes`**, **`transport_stops`**, **`vehicles`**, **`transport_allocations`**: Bus fleet and student route mapping.
- **`library_books`**, **`library_issues`**, **`library_members`**: Book check-out and fine management.
- **`leave_applications`**: Staff and student leaves. Columns: `applicant_id`, `applicant_type`, `from_date`, `to_date` (**NOT start_date/end_date**), `status`.
- **`payroll_records`** & **`staff_allowances`**: Monthly salary slips, deductions, and payouts.
- **`admission_inquiries`** & **`visitor_log`**: Front desk visitor book and admissions CRM pipeline.
- **`notices`**, **`sms_logs`**, **`communication_templates`**: Notification logs and templates.
- **`complaints`** & **`complaint_responses`**: Parent/staff ticket management.

---

## 6. Frontend Codebase & Directory Map

```
c:\sms\saas-erp\
├── src\
│   ├── components\          # Reusable UI widgets & Modals
│   │   ├── StudentFeeModal.tsx     # Full fee collection modal
│   │   ├── DeletePinModal.tsx      # Secure PIN confirmation for delete actions
│   │   ├── CommandPalette.tsx      # Global search (Cmd+K)
│   │   ├── ErrorBoundary.tsx       # React error boundary
│   │   └── ...
│   ├── constants\
│   │   └── navigation.ts           # Navigation structure & role matrix
│   ├── contexts\
│   │   ├── AuthContext.tsx         # Multi-tenant auth, role, and permission checker
│   │   ├── ThemeContext.tsx        # Dark/light theme state
│   │   └── LanguageContext.tsx     # English / Urdu localization state
│   ├── lib\
│   │   ├── supabase.ts             # Supabase client singleton
│   │   ├── auditLog.ts             # Fire-and-forget logActivity() utility
│   │   ├── challanUtils.ts         # 3-copy PDF fee challan generator (jsPDF)
│   │   ├── fineUtils.ts            # Late fee calculation engine
│   │   ├── reportCardTemplates.tsx # 8 pixel-perfect A4 report card templates
│   │   ├── idCardTemplates.tsx     # Student & staff ID card renderers
│   │   ├── exportUtils.ts          # exportToCSV() helper
│   │   ├── gemini.ts               # Google Gemini AI assistant connector
│   │   └── utils.ts                # cn() class utility
│   ├── pages\
│   │   ├── students\               # Student directory, registration, bulk upload
│   │   ├── fees\                   # EasyFee, invoices, fee ledgers, challan settings
│   │   ├── result\                 # ResultStatus, marks entry, report card printing
│   │   ├── attendance\             # DailyReport, QR scanner, monthly stats
│   │   ├── staff\                  # Staff directory, accounts, payroll
│   │   ├── accounting\             # JournalEntry, ChartOfAccounts, TrialBalance
│   │   ├── expenses\               # Daily expenses, day book ledger
│   │   ├── timetable\              # Timetable builder, period scheduler
│   │   ├── diary\                  # Teacher diary & parent-facing view
│   │   ├── leave\                  # Staff & student leave workflows
│   │   ├── library\                # Catalog, book issue/returns
│   │   ├── transport\              # Bus routes, vehicles, stops
│   │   ├── frontdesk\              # Admission inquiries & visitor log
│   │   ├── settings\               # School info, permission manager, report card designer
│   │   ├── AuditLog.tsx            # Activity audit trail viewer
│   │   ├── CoordinatorDashboard.tsx# Comprehensive coordinator management screen
│   │   └── ...
│   ├── index.css                   # Tailwind v4 @theme declarations and print styles
│   └── App.tsx                     # Main router and route protection
```

---

## 7. Critical Conventions & Hard-Learned Gotchas

> [!CAUTION]
> **READ CAREFULLY**: Violating any of these rules causes immediate runtime errors or print layout breakage!

1. **Foreign Key Column Names**:
   - `timetable_slots` uses `teacher_id` (foreign key to `staff.id`), **NOT `staff_id`**.
   - `teacher_diary` uses `teacher_id` (foreign key to `staff.id`), **NOT `staff_id`**.
   - `leave_applications` uses `from_date` and `to_date`, **NOT `start_date` and `end_date`**.
   - `exam_results` is the table for marks (`obtained_marks`, `total_marks`, `is_absent`), **NOT `exam_marks`**.

2. **Date Format for Fee Records**:
   - `fee_records.month_year` **MUST ALWAYS** be formatted as `YYYY-MM-01` (first day of the month). Storing other days breaks monthly aggregation queries.

3. **Motion v12 Imports**:
   - Always import from `'motion/react'`, **NEVER `'framer-motion'`**:
     ```typescript
     import { motion, AnimatePresence } from 'motion/react';
     ```

4. **Tailwind v4 Configuration**:
   - There is **no `tailwind.config.js`**. All custom colors, fonts, and theme extensions live in `src/index.css` under `@theme`. Do not create a config file.

5. **A4 Print Layout Dimensions**:
   - Printable cards (report cards, ID cards, challans) must have a container sized **strictly** as:
     `width: 210mm; height: 297mm; overflow: hidden; box-sizing: border-box;`.
   - **NEVER use `minHeight`** — it causes content to spill into an empty second page.
   - For batch class printing, wrap each card in `.result-card-wrapper` with `page-break-after: always;`.

6. **Watermark Positioning**:
   - Use an absolute inset flexbox container (`position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;`) with opacity.
   - **Do NOT use** `top: 50%; left: 50%; transform: translate(-50%, -50%)`, as browser print engines clip transformed watermarks.

---

## 8. PDF Generation & Printing Engine

The ERP uses two printing mechanisms:

### A. Client-Side jsPDF & jsPDF-AutoTable
Used for reports like **Result Entry Status** (`ResultStatus.tsx`) and **Attendance Daily Report** (`DailyReport.tsx`):
- **Landscape A4**: `new jsPDF('l', 'mm', 'a4')` (Width: 297mm, Height: 210mm).
- **Portrait A4**: `new jsPDF('p', 'mm', 'a4')` (Width: 210mm, Height: 297mm).

> [!IMPORTANT]
> **Avoiding Duplicate Text Artifacts in AutoTable**:
> When custom-coloring or styling cell text in `autoTable`, **NEVER call `doc.text()` inside `didDrawCell`** without suppressing autoTable's native text rendering. Calling `doc.text()` on a cell that already has text renders it twice with an offset, resulting in blurry, ghosted text.
>
> **The Standard, Clean Pattern**:
> Use `didParseCell` to set styles directly on `data.cell.styles`:
> ```typescript
> didParseCell: (data) => {
>   if (data.section === 'body' && data.column.index === 8) {
>     const status = filtered[data.row.index]?.status;
>     if (status && STATUS_COLORS[status]) {
>       data.cell.styles.textColor = STATUS_COLORS[status];
>       data.cell.styles.fontStyle = 'bold';
>     }
>   }
> }
> ```

### B. HTML / CSS `@media print`
Used for **Report Cards**, **Fee Challans**, and **ID Cards**:
- Renders standard React components in the DOM.
- Triggered via `window.print()`.
- Uses `@media print { .no-print { display: none !important; } }`.

---

## 9. Audit Logging Architecture

All significant user actions (logins, creates, updates, deletes, fee payments, result entries) must be audited.

### The Standard Implementation (`src/lib/auditLog.ts`)
```typescript
import { logActivity } from '../lib/auditLog';

logActivity({
  school_id: userRole.school_id,
  user_id: userRole.user_id,
  user_name: staffName,
  user_role: userRole.role,
  action: 'CREATE', // 'LOGIN'|'CREATE'|'UPDATE'|'DELETE'|'PAY'|'APPROVE'|etc.
  module: 'Students', // 'Students'|'Fees'|'Results'|'Attendance'|etc.
  entity_type: 'student',
  entity_id: student.id,
  entity_name: student.full_name,
  description: `Admitted student ${student.full_name} to Class ${className}`,
});
```
- **Fire-and-Forget**: `logActivity` performs an asynchronous insert and logs errors via `console.warn`. It will **never** throw an unhandled exception or block user actions.
- Stored details are mapped into both `details` and `metadata` JSONB columns so queries always resolve user names even if auth users are deleted.

---

## 10. Core Business Workflows

### 1. Student Admission & Enrollment
1. Record inquiry at Front Desk (`AdmissionPipeline.tsx`).
2. Register student (`RegisterStudent.tsx`) → creates row in `students`.
3. Link guardians in `parents` and `student_parent_relations`.
4. If siblings exist, assign to `family_groups` for discounted billing.
5. Generate digital ID card (`DigitalIDCards.tsx`).

### 2. Fee Billing & Auto-Journaling
1. Set class fee criteria (`FeeCriteria.tsx`).
2. Generate bulk monthly invoices (`MonthlyFeeInvoices.tsx`) → inserts into `fee_records`.
3. Print 3-copy bank challan via `challanUtils.ts`.
4. Collect fee in `EasyFee.tsx` → updates `fee_records` status to `'paid'`.
5. System triggers auto-journal entry into `journal_entries` and `journal_entry_lines`, debiting Cash/Bank and crediting Fee Revenue.

### 3. Exam Schedule to Report Card Delivery
1. Create exam type in `AddExamType.tsx` (e.g. "Final Examination 2026").
2. Set date sheet in `AddExamSchedule.tsx`.
3. Configure subject max marks in `ExamSubjectConfig.tsx`.
4. Teachers input marks via `TeacherMarks.tsx`.
5. Administrators monitor progress in `ResultStatus.tsx` (Total, Complete, Partial, Pending percentages with PDF export).
6. Print individual or batch class report cards in `ResultReporting.tsx` using `reportCardTemplates.tsx`.

---

## 11. Developer Commands & Verification Protocol

### Key Commands
```powershell
# Development server (port 3000, 0.0.0.0 host)
npm run dev

# Full TypeScript check (must exit with code 0)
npx tsc --noEmit

# Production build test
npm run build
```

### Verification Checklist for AI Agents
- [ ] Run `npx tsc --noEmit` after code edits — verify 0 errors.
- [ ] Verify `school_id` filtering is present in all Supabase queries.
- [ ] Ensure foreign key names match the table definition (`teacher_id` vs `staff_id`).
- [ ] Ensure PDF autoTable modifications use `didParseCell` for styling to prevent duplicate text overlay.
- [ ] Ensure A4 printed containers maintain strict `210mm x 297mm` with `overflow: hidden`.
