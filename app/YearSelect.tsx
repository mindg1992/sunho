'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  years: number[];
  value: number;
  onChange: (y: number) => void;
};

export default function YearSelect({ years, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="year-dropdown" ref={ref}>
      <button
        type="button"
        className="year-dropdown-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value}</span>
        <span className="year-dropdown-caret">▾</span>
      </button>
      {open && (
        <ul className="year-dropdown-list" role="listbox">
          {years.map((y) => (
            <li key={y}>
              <button
                type="button"
                role="option"
                aria-selected={y === value}
                className={`year-dropdown-item${y === value ? ' selected' : ''}`}
                onClick={() => { onChange(y); setOpen(false); }}
              >{y}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
