'use client';

import { useRef, useState } from 'react';
import FpoGroupDialog from '@/components/FpoGroupDialog';
import { Download } from 'lucide-react';
import { fpoFetch } from '@/lib/fpo-fetch';
import { loadFpoReport, renderFpoReport } from '@/lib/fpo-report';

export default function FpoPdfExport({ groupId }: { groupId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  async function exportPdf() {
    setError('');
    setBusy(true);
    try {
      const read = async (path: string) => {
        const response = await fpoFetch(path, { credentials: 'include', cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to prepare PDF report');
        return data;
      };
      const { fpos, farmers } = await loadFpoReport(read, groupId);
      setReady(false);
      setPreview(renderFpoReport(fpos, farmers, !!groupId, new Date(), false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to prepare PDF report');
    } finally { setBusy(false); }
  }

  return <div className="space-y-1">
    <button type="button" disabled={busy} onClick={exportPdf} className="inline-flex items-center gap-2 rounded-xl border border-green-700 bg-white px-4 py-2.5 text-sm font-bold text-green-800 hover:bg-green-50 disabled:opacity-50">
      <Download size={17} aria-hidden="true" />{busy ? 'Preparing report...' : groupId ? 'Export district PDF' : 'Export all FPOs PDF'}
    </button>
    <p className="text-xs text-gray-500">{groupId ? 'All farmers in this district.' : 'All districts and their assigned farmers.'} Preview the report, then choose Save as PDF / Print.</p>
    {preview !== null && <FpoGroupDialog title={groupId ? 'District FPO report' : 'All FPOs report'} onClose={() => setPreview(null)} closeLabel="Close report">
      <button type="button" disabled={!ready} onClick={() => {
        try {
          const frame = frameRef.current?.contentWindow;
          if (!frame) throw new Error('Report is not ready. Please reopen the preview.');
          frame.focus();
          frame.print();
        } catch {
          setError('Printing is unavailable in this browser. Open CoFarmz in Chrome, Edge or Safari and try again.');
        }
      }} className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Save as PDF / Print</button>
      <p className="my-3 text-sm text-gray-600">Choose Save as PDF in the print dialog to download the complete report.</p>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      <iframe ref={frameRef} title="FPO report preview" srcDoc={preview} onLoad={() => setReady(true)} className="h-[60dvh] w-full rounded-lg border border-gray-200" />
    </FpoGroupDialog>}
    {busy && <p role="status" className="text-xs text-green-800">Loading the complete farmer list...</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
