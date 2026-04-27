# 📘 EdgeX Suite — AI Context & Master Technical Reference
*Version 4.0 | Last updated: 2026-04-27 | For use as CLAUDE.md / AI agent context*

> **Purpose**: This file is the single source of truth for any AI agent (Claude, Gemini, Copilot) working inside this codebase. Read it fully before making any changes. It documents architecture, module map, key patterns, critical gotchas, and the tech stack.

---

## 🌐 System Architecture

The EdgeX Suite is a **multi-tenant SaaS School ERP** built on a single Supabase (PostgreSQL) backend. The monorepo contains two apps:

| App | Path | Tech | Purpose |
|-----|------|------|---------|
| **SaaS ERP** | `saas-erp/` | Vite + React 18 + TypeScript + Tailwind | School operations engine (per-school tenant) |
| **Superadmin Portal** | `superadmin/` | Vite + React + JSX | Global control plane (subscriptions, analytics) |

**Tech stack (ERP):**
- **Frontend**: React 18, TypeScript, TailwindCSS, Lucide-react icons
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **PDF/Print**: jsPDF (`challanUtils.ts`), browser `window.print()` with `@media print` CSS
- **AI**: Google Gemini (`gemini.ts`) for the in-app assistant
- **Edge Functions**: Deno runtime on Supabase (`supabase/functions/`) — uses `https://esm.sh` imports. VS Code will show false Deno errors; this is expected.

---

## 🛠 Core Library (`src/lib/`)

| File | Purpose |
|------|---------|
| `supabase.ts` | Initialized Supabase client. **RLS is active on all tables** — every query is automatically scoped to the authenticated user's school via RLS policies. |
| `challanUtils.ts` | **Most complex file.** PDF fee challan generation using jsPDF. Calculates balances, late fines (via `fineUtils`), and produces 3-copy print layout (School / Parent / Bank). Do not change without understanding the full balance calculation chain. |
| `fineUtils.ts` | Fine/late-fee calculation helpers consumed by `challanUtils`. |
| `reportCardTemplates.tsx` | **Large file (~85KB).** Defines 8 report card templates: `classic`, `modern`, `minimal`, `elegant`, `compact`, `royal`, `prestige`, `pearl`. Each is a self-contained React component rendering a strict `210mm × 297mm` A4 card with `overflow: hidden`. Contains `ReportCardLayoutRenderer` (the dispatch switch), `ReportCardProps` interface, and `ReportCardCustomization` type. |
| `idCardTemplates.tsx` | ID card template renderer. Similar pattern to report cards. Multiple visual styles. |
| `gemini.ts` | Google Gemini API integration. Injects real school data as context for the AI assistant. |
| `whatsappTemplates.ts` | Pre-built WhatsApp message templates for fee alerts and attendance notifications. |
| `uploadUtils.ts` | Student and staff photo uploads to Supabase Storage. |
| `exportUtils.ts` | `exportToCSV()` utility used across all table pages for data download. |
| `utils.ts` | Minimal helper (e.g., `cn()` for Tailwind class merging). |
| `seedData.ts` | Demo data seeder for development. |

---

## 🏛 Module Map — Full Page Inventory

### 👥 Students (`src/pages/students/`)
| File | Purpose |
|------|---------|
| `StudentList.tsx` | Main student registry (~104KB). Full CRUD, filters, bulk actions, force-delete with ledger wipe. |
| `RegisterStudent.tsx` | Multi-step admission form (~64KB). |
| `StudentDetailPage.tsx` | Full student profile: info, fees, results, attendance (~59KB). |
| `BulkEnrollment.tsx` | Import students from CSV/Excel. |
| `CustomStudentList.tsx` | Configurable report-style student list with column picker. |
| `PromoteStudents.tsx` | End-of-year class promotion workflow. |
| `DigitalIDCards.tsx` | Render & print student ID cards using `idCardTemplates.tsx`. |
| `AdmissionForm.tsx` | Printable admission form. |
| `LeavingCertificate.tsx` | School leaving certificate generator. |
| `CharacterCertificate.tsx` | Character certificate generator. |
| `BirthCertificate.tsx` | Birth certificate generator. |
| `ProgressReport.tsx` | Simplified progress card print. |
| `ParentSMSHistory.tsx` | Logs of SMS messages sent to parents. |
| `CustomizeForm.tsx` | Drag-and-drop form field customizer for admission forms. |
| `StudentReports.tsx` | Analytics and aggregate student reports. |

