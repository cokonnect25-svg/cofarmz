"use client";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import FarmerFpo from '@/components/FarmerFpo';
export default function FpoGroupPage(){
  const {user,loading}=useAuth();
  return <main className="mx-auto max-w-3xl pb-24"><header className="space-y-3 p-6"><Link href="/chat" className="font-bold text-brand-700">Back to Messages</Link><h1 className="text-2xl font-bold">My FPO farmer group</h1><p className="text-sm text-gray-500">Chat with the farmers assigned to your Digital FPO.</p></header>{loading?<p role="status" className="px-6">Loading your account...</p>:user?<FarmerFpo key={user.id} mode="group"/>:<Link href="/login" className="block px-6 text-brand-700">Sign in to open your group</Link>}</main>;
}
