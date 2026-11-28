import React, { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** Scrollable table wrapper — handles overflow-x on mobile */
export function TableContainer({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-x-auto w-full", className)} {...props}>
      {children}
    </div>
  );
}

/** <table> with standard enterprise styling */
export function Table({ children, className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("ent-table", className)} {...props}>
      {children}
    </table>
  );
}

/** <thead> — applies sticky top-0 for long tables */
export function Thead({ children, className, sticky, ...props }: HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return (
    <thead className={cn(sticky && "sticky top-0 z-10", className)} {...props}>
      {children}
    </thead>
  );
}

/** <th> — standard header cell */
export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border-b border-slate-100 whitespace-nowrap", className)} {...props}>
      {children}
    </th>
  );
}

/** <tbody> */
export function Tbody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-slate-50", className)} {...props}>
      {children}
    </tbody>
  );
}

/** <tr> — hover highlight */
export function Tr({ children, className, onClick, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-indigo-50/40",
        !onClick && "hover:bg-slate-50/60",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
}

/** <td> — standard data cell */
export function Td({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2.5 text-sm text-slate-700 align-middle", className)} {...props}>
      {children}
    </td>
  );
}
