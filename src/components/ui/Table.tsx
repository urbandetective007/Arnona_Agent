import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

// Thin, composable table primitives — not a data-grid abstraction. Each
// page (כלל הנתונים, קבצים שהועלו, מעקב תוצאות סקר) still owns its own
// rows/columns; this just gives every table on the site the same dense,
// hairline-bordered look instead of each page re-styling <table> from
// scratch.

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-hairline bg-surface ${className}`}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="bg-canvas border-b border-hairline">{children}</thead>
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-hairline">{children}</tbody>
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-canvas/60 transition-colors ${className}`}>{children}</tr>
}

export function Th({ children, className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { className?: string }) {
  return (
    <th
      className={`px-3.5 py-2.5 text-start text-[12px] font-semibold text-graphite whitespace-nowrap ${className}`}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { className?: string }) {
  return (
    <td className={`px-3.5 py-2.5 text-ink ${className}`} {...rest}>
      {children}
    </td>
  )
}
