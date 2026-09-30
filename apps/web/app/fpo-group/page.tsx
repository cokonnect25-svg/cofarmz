"use client";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import FarmerFpo from '@/components/FarmerFpo';
export default function FpoGroupPage(){
 const {user,loading}=useAuth();
 return <main className="mx-auto h-[calc(100dvh-124px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[calc(100dvh-64px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-3xl overflow-hidden">{loading?<p role="status" className="p-6">Loading chat...</p>:user?<FarmerFpo key={user.id} mode="thread"/>:<Link href="/login" className="block p-6">Sign in to open your group</Link>}</main>;
}
