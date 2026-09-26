'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { loadFpoReport, renderFpoReport } from '@/lib/fpo-report';

export default function FpoPdfExport({ groupId }: { groupId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function exportPdf() {
    setError('');
    // Open during the click so browsers do not block the report after fetching.
    const report = window.open('', '_blank');
    if (!report) { setError('Allow pop-ups for this site, then try exporting again.'); return; }
    report.opener = null;
    report.document.write('<!doctype html><html><head><title>Preparing FPO report</title></head><body><p role="status">Loading all assigned farmers. Please wait...</p></body></html>');
    report.document.close();
    setBusy(true);
    try {
      const read = async (path: string) => {
        if (report.closed) throw new Error('Report window was closed. Export again to retry.');
        const response = await fetch(getApiUrl(path), { credentials: 'include', cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to prepare PDF report');
        return data;
      };
      const { fpos, farmers } = await loadFpoReport(read, groupId);
      if (report.closed) throw new Error('Report window was closed. Export again to retry.');
      report.document.open();
      report.document.write(renderFpoReport(fpos, farmers, !!groupId));
      report.document.close();
    } catch (e) {
      report.close();
      setError(e instanceof Error ? e.message : 'Unable to prepare PDF report');
    } finally { setBusy(false); }
  }

  return <div className="space-y-1">
    <button type="button" disabled={busy} onClick={exportPdf} className="inline-flex items-center gap-2 rounded-xl border border-green-700 bg-white px-4 py-2.5 text-sm font-bold text-green-800 hover:bg-green-50 disabled:opacity-50">
      <Download size={17} aria-hidden="true" />{busy ? 'Preparing report...' : groupId ? 'Export district PDF' : 'Export all FPOs PDF'}
    </button>
    <p className="text-xs text-gray-500">{groupId ? 'All farmers in this district.' : 'All districts and their assigned farmers.'} Choose Save as PDF in the report.</p>
    {busy && <p role="status" className="text-xs text-green-800">Loading the complete farmer list...</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
