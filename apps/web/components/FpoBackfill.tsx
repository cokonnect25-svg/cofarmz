'use client';
import {useEffect,useRef,useState} from 'react';
import {getApiUrl} from '@/lib/api';

type Summary={processed:number;assigned:number;pending_fpo:number;pending_location:number;inactive_fpo:number;errors:number};
const empty=():Summary=>({processed:0,assigned:0,pending_fpo:0,pending_location:0,inactive_fpo:0,errors:0});
export default function FpoBackfill({onComplete}:{onComplete:()=>Promise<void>}) {
 const [busy,setBusy]=useState(false),[summary,setSummary]=useState<Summary>(empty),[mode,setMode]=useState(''),[error,setError]=useState('');
 const [rows,setRows]=useState<any[]>([]);
 const [stopping,setStopping]=useState(false);
 const [provisioned,setProvisioned]=useState('');
 const stop=useRef(false),running=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
 async function run(dryRun:boolean,provision=false){
  if(running.current)return;
  running.current=true;stop.current=false;setBusy(true);setStopping(false);setError('');setRows([]);setSummary(empty());setMode(dryRun?'Preview':'Assignment');
  setProvisioned('');
  let cursor:string|null='';const totals=empty();
  try{
   if(provision){
    setMode('Creating district FPOs');
    const response=await fetch(getApiUrl('/api/admin/fpo'),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'provision'})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to create district FPOs');
    if(mounted.current){setProvisioned(`${data.districts} districts covered: ${data.created} FPOs created, ${data.existing} existing FPOs preserved.`);setMode('Assignment');}
   }
   if(stop.current)return;
   do{
    const response:Response=await fetch(getApiUrl('/api/admin/fpo'),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'process',after:cursor,dry_run:dryRun})});
    const data:{results:any[];next:string|null;error?:string}=await response.json();if(!response.ok)throw new Error(data.error||'Unable to process farmers');
    for(const row of data.results){totals.processed++;if(row.error)totals.errors++;else if(row.assignment_status in totals)totals[row.assignment_status as keyof Summary]++;}
    if(mounted.current){setSummary({...totals});setRows(data.results);}
    cursor=data.next;
   }while(cursor&&!stop.current);
   if(mounted.current){setMode(`${dryRun?'Preview':'Assignment'} ${stop.current?'stopped':'complete'}`);await onComplete();}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Processing failed');}
  finally{running.current=false;if(mounted.current){setBusy(false);setStopping(false);}}
 }
 return <section className="space-y-4 border-t pt-5"><div><h3 className="font-bold">Group existing farmers by profile location</h3><p className="mt-1 text-sm text-gray-500">Uses saved State/District or a clear match in the saved profile address. Current GPS and Nearby results are ignored. Unclear addresses stay pending for profile correction.</p></div>
  <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>run(true)} className="rounded-xl border border-green-200 px-4 py-2 text-sm font-bold text-green-800 disabled:opacity-50">Preview all farmers</button><button disabled={busy} onClick={()=>run(false)} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Assign from saved profiles</button>{busy&&<button disabled={stopping} className="text-sm font-bold text-gray-500 disabled:opacity-50" onClick={()=>{stop.current=true;setStopping(true);}}>Stop after this batch</button>}</div>
  <button disabled={busy} onClick={()=>run(false,true)} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Create all district FPOs and assign farmers</button>
  <p className="text-xs text-gray-500">Create all covers every catalogue district, including districts without farmers, then assigns from saved profiles. Existing FPOs and inactive status are preserved. Preview only checks current assignment destinations. Processes 10 farmers per batch. Keep this page open. Stop retains completed work. Safe to run again after interruption or catalogue updates.</p>
  {provisioned&&<p role="status" className="text-sm text-green-800">{provisioned}</p>}
  {error&&<p role="alert" className="text-sm text-red-700">{error} Run again to retry; completed assignments are retained.</p>}
  {mode&&<div role="status" className="rounded-xl bg-green-50 p-4 text-sm"><p className="font-bold">{mode}{busy?' in progress...':''} · {summary.processed} checked</p><div className="mt-2 grid grid-cols-2 gap-2"><p>{summary.assigned} {mode.startsWith('Preview')?'ready for a group':'assigned'}</p><p>{summary.pending_fpo} need district FPO creation</p><p>{summary.pending_location} need profile State/District</p><p>{summary.inactive_fpo} have inactive FPOs</p><p>{summary.errors} errors</p></div></div>}
  {!!rows.length&&<div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="pb-2 text-left font-semibold text-gray-500">Latest batch</caption><thead><tr><th className="p-2">Farmer</th><th className="p-2">District</th><th className="p-2">Result</th></tr></thead><tbody>{rows.map(row=><tr key={row.farmer_id} className="border-t"><td className="p-2 break-all">{row.farmer_id}</td><td className="p-2">{row.district?.district||'Not resolved'}</td><td className="p-2">{row.error||row.reason||row.assignment_status?.replaceAll('_',' ')}</td></tr>)}</tbody></table></div>}
 </section>;
}
