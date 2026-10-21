'use client';
import { Suspense,useEffect } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
const destinations: Record<string,string>={profile_completion:'/user-profile',crop_addition:'/user-profile?addCrop=true',nearby_matches:'/nearby-farmers'};
function Destination(){
 const params=useSearchParams();const router=useRouter();const {loading,isAuthenticated}=useAuth();
 const target=destinations[params.get('type') || ''] || '/notifications';
 useEffect(()=>{if(loading)return;
  if(isAuthenticated){router.replace(target);return;}
  sessionStorage.setItem('cofarmz_whatsapp_return',target);router.replace('/login');
 },[loading,isAuthenticated,target,router]);
 return <main className="p-8 text-center">Opening CoFarmz?</main>;
}
export default function WhatsAppDestination(){return <Suspense fallback={<p>Opening CoFarmz?</p>}><Destination/></Suspense>;}
