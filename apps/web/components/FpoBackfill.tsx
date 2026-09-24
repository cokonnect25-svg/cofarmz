'use client';
import {useEffect,useRef,useState} from 'react';
import {getApiUrl} from '@/lib/api';

type Summary={processed:number;assigned:number;pending_fpo:number;pending_location:number;inactive_fpo:number;errors:number};
const empty=():Summary=>({processed:0,assigned:0,pending_fpo:0,pending_location:0,inactive_fpo:0,errors:0});
export default function FpoBackfill({onComplete}:{onComplete:()=>Promise<void>}) {
 const [busy,setBusy]=useState(false),[summary,setSummary]=useState<Summary>(empty),[mode,setMode]=useState(''),[error,setError]=useState('');
 const [rows,setRows]=useState<any[]>([]);
 const [stopping,setStopping]=useState(false);
 const stop=useRef(false),running=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
 async function run(dryRun:boolean){
  if(running.current)return;
  running.current=true;stop.current=false;setBusy(true);setStopping(false);setError('');setRows([]);setSummary(empty());setMode(dryRun?'Preview':'Assignment');
  let cursor:string|null='';const totals=empty();
  try{
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
  <p className="text-xs text-gray-500">Processes 10 farmers per batch. Keep this page open. Safe to run again; each farmer retains a single group assignment.</p>
  {error&&<p role="alert" className="text-sm text-red-700">{error} Run again to retry; completed assignments are retained.</p>}
  {mode&&<div role="status" className="rounded-xl bg-green-50 p-4 text-sm"><p className="font-bold">{mode}{busy?' in progress...':''} · {summary.processed} checked</p><div className="mt-2 grid grid-cols-2 gap-2"><p>{summary.assigned} {mode.startsWith('Preview')?'ready for a group':'assigned'}</p><p>{summary.pending_fpo} need district FPO creation</p><p>{summary.pending_location} need profile State/District</p><p>{summary.inactive_fpo} have inactive FPOs</p><p>{summary.errors} errors</p></div></div>}
  {!!rows.length&&<div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="pb-2 text-left font-semibold text-gray-500">Latest batch</caption><thead><tr><th className="p-2">Farmer</th><th className="p-2">District</th><th className="p-2">Result</th></tr></thead><tbody>{rows.map(row=><tr key={row.farmer_id} className="border-t"><td className="p-2 break-all">{row.farmer_id}</td><td className="p-2">{row.district?.district||'Not resolved'}</td><td className="p-2">{row.error||row.reason||row.assignment_status?.replaceAll('_',' ')}</td></tr>)}</tbody></table></div>}
 </section>;
}