### 💰 Fees (`src/pages/fees/`)
| File | Purpose |
|------|---------|
| `EasyFee.tsx` | **Primary fee collection screen** (~34KB). Search student → collect payment → print challan. Uses `challanUtils.ts`. |
| `MonthlyFeeInvoices.tsx` | Bulk invoice generation for a class/month (~46KB). |
| `StudentFeeDetail.tsx` | Per-student fee ledger with history (~37KB). |
| `StudentFeeHistory.tsx` | Cross-session fee history view (~30KB). |
| `FeeTemplates.tsx` | Create/manage fee structure templates assigned to classes. |
| `FeeCriteria.tsx` | Fee rules per class/section. |
| `DiscountScholarship.tsx` | Discount & scholarship management. |
| `AdvanceFee.tsx` | Record advance payments. |
| `AverageFee.tsx` | Average fee analytics per class. |
| `ChallanSettings.tsx` | Configure challan header, bank info, due dates. |
| `ChallanFormSettings.tsx` | Visual/layout settings for printed challans. |
| `FinePolicy.tsx` | Configure late fine rules (consumed by `fineUtils.ts`). |

### 📊 Results (`src/pages/result/`)
| File | Purpose |
|------|---------|
| `ResultReporting.tsx` | **Individual + batch report card printing.** Selects exam+class+student → renders `ReportCardLayoutRenderer`. Has a **"Print All Class"** button that fetches all students' results in one query, calculates rank (position in class), and renders all cards with `page-break-after: always`. |
| `AddResult.tsx` | Manual mark entry per student/subject. |
| `TeacherMarks.tsx` | Teacher-facing mark entry interface (~27KB). |
| `ImportResult.tsx` | Bulk result import from CSV/Excel (~23KB). |
| `ConsolidatedResult.tsx` | Class-level result summary table. |
| `AddExamType.tsx` | Create exam types (Mid-Term, Final, etc.). |
| `AddExamSchedule.tsx` | Exam timetable/schedule management. |
| `GradingPolicy.tsx` | Define grading scales (A+/A/B/C etc.) per school. |
| `RollNumberSlips.tsx` | Print roll number admit cards. |
| `ResultSetting.tsx` | Result display preferences. |

### 🗓 Attendance (`src/pages/attendance/`)
| File | Purpose |
|------|---------|
| `MarkAttendance.tsx` | Bulk class attendance marking. Status values: `P` (Present), `A` (Absent), `L` (Leave). |
| `QRScanner.tsx` | QR-code based attendance (~50KB). Requires camera permission. |
| `QRAttendanceCards.tsx` | Print QR cards for students. |
| `AutoAttendance.tsx` | Automated attendance rules. |
| `DailyReport.tsx` | Day-level attendance report. |
| `MonthlyReport.tsx` | Monthly attendance summary. |
| `SessionalReport.tsx` | Full-term attendance analysis. |
| `StaffAttendance.tsx` | Staff attendance marking. |
| `StaffAttendanceReport.tsx` | Staff attendance reporting. |
| `AbsentStudentList.tsx` | Today's absent students at a glance. |
| `SMSHistory.tsx` | Logs of absence SMS notifications. |

### 👔 Staff (`src/pages/staff/`)
| File | Purpose |
|------|---------|
| `StaffUserAccounts.tsx` | **Staff credential management** (~63KB). Create portal login accounts for staff via the `create-staff-user` Edge Function. Assigns roles (teacher, accountant, clerk, etc.), sets class-incharge, manages login enable/disable. |
| `StaffDetailPage.tsx` | Full staff profile: personal info, documents, payroll history (~39KB). |
| `StaffDigitalIDCards.tsx` | Render & print staff ID cards. |

