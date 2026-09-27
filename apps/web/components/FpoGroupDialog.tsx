'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function FpoGroupDialog({ title, onClose, children, closeLabel = 'Close FPO members' }: {
  title: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const trigger = document.activeElement;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return <dialog ref={dialogRef} aria-labelledby="fpo-dialog-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl bg-white p-0 text-gray-800 shadow-2xl backdrop:bg-black/50">
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <h2 id="fpo-dialog-title" className="min-w-0 break-words text-xl font-bold">{title}</h2>
        <button type="button" autoFocus onClick={onClose} aria-label={closeLabel}
          className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 focus-visible:outline-brand-700"><X size={18}/>Close</button>
      </header>
      <div className="overflow-y-auto overscroll-contain p-5">{children}</div>
    </div>
  </dialog>;
}
