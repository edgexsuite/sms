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
  discount?: number;
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

  const updateItem = (index: number, field: 'item' | 'amount' | 'discount', value: string | number) => {
    const updated = breakdown.map((row, i) =>
      i === index ? { ...row, [field]: (field === 'amount' || field === 'discount') ? Number(value) || 0 : value } : row
    );
    onChange(updated);
  };

  const addRow = () => {
    onChange([...breakdown, { item: '', amount: 0 }]);
  };

  const removeRow = (index: number) => {
    onChange(breakdown.filter((_, i) => i !== index));
  };

  const totalGross = breakdown.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalDisc = breakdown.reduce((s, r) => s + (Number(r.discount) || 0), 0);
  const totalNet = Math.max(0, totalGross - totalDisc);

  if (readOnly) {
    return (
      <div className="space-y-1">
        {breakdown.map((row, i) => {
          const net = Math.max(0, (Number(row.amount) || 0) - (Number(row.discount) || 0));
          return (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600">{row.item} {row.discount ? <span className="text-[10px] text-emerald-600 ml-1">(Disc: {row.discount})</span> : null}</span>
              <span className="font-medium text-gray-800">Rs. {net.toLocaleString()}</span>
            </div>
          );
        })}
        {showTotal && (
          <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1">
            <span>Total Net</span>
            <span className="text-indigo-700">Rs. {totalNet.toLocaleString()}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_70px_75px_32px] gap-2 px-1 items-end">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Fee Item</span>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-right leading-tight">Gross<br/>(Rs)</span>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-right leading-tight">Disc.<br/>(Rs)</span>
        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider text-right leading-tight">Net<br/>(Rs)</span>
        <span />
      </div>

      {/* Rows */}
      {breakdown.map((row, i) => {
        const net = Math.max(0, (Number(row.amount) || 0) - (Number(row.discount) || 0));
        return (
        <div key={i} className="grid grid-cols-[1fr_80px_70px_75px_32px] gap-2 items-center group">
          <ItemCombobox
            value={row.item}
            onChange={v => updateItem(i, 'item', v)}
            suggestions={suggestions}
          />
          <input
            type="text"
            inputMode="numeric"
            value={row.amount || ''}
            onFocus={e => e.target.select()}
            onChange={e => updateItem(i, 'amount', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-right font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
          />
          <input
            type="text"
            inputMode="numeric"
            value={row.discount || ''}
            onFocus={e => e.target.select()}
            onChange={e => updateItem(i, 'discount', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            className="border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg px-2 py-2 text-sm text-right font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-full placeholder-emerald-300"
          />
          <div className="text-right text-sm font-black text-indigo-700 truncate pr-1">
            {net.toLocaleString()}
          </div>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Remove row"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        );
      })}

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
        <div className="grid grid-cols-[1fr_80px_70px_75px_32px] gap-2 items-center border-t border-gray-200 pt-2 mt-2 px-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</span>
          <span className="text-xs font-bold text-gray-500 text-right">{totalGross.toLocaleString()}</span>
          <span className="text-xs font-bold text-emerald-600 text-right">{totalDisc > 0 ? '-' + totalDisc.toLocaleString() : '0'}</span>
          <span className="text-sm font-black text-indigo-700 text-right">Rs. {totalNet.toLocaleString()}</span>
          <span />
        </div>
      )}
    </div>
  );
}