### 🧾 Accounting (`src/pages/accounting/`)
| File | Purpose |
|------|---------|
| `JournalEntry.tsx` | Double-entry journal posting (~16KB). |
| `ChartOfAccounts.tsx` | Account hierarchy management. |
| `TrialBalance.tsx` | Trial balance report. |
| `BalanceSheet.tsx` | Balance sheet view. |

### ⚙️ Settings (`src/pages/settings/`)
| File | Purpose |
|------|---------|
| `ReportCardSettings.tsx` | Report card designer UI. Template picker (8 templates), typography (font family), size controls, color pickers, signature line editor, display field toggles (logo, watermark, photo, attendance, GPA, teacher remarks, position in class). Saves to `report_card_settings` table with `{ template, fields, layout_config: { customization } }`. |
| `IDCardSettings.tsx` | ID card designer, similar pattern to report card settings. |
| `PermissionManager.tsx` | Fine-grained role-based permission editor per school (~29KB). |
| `Trashbin.tsx` | Soft-delete recovery bin. |

### Other Top-Level Pages
| File | Purpose |
|------|---------|
| `Timetable.tsx` | Full timetable builder (~95KB). Teachers with an assigned class (incharge) can see their class students and also view/manage their assigned periods. |
| `Staff.tsx` | Staff directory and HR overview (~45KB). |
| `Students.tsx` | Student overview page. |
| `Settings.tsx` | School-level settings hub (~56KB). |
| `ParentPortal.tsx` | Self-service parent portal (~64KB). |
| `StudentPortal.tsx` | Self-service student portal (~51KB). |
| `TeacherDashboard.tsx` | Teacher home with timetable, marks, attendance widgets (~37KB). |
| `PrincipalDashboard.tsx` | Principal analytics dashboard. |
| `AccountantDashboard.tsx` | Accountant home with fee summary widgets. |
| `Dashboard.tsx` | Admin/general dashboard (~25KB). |
| `Communication.tsx` | Messaging and announcements (~33KB). |
| `Complaints.tsx` | Complaint management system (~18KB). |
| `Evaluation.tsx` | Staff evaluation module. |
| `Exams.tsx` | Exam management. |
| `Inventory.tsx` | School inventory tracking (~31KB). |
| `Library.tsx` (in `library/`) | Library management. |
| `Payroll` (in `payroll/`) | Monthly salary generation. Takes `base_salary`, `allowances`, `deductions`. Posts expense to general ledger. |
| `Diary` (in `diary/`) | Digital daily diary synced to parent/student portals. |
| `Transport` (in `transport/`) | Transport route and vehicle management. |
| `FrontDesk` (in `frontdesk/`) | Visitor/reception management. |
| `Leave` (in `leave/`) | Staff leave application & approval. |
| `AIAssistant.tsx` | Gemini-powered in-app assistant. |
| `HelpSupport.tsx` | Support ticketing. |
| `Credentials` (`credentials/CredentialDispatch.tsx`) | Send login credentials to staff/students via SMS or print. |
| `Family` (`family/`) | Family/sibling grouping for fee discounts. |

---

## 🔐 Security & Multi-Tenancy

- **Tenant Isolation**: Every table has a `school_id` column. RLS enforces this automatically — never skip it.
- **Auth**: `AuthContext.tsx` provides `userRole` object: `{ school_id, role, id, ... }`.
- **Roles**: `superadmin` · `principal` · `accountant` · `teacher` · `clerk` · `parent` · `student`
- **RBAC**: Navigation filtered in `DashboardLayout.tsx` based on role. Use `userRole.role` checks for conditional rendering.
- **Teacher class-incharge**: Teachers assigned as class incharge can see all students in their class AND their timetable-assigned periods/classes.

---

## 🖨 Report Card System (Critical — Read Before Editing)

