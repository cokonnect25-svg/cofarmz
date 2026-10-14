'use client';

import { useEffect, useRef, useState } from 'react';
import FpoGroupDialog from '@/components/FpoGroupDialog';
import { Download } from 'lucide-react';
import { fpoFetch } from '@/lib/fpo-fetch';
import { loadFilteredFpoReport, renderFpoReport, renderFarmerCsv, ReportFpo } from '@/lib/fpo-report';

export default function FpoPdfExport({ groupId }: { groupId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [options, setOptions] = useState<ReportFpo[]>([]);
  const [district, setDistrict] = useState('');
  const [taluk, setTaluk] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fpoFetch('/api/fpo/report?options=true', { cache: 'no-store' }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Unable to load export filters');
      if (!cancelled) { setOptions(data.fpos); setLoaded(true); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);
  const selected = options.find(f => f.group_id === groupId);
  const available = options.filter(f => !groupId || (selected && (selected.taluk_id ? f.group_id === groupId : String(f.district_id) === String(selected.district_id))));
  const districts = Array.from(new Map(available.map(f => [String(f.district_id), f])).values());
  const taluks = available.filter(f => f.taluk_id && (!district || String(f.district_id) === district));

  async function exportPdf(csv = false) {
    setError('');
    setBusy(true);
    try {
      const read = async (path: string) => {
        const response = await fpoFetch(path, { credentials: 'include', cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to prepare PDF report');
        return data;
      };
      const { fpos, farmers } = await loadFilteredFpoReport(read, { district, taluk, ...(groupId ? { group: groupId } : {}) });
      if (csv) {
        const url = URL.createObjectURL(new Blob([renderFarmerCsv(farmers)], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'cofarmz-fpo-farmers.csv';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      setReady(false);
      setPreview(renderFpoReport(fpos, farmers, !!(groupId || district || taluk), new Date(), false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to prepare PDF report');
    } finally { setBusy(false); }
  }

  return <div className="space-y-1">
    <div className="flex flex-wrap gap-3 py-2">
      <label className="text-sm">District<select aria-label="Export district" disabled={busy || !loaded} value={district} onChange={e => { setDistrict(e.target.value); setTaluk(''); }} className="block rounded border p-2"><option value="">All accessible districts</option>{districts.map(f => <option key={String(f.district_id)} value={String(f.district_id)}>{f.district}, {f.state}</option>)}</select></label>
      <label className="text-sm">Mandal / Taluk<select aria-label="Export mandal or taluk" disabled={busy || !loaded} value={taluk} onChange={e => setTaluk(e.target.value)} className="block rounded border p-2"><option value="">All accessible mandals / taluks</option>{taluks.map(f => <option key={String(f.taluk_id)} value={String(f.taluk_id)}>{f.taluk} — {f.district}</option>)}</select></label>
    </div>
    <button type="button" disabled={busy || !loaded} onClick={() => exportPdf()} className="inline-flex items-center gap-2 rounded-xl border border-green-700 bg-white px-4 py-2.5 text-sm font-bold text-green-800 hover:bg-green-50 disabled:opacity-50">
      <Download size={17} aria-hidden="true" />{busy ? 'Preparing report...' : 'Export filtered FPO PDF'}
    </button>
    <button type="button" disabled={busy || !loaded} onClick={() => exportPdf(true)} className="ml-2 rounded-xl border border-green-700 px-4 py-2.5 text-sm font-bold text-green-800 disabled:opacity-50">Download farmer list CSV</button>
    <p className="text-xs text-gray-500">Exports include assigned farmers in the selected district and mandal/taluk. Preview the PDF, then choose Save as PDF / Print.</p>
    {preview !== null && <FpoGroupDialog title={groupId ? 'FPO report' : 'All FPOs report'} onClose={() => setPreview(null)} closeLabel="Close report">
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
