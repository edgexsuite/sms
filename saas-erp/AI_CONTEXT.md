# 📘 EdgeX Suite — The Master Technical Reference (Total Ecosystem)
*Version 3.0 | Unified ERP & Superadmin Context*

## 🌐 System Architecture
The EdgeX ecosystem consists of two primary applications sharing a single PostgreSQL/Supabase backbone:
1.  **SaaS ERP (`saas-erp`)**: The multi-tenant school operations engine.
2.  **Superadmin Portal (`superadmin`)**: The control plane for managing school subscriptions, plans, and global analytics.

---

## 🛠 ERP Core Library (`src/lib/`)
The "Plumbing" of the ERP that AI agents must understand to avoid breaking logic:

- **`supabase.ts`**: The initialized client. Note that RLS (Row Level Security) is active on all tables.
- **`challanUtils.ts`**: The most complex library. It handles PDF generation using `jspdf`. It calculates balances, late fines based on `fineUtils`, and supports multi-copy printing (School/Parent/Bank copies).
- **`gemini.ts`**: Deep integration with Google Gemini for the in-app AI Assistant. Handles context injection from current school data for natural language queries.
- **`whatsappTemplates.ts`**: Pre-defined messaging structures for automated fee alerts and attendance notifications.
- **`uploadUtils.ts`**: Handles Student/Staff profile picture uploads to Supabase Storage.

---

## 🏛 ERP Module Map (Detailed)

### 📈 Finance & Ledger
- **`fees/`**: Handles the full lifecycle of a `fee_record`.
- **`expenses/Ledger.tsx`**: The chronological Unified Day Book.
- **Sync Rule**: Every `income` transaction in `financial_transactions` should ideally have a corresponding `invoice_number` in its remarks to ensure 1-to-1 matching with `fee_records`.

### 🎓 Academic Operations
- **`attendance/Attendance.tsx`**: Logic for marking Bulk Class Attendance. Note that `status` values are `P`, `A`, `L` (Present, Absent, Leave).
- **`result/ResultProcessing.tsx`**: Handles mark aggregation and grade calculation (`A`, `B`, `C` logic).
- **`diary/`**: Daily digital diary synced to the Parent/Student portals.

### 👥 HR & Staff
- **`payroll/`**: Generates monthly salaries. Takes `base_salary`, `allowances`, and `deductions` into account. Logs payouts as `expense` in the general ledger.

---

## 🏰 Superadmin Ecosystem (`superadmin`)
The management layer for the SaaS business:

- **`SchoolsList.jsx`**: CRUD for all school tenants. Handles `school_code` assignment.
- **`Subscriptions.jsx` & `PlanManagement.jsx`**: Controls feature flagging and quotas (e.g., max students allowed per school).
- **`EmailBroadcast.jsx`**: Tool for sending global updates to all School Principals.
- **`Analytics.jsx`**: Global dashboard showing total platform revenue and school growth metrics.

---

## 🔐 Security & Multi-Tenancy
- **Tenant Isolation**: Every table has a `school_id` column.
- **Authentication**: Handled via `AuthContext.tsx`. Roles include: `superadmin`, `principal`, `accountant`, `teacher`, `clerk`, `parent`, `student`.
- **RBAC**: Navigation is strictly filtered in `DashboardLayout.tsx` based on these roles.

## 🚀 Common Implementation Patterns
1. **Reporting**: Use `exportToCSV` from `exportUtils.ts` for all table data exports.
2. **Modals**: Most sophisticated UI interactions use `AnimatePresence` and `Framer Motion` for smooth transitions.
3. **Date Handling**: For `fee_records.month_year`, always use the first of the month (`YYYY-MM-01`). For transaction dates, use the literal day of the event.

## ⚠️ Known Gotchas (DO NOT BREAK)
- **CSS Hierarchy**: The project uses specialized glassmorphism effects. Any new `div` in a layout should typically have `rounded-xl` and `backdrop-blur` to match the aesthetic.
- **Print Styles**: Always include the `@media print` styles found in `Ledger.tsx` or `EasyFee.tsx` to ensure receipts aren't broken when printed.
- **Normalization**: If a Supabase query returns `data`, check if its a single object or array before accessing `.id`. (e.g., `data[0]?.id`).