### Templates (in `src/lib/reportCardTemplates.tsx`)
All 8 templates follow this contract:
- **Container**: `width: 210mm; height: 297mm; overflow: hidden; box-sizing: border-box` — **NEVER use `minHeight`**, it causes two-page print.
- **Watermark**: Uses a full-inset `position: absolute` flexbox div wrapping the image, **not** `top: 50%; transform: translate(-50%, -50%)` (that bleeds out of the page during print).
- **Props interface**: `ReportCardProps` — includes `examName`, `examSession`, `positionInClass`, `totalStudents`, `finalStatus`, `studentPhoto`, `subjects[].status`.
- **Customization**: `ReportCardCustomization` — `headerFontSize`, `tableFontSize`, `remarksFontSize`, `logoSize`, `watermarkOpacity`, `primaryColor`, `tableHeaderColor`, `borderColor`, `titleFont`, `signatures[]`.

### Templates Reference
| ID | Style |
|----|-------|
| `classic` | Traditional serif, bordered table |
| `modern` | Dark navy header, sans-serif |
| `minimal` | Monospace, grayscale |
| `elegant` | Centered profile with photo |
| `compact` | Dense layout for many subjects |
| `royal` | Navy + gold, SVG wave on right |
| `prestige` | Forest green left sidebar, corporate |
| `pearl` | Teal-to-navy gradient header, card-based |

### Batch Class Printing (`ResultReporting.tsx`)
- **"Print All Class"** button fetches all students' results in a **single Supabase query** (`.in('student_id', ids)`), computes ranks client-side, then renders all cards with `page-break-after: always`.
- Print CSS wrapper class: `.result-card-wrapper` — `height: 297mm; overflow: hidden; page-break-after: always`.
- `@page { size: A4 portrait; margin: 0; }` is injected via `<style>` tag.

---

## ⚡ Supabase Edge Functions (`supabase/functions/`)

All functions run on **Deno** (not Node.js). Import from `https://esm.sh`. VS Code shows Deno errors as false positives — this is normal. A `.vscode/settings.json` with `"deno.enable": true` suppresses them.

| Function | Purpose |
|----------|---------|
| `create-staff-user` | Creates a Supabase Auth user for a staff member, sets their role in `user_roles`, assigns class-incharge, emails credentials. |
| `manage-staff-user` | Update/disable/enable staff login accounts. |
| `send-message` | Sends WhatsApp/SMS messages via third-party API. |

---

## 🗄 Key Database Tables

| Table | Notes |
|-------|-------|
| `schools` | One row per tenant. Has `logo_url`, `name`, `school_code`. |
| `students` | `status`: `active` / `inactive`. Has `class_id`, `roll_number`, `photograph_url`. |
| `staff` | Has `class_incharge_id` (FK to `classes`). |
| `user_roles` | Maps `user_id` (Supabase Auth) → `school_id` + `role`. |
| `classes` | Has `name`, `section`, `school_id`. |
| `subjects` | Linked to `class_id`. Has `passing_marks`, `total_marks`. |
| `exam_types` | Per school. Has `name`, `session`. |
| `exam_results` | `student_id`, `subject_id`, `exam_type_id`, `obtained_marks`, `total_marks`. |
| `fee_records` | `month_year` always stored as `YYYY-MM-01` (first of month). |
| `financial_transactions` | Unified ledger. `type`: `income` / `expense`. |
| `report_card_settings` | Per school. Columns: `school_id`, `template`, `fields` (array), `layout_config` (JSONB with `{ customization }`). |
| `timetable` | Has `teacher_id`, `class_id`, `subject_id`, `day`, `period`. |
| `attendance` | Status: `P`, `A`, `L`. |

---

## 🚀 Common Implementation Patterns

1. **Fetch with school scope**: Always filter by `userRole?.school_id`. RLS is a safety net, not a substitute.
2. **CSV export**: Use `exportToCSV()` from `exportUtils.ts` for all table data.
3. **Print**: Inject `<style>` with `@media print { .no-print { display: none !important; } }`. Use `.result-card-wrapper` for A4 cards.
4. **Modals & animations**: Use Framer Motion `AnimatePresence` for all modal transitions.
5. **Date storage**: `fee_records.month_year` → always `YYYY-MM-01`. Transaction dates → actual event date.
6. **Supabase upsert**: Use `{ onConflict: 'column_name' }` for settings tables.
7. **Loading state**: Standard pattern is `const [loading, setLoading] = useState(true)` with a spinner div during data fetch.
8. **Image uploads**: Use `uploadUtils.ts` — returns a public URL to store in the table.

