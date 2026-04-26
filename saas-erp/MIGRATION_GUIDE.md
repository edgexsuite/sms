# 📋 Historical Data Migration Guide

This guide outlines the workflow for migrating the past 3 months of school data (Fees, Staff, and Students) into the EdgeX Suite.

## 1. Student Bulk Import
- **Tool**: Students -> Bulk Enrollment.
- **Mapping**: Ensure the Excel `Mobile Number` is mapped correctly.
- **Family Groups**: The system will automatically group students sharing the same `Family ID` or `Parent Contact`.

## 2. Migrating Past Fees (Back-Dating)
For each month of historical data (e.g., February, March, April):
1. **Selection**: Go to the **Student Profile** -> **Fees** Tab.
2. **Add Invoice**: Click "+ Add Invoice".
3. **Month Selection**: Choose the past month (e.g., 2026-02).
4. **Immediate Collection**: Check **"Collect Payment Now"**.
5. **CRITICAL STEP**: Use the **"Payment Date"** picker to select the exact date the student paid in the past.
   - *Example*: Student paid on Feb 12th? Select Feb 12th.
6. **Save**: The system will record the revenue for February and update the Day Book for that specific date.

## 3. Auditing & Fixing Mistakes
If you accidentally record a payment with the wrong date or amount:
- **Option A (Individual)**: Open the **Student Ledger**, find the month, and click **"Edit"**.
- **Option B (Batch/Finance)**: Go to **Expenses -> Unified Ledger**. Find the transaction row and click **"Edit"**.
- **Sync Logic**: When you edit a "Fee Collection" in the Unified Ledger, the system automatically reaches back to the student's profile to fix their invoice status if the invoice number matches.

## 4. Staff Onboarding
- **Template**: Use the **Staff Import Modal** to map mobile numbers and salary details.
- **Verification**: Check the **Unified Ledger** to ensure that any "Historical Salary Payouts" recorded during migration appear in the correct months.

---
**Need Help?** Mention @Antigravity in the console for specific data mapping questions.
