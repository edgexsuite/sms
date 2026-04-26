# EdgeX Suite — Modern School ERP

![EdgeX Banner](https://images.unsplash.com/photo-1546410531-bb4caa1b424d?auto=format&fit=crop&q=80&w=2071)

EdgeX Suite is a premium, high-performance School Management System (SaaS) designed to streamline academic operations, financial tracking, and data migration for modern educational institutions.

## 🚀 Core Features

### 💎 Advanced Financial Management
- **Unified Day Book Ledger**: A real-time chronological sheet consolidating all income and expenses.
- **Dynamic Fee Collection**: "EasyFee" quick-collection module with support for mixed payment modes (Cash, Bank, Mobile Wallets).
- **Automated Fine Logic**: Configurable late fine policies that calculate dynamically during collection.

### 📅 Historical Data & Migration Tools
- **Retroactive Invoicing**: Generate invoices for past months with custom payment dates.
- **Smart Sync Ledger**: Correcting a fee transaction in the Ledger automatically updates the corresponding student record.
- **Bulk Imports**: Sophisticated mapping for Students and Staff including emergency contacts and parent details.

### 🎓 Student & Academic Lifecycle
- **Unified Student Profiles**: 360-degree view of attendance, fees, and personal documentation.
- **Smart Enrollment**: Bulk onboarding with automatic family group detection.

## 🛠 Technical Stack

| Tech | Usage |
| :--- | :--- |
| **React + Vite** | High-performance frontend with HMR. |
| **Supabase** | Backend-as-a-Service (PostgreSQL, Auth, Realtime). |
| **Tailwind CSS** | Premium glassmorphic UI components. |
| **Framer Motion** | Fluid micro-animations and transitions. |
| **Lucide Icons** | Professional iconography system. |

## 📦 Getting Started

### Prerequisites
- Node.js 18+
- Supabase Account

### Installation
1. Clone the repository: `git clone https://github.com/edgexsuite/sms`
2. Install dependencies: `npm install`
3. Configure environment: Create `.env` and add:
   ```env
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   ```
4. Start development: `npm run dev`

## 📘 Migration Guide (New)
To import historical data (e.g., past 3 months of fees):
1. **Add Invoice**: Go to Student Profile -> Fees -> Add Invoice. Select the past month and check "Collect Payment Now". 
2. **Back-Date**: Use the "Payment Date" picker to set the actual date the payment was received.
3. **Correct Mistakes**: If a payment date or amount is wrong, use the **Edit** button in the **Unified Ledger** or **Student Ledger**. The system will automatically sync the changes across all financial reports.

---
Built with ❤️ by the EdgeX Dev Team.