---

## ⚠️ Critical Gotchas — DO NOT BREAK

- **Report card container**: Always `height: 297mm` + `overflow: hidden`. Never `minHeight` — it causes the card to spill onto a second printed page.
- **Watermark positioning**: Use an inset absolute flex container, not `translate(-50%, -50%)` — that escapes the page clip boundary during print.
- **Fee month format**: `YYYY-MM-01`. If you store `YYYY-MM-DD`, monthly grouping queries will break.
- **RLS active**: Never assume a query returns all rows. It returns only rows matching the user's `school_id` via policy.
- **Supabase single()**: Throws if 0 rows found. Use `maybeSingle()` when the row may not exist (e.g., settings tables).
- **Deno Edge Functions**: Do not run them with Node. They use Deno APIs and `esm.sh` imports. Deploy via `supabase functions deploy`.
- **CSS naming**: The project uses glassmorphism / dark aesthetic. New panels should follow `rounded-xl`, `shadow-xl`, `border border-slate-200` conventions.
- **Position-in-class ranking**: Computed client-side in `ResultReporting.tsx` by summing `obtained_marks` per `student_id` from `exam_results`, then sorting descending.
- **TypeScript fallback objects**: When destructuring `{ grade, status }` from a ternary, the fallback object must only contain `grade` and `status` — do not add extra properties like `pct` (causes TS2353).

---

## 🏰 Superadmin Portal (`superadmin/`)

| Component | Purpose |
|-----------|---------|
| `SchoolsList.jsx` | CRUD for school tenants. Assigns `school_code`. |
| `Subscriptions.jsx` | Feature flags and quotas per school. |
| `PlanManagement.jsx` | SaaS plan definitions. |
| `EmailBroadcast.jsx` | Bulk email to all principals. |
| `Analytics.jsx` | Platform-wide revenue and school growth metrics. |

Shares the same Supabase instance. Superadmin queries bypass school-scoped RLS via the `service_role` key (used server-side only).

---

## 📦 Dependency Reference (`package.json`)

| Package | Version | Use |
|---------|---------|-----|
| `react` / `react-dom` | ^19.0.0 | UI framework |
| `react-router-dom` | ^7.13.2 | Client-side routing |
| `@supabase/supabase-js` | ^2.100.0 | Database + Auth + Storage |
| `@google/genai` | ^1.29.0 | Gemini AI assistant |
| `@sentry/react` | ^10.50.0 | Error monitoring |
| `tailwindcss` | ^4.1.14 | Utility CSS (v4 — no `tailwind.config.js`, uses CSS-native config) |
| `motion` | ^12.23.24 | Animations (replaces `framer-motion` — import from `motion/react`) |
| `lucide-react` | ^0.546.0 | Icons |
| `recharts` | ^3.8.0 | Charts and analytics graphs |
| `jspdf` | ^4.2.1 | PDF generation (fee challans) |
| `jspdf-autotable` | ^5.0.7 | Table rendering in PDFs |
| `papaparse` | ^5.5.3 | CSV parsing for bulk imports |
| `xlsx` | ^0.18.5 | Excel file read/write |
| `html2canvas` | ^1.4.1 | Screenshot/canvas capture (ID cards) |
| `html5-qrcode` | ^2.3.8 | QR code scanner (attendance kiosk) |
| `react-qr-code` | ^2.0.18 | QR code generator (print cards) |
| `i18next` + `react-i18next` | ^25 / ^16 | Internationalization (EN + UR) |
| `vite-plugin-pwa` | ^1.2.0 | Progressive Web App support |
| `clsx` + `tailwind-merge` | — | `cn()` utility in `utils.ts` |

> ⚠️ **Tailwind v4**: No `tailwind.config.js`. All customization is done in `index.css` with `@theme` directives. Do NOT try to add a config file.

