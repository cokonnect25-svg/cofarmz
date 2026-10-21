'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
export default function WhatsAppReturn({userId}:{userId?:string|null}) {
 const router=useRouter();
 const pathname=usePathname();
 useEffect(()=>{if(!userId || /^\/(login|signup|auth|phone|verify|otp)/.test(pathname))return;
  const target=sessionStorage.getItem('cofarmz_whatsapp_return');
  if(!target)return;sessionStorage.removeItem('cofarmz_whatsapp_return');
  if(['/user-profile','/user-profile?addCrop=true','/nearby-farmers','/notifications'].includes(target))router.replace(target);
 },[userId,pathname,router]);
 return null;
}
