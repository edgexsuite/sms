/**
 * FeeBreakdownEditor — reusable component for editing fee invoice line items.
 *
 * Used in:
 *  - StudentFeeDetail  (edit invoice modal + new invoice modal)
 *  - MonthlyFeeInvoices (edit invoice modal)
 *  - EasyFee           (manual invoice creation)
 *
 * All item-name dropdowns are backed by the school's configured fee item names
 * from `form_settings` via the `useFeeItems` hook.
 */

import React, { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFeeItems } from '../lib/feeItems';

export interface BreakdownRow {
  item: string;
  amount: number;
}

interface Props {
  breakdown: BreakdownRow[];
  onChange: (rows: BreakdownRow[]) => void;
  schoolId: string | undefined;
  /** When true, rows are not editable — used for print preview */
  readOnly?: boolean;
  /** Show a "Total" footer row. Default true. */
  showTotal?: boolean;
  /** Limit suggestions to recurring or one-time items, or show all (default) */
  itemType?: 'recurring' | 'onetime' | 'all';
}

/** A single combobox backed by a <datalist> */
function ItemCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Select or type fee name',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        list={id}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
      <datalist id={id}>
        {suggestions.map(s => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}

export default function FeeBreakdownEditor({
  breakdown,
  onChange,
  schoolId,
  readOnly = false,
  showTotal = true,
  itemType = 'all',
}: Props) {
  const { all, recurring, onetime } = useFeeItems(schoolId);
  const suggestions = itemType === 'recurring' ? recurring : itemType === 'onetime' ? onetime : all;

  const updateItem = (index: number, field: 'item' | 'amount', value: string | number) => {
    const updated = breakdown.map((row, i) =>
      i === index ? { ...row, [field]: field === 'amount' ? Number(value) || 0 : value } : row
    );
    onChange(updated);
  };

  const addRow = () => {
    onChange([...breakdown, { item: '', amount: 0 }]);
  };

  const removeRow = (index: number) => {
    onChange(breakdown.filter((_, i) => i !== index));
  };

  const total = breakdown.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  if (readOnly) {
    return (
      <div className="space-y-1">
        {breakdown.map((row, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-600">{row.item}</span>
            <span className="font-medium text-gray-800">Rs. {Number(row.amount).toLocaleString()}</span>
          </div>
        ))}
        {showTotal && (
          <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1">
            <span>Total</span>
            <span className="text-indigo-700">Rs. {total.toLocaleString()}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_110px_32px] gap-2 px-1">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fee Item</span>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Amount (Rs)</span>
        <span />
      </div>

      {/* Rows */}
      {breakdown.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_110px_32px] gap-2 items-center">
          <ItemCombobox
            value={row.item}
            onChange={v => updateItem(i, 'item', v)}
            suggestions={suggestions}
          />
          <input
            type="number"
            min="0"
            step="1"
            value={row.amount || ''}
            onChange={e => updateItem(i, 'amount', e.target.value)}
            placeholder="0"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-right font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Remove row"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Add Row */}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors w-full"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Fee Item
      </button>

      {/* Total Footer */}
      {showTotal && breakdown.length > 0 && (
        <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-1 px-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</span>
          <span className="text-base font-black text-indigo-700">Rs. {total.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