> ⚠️ **Motion v12**: Import animations as `import { motion, AnimatePresence } from 'motion/react'` — NOT from `framer-motion`.

---

## 🔑 AuthContext API (`src/contexts/AuthContext.tsx`)

```typescript
// Shape of userRole object
interface UserRole {
  role: 'admin' | 'teacher' | 'staff' | 'accountant' | 'librarian' | 'parent' | 'principal' | 'director';
  school_id: string;
  user_id: string;
  staff_id?: string;
  permissions?: {
    modules: Record<string, boolean>;  // e.g. { fees: true, payroll: false }
    actions: Record<string, boolean>;  // e.g. { force_delete: true }
  };
  is_active?: boolean;
}

// Usage in any component
const { userRole, canAccess, canDo } = useAuth();

canAccess('fees')       // true if role=admin OR permissions.modules.fees===true (default: true if key absent)
canDo('force_delete')   // true if role=admin OR permissions.actions.force_delete===true (default: false)
```

**Auth edge cases:**
- `roleNotFound: true` → user is authenticated but has no `user_roles` row → show "contact admin" screen.
- `is_active === false` → account suspended → auto sign-out + alert.
- `TOKEN_REFRESHED` events are deduplicated (won't re-fetch role on token refresh — prevents 429s).
- `last_login` timestamp is updated fire-and-forget on every successful login.

---

## 🎨 ThemeContext (`src/contexts/ThemeContext.tsx`)

Provides dark/light mode toggle stored in `localStorage`. Access via `useTheme()`. All pages should use `dark:` Tailwind variants for dark mode support. The root `<html>` element gets `class="dark"` when active.

---

## 🧭 Navigation System (`src/constants/navigation.ts`)

Navigation is role-filtered via `NAV_SECTIONS` array. Each item/section has a `roles` array.

**Role group constants** (use these — don't hardcode arrays):
```typescript
ALL_ADMIN    = ['admin', 'principal', 'director']
ALL_STAFF    = ['admin', 'principal', 'director', 'staff']
ALL_ACADEMIC = ['admin', 'principal', 'director', 'teacher', 'staff']
ALL_FINANCE  = ['admin', 'staff', 'accountant', 'principal', 'director']
ALL_REPORTS  = ['admin', 'staff', 'accountant', 'principal', 'director']
```

**Navigation sections** (in order): Overview → People & Enrollment → Curriculum → Attendance & Leave → Exams & Results → Finance → Reports → School Services → System

**Additional role**: `librarian` — has access to Library and basic dashboard only.

---

## 📂 Remaining Module Details

### 📚 Library (`src/pages/library/`)
| File | Purpose |
|------|---------|
| `LibraryCatalog.tsx` | Book/resource catalog management |
| `LibraryIssues.tsx` | Issue and return tracking |
| `LibraryMembers.tsx` | Library membership management |

### 🚌 Transport (`src/pages/transport/`)
| File | Purpose |
|------|---------|
| `TransportDashboard.tsx` | Overview and stats |
| `Routes.tsx` | Route and stop management |
| `Vehicles.tsx` | Vehicle fleet management |
| `StudentTransport.tsx` | Assign students to routes |

### 💵 Expenses (`src/pages/expenses/`)
| File | Purpose |
|------|---------|
| `AddDailyExpenses.tsx` | Daily expense entry form |
| `Ledger.tsx` | **Unified Day Book** — chronological expense ledger. Contains `@media print` styles used as the reference for all print receipts. |
| `ExpenseHeads.tsx` | Expense category setup |
| `Budget.tsx` | Budget vs. actual tracking |
| `ExpenseReports.tsx` | Aggregate expense analytics |
| `PaymentSources.tsx` | Cash/bank/account source management |
| `ProfitLoss.tsx` | P&L statement |
| `BulkExpenseImport.tsx` | CSV bulk expense import |

### 💼 Payroll (`src/pages/payroll/`)
| File | Purpose |
|------|---------|
| `Payroll.tsx` | Monthly salary processing. Reads `base_salary`, `allowances`, `deductions` from staff records. Posts payout as `expense` in the general ledger. |
| `Allowances.tsx` | Define allowance types (HRA, TA, Medical, etc.) |
| `SalarySlips.tsx` | Printable salary slip generator |
| `PayrollReports.tsx` | Payroll analytics and summaries |

### 🏖 Leave (`src/pages/leave/`)
| File | Purpose |
|------|---------|
| `StudentLeave.tsx` | Student leave applications and approval |
| `StaffLeave.tsx` | Staff leave applications, approval workflow, leave balance |
| `TeacherDiary.tsx` | **Note**: Also found in `src/pages/leave/` (teacher diary entry — different from `diary/TeacherDiary.tsx` which is the parent-facing view) |

### 📔 Diary (`src/pages/diary/`)
| File | Purpose |
|------|---------|
| `TeacherDiary.tsx` | Full teacher diary management (~34KB). Daily notes visible to parents/students in their portals. |

### 🏢 Front Desk (`src/pages/frontdesk/`)
| File | Purpose |
|------|---------|
| `AdmissionPipeline.tsx` | Kanban-style admission inquiry tracker (~41KB) |
| `AdmissionInquiries.tsx` | Inquiry form and list |
| `VisitorBook.tsx` | Visitor log register |
| `NoticeBoard.tsx` | School notice/announcement board |

### 👨‍👩‍👧 Family (`src/pages/family/`)
| File | Purpose |
|------|---------|
| `FamilyGroups.tsx` | Group siblings for shared fee discounts |

### 🏫 Classes (`src/pages/classes/`)
| File | Purpose |
|------|---------|
| `ClassSectionManagement.tsx` | Create/edit classes and sections |
| `SubjectManagement.tsx` | Subject CRUD, assign to classes (~24KB) |
| `ClassStudents.tsx` | View students enrolled in a class |

### 📋 Reports (`src/pages/reports/`)
| File | Purpose |
|------|---------|
| `MasterSummaryReport.tsx` | Cross-module analytics dashboard (~30KB). Aggregates fee, attendance, result, and staff data. |

---

## 🧩 Shared Components (`src/components/`)

| File | Purpose |
|------|---------|
| `StudentFeeModal.tsx` | **Largest component** (~40KB). Full fee payment modal — search student, select months, calculate dues, process payment. Used in `EasyFee.tsx`. |
| `StudentFeeOverrideModal.tsx` | Override fee amount for special cases. |
| `DeletePinModal.tsx` | PIN confirmation modal for dangerous delete operations (soft/force delete). |
| `CommandPalette.tsx` | Global search / command palette (Cmd+K). |
| `DashboardAlerts.tsx` | School-wide alerts and announcements banner. |
| `ImportStaffModal.tsx` | CSV import modal for bulk staff upload. |
| `JoiningLetter.tsx` | Generate staff joining letter PDF. |
| `ExperienceCertificate.tsx` | Generate staff experience certificate PDF. |
| `LoadingIndicator.tsx` | Fullscreen loading spinner. |
| `ErrorBoundary.tsx` | React error boundary for graceful crash handling. |

---

## 🌐 i18n & RTL (`src/i18n/`)

- Supports **English (`en`)** and **Urdu (`ur`)**.
- When language switches to `ur`, the document `dir` is automatically set to `rtl`. All layouts must be RTL-safe.
- Language is changed via `i18n.changeLanguage('ur')`.
- Translations in `src/i18n/locales/en.json` and `ur.json`.
- Custom silent logger suppresses the i18next Locize promo console message.

---

## 📱 PWA Configuration

- `vite-plugin-pwa` is enabled — the app is installable as a PWA.
- Service worker is auto-generated via Workbox.
- Do not add large in-memory caches that could conflict with SW caching.

---

## 🔧 Dev Server & Build

```powershell
npm run dev     # Start dev server on port 3000 (all interfaces)
npm run build   # Production build → dist/
npm run lint    # TypeScript type-check (no emit)
```

---

## 🌍 Environment Variables

Required in `.env` (not committed to git):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
```

Access in code: `import.meta.env.VITE_SUPABASE_URL`

