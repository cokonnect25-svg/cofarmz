'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const SECTIONS = [
  {
    title: 'Who We Are',
    color: 'bg-green-500',
    icon: 'ph-users-three',
    lightColor: 'bg-green-50',
    textColor: 'text-green-700',
    border: 'border-green-100',
    content: "CoFarmz was created with a simple purpose — to support farmers in a better, more connected way.\n\nFarming is not just work. It is effort, patience, and hope.\n\nBut even after all that hard work, farmers often face uncertainty — in pricing, buyers, and resources. We wanted to change that."
  },
  {
    title: 'Our Story',
    color: 'bg-amber-500',
    icon: 'ph-book-open',
    lightColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    border: 'border-amber-100',
    content: "We didn’t build CoFarmz by reading about problems. We built it by seeing them closely.\n\nWe have seen farmers:\n• Struggling to find the right buyers\n• Selling crops for less than they deserve\n• Waiting without clarity or support\n• Managing everything alone\n\nThat reality stayed with us. And it led to one question: Why should a farmer struggle alone?"
  },
  {
    title: 'Why CoFarmz Exists',
    color: 'bg-blue-500',
    icon: 'ph-heart',
    lightColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    border: 'border-blue-100',
    content: "CoFarmz is built on one belief: Farmers deserve support, connection, and fair opportunities.\n\nThis platform brings everything together:\n• Buyers who are ready to connect\n• Farmers who are willing to share and learn\n• Tools that make farming easier\nAll in one place."
  },
  {
    title: 'What We Do',
    color: 'bg-purple-500',
    icon: 'ph-handshake',
    lightColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    border: 'border-purple-100',
    content: "CoFarmz is a platform where:\n• Farmers can connect directly with buyers\n• Equipment can be shared or rented\n• Knowledge can be exchanged between farmers\n• Experience can be turned into opportunity\n\nIt is not just about technology. It is about building a strong farming ecosystem."
  },
  {
    title: 'Our Mission',
    color: 'bg-orange-500',
    icon: 'ph-target',
    lightColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    border: 'border-orange-100',
    content: "Make farming more connected\nHelp farmers earn better\nReduce dependency and uncertainty\nCreate more opportunities for growth"
  },
  {
    title: 'Our Vision',
    color: 'bg-red-500',
    icon: 'ph-eye',
    lightColor: 'bg-red-50',
    textColor: 'text-red-700',
    border: 'border-red-100',
    content: "We aim to build a future where:\n• Farmers are empowered\n• Support is always accessible\n• Communities grow together\n• No farmer feels alone"
  },
];

const BELIEFS = [
  "A farmer’s work deserves respect",
  "A farmer’s time is valuable",
  "Every farmer should have multiple income opportunities",
  "Strong communities create stronger outcomes"
];

export default function AboutPage() {
  const router = useRouter();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setShowContent(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F5F0] overflow-x-hidden">
      {/* ── AMBIENT BACKGROUND GLOWS ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-50px] left-[-50px] w-80 h-80 bg-brand-500/10 rounded-full blur-3xl wave-animation"></div>
      </div>

      {/* ── HERO SECTION ── */}
      <header className="relative pt-12 pb-24 px-6 overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 text-white rounded-b-[3rem] shadow-2xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-xl"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 animate-fade-in-down">
            <span className="text-2xl">🌾</span>
            <span className="text-sm font-bold tracking-wider uppercase">About CoFarmz</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight animate-fade-in">
            Growing Together, <br />
            <span className="text-brand-200 italic underline decoration-accent/30 underline-offset-8">Selling Smarter.</span>
          </h1>
          
          <p className="text-brand-100 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in-up">
            Founded with a simple purpose: to empower farmers through connection, technology, and fair opportunity.
          </p>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className={`max-w-7xl mx-auto px-6 -mt-12 transition-all duration-1000 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        
        {/* Value Section Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {SECTIONS.map((section, idx) => (
            <div 
              key={section.title}
              className={`group bg-white rounded-3xl p-8 shadow-soft border border-gray-100 hover:shadow-float hover:border-${section.color.split('-')[1]}-200 transition-all duration-300 relative overflow-hidden`}
              style={{ transitionDelay: `${idx * 100}ms` }}
            >
              {/* Decorative Corner Glow */}
              <div className={`absolute -top-12 -right-12 w-24 h-24 ${section.color} opacity-0 group-hover:opacity-10 rounded-full blur-xl transition-opacity duration-500`}></div>
              
              <div className={`w-14 h-14 ${section.lightColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <i className={`ph-fill ${section.icon} ${section.textColor} text-3xl`}></i>
              </div>
              
              <h3 className={`text-xl font-black ${section.textColor} mb-4 flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full ${section.color}`}></span>
                {section.title}
              </h3>
              
              <div className="text-gray-600 leading-relaxed text-sm space-y-3 whitespace-pre-line font-medium">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        {/* ── BELIEFS SECTION ── */}
        <section className="bg-white rounded-[2.5rem] p-10 md:p-16 shadow-soft border border-gray-100 mb-16 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-brand-100/50 transition-colors"></div>
          
          <div className="relative flex flex-col md:flex-row gap-12 items-center">
            <div className="md:w-1/2 space-y-6">
              <span className="text-4xl">🟢</span>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
                What We <br />
                <span className="text-brand-600 underline decoration-brand-200 underline-offset-4 font-black italic">Believe</span> In
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                Our core values guide every decision we make and every feature we build for the community.
              </p>
            </div>
            
            <div className="md:w-1/2 grid grid-cols-1 gap-4 w-full">
              {BELIEFS.map((belief, i) => (
                <div key={i} className="flex items-center gap-4 p-5 bg-surface-muted rounded-2xl border border-gray-100 hover:bg-brand-50 hover:border-brand-100 transition-all group/belief">
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-brand-200 group-hover/belief:scale-110 transition-transform">
                    {i + 1}
                  </div>
                  <span className="font-bold text-gray-800 text-sm">{belief}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MESSAGE TO FARMERS ── */}
        <section className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-[2.5rem] p-10 md:p-16 text-white mb-16 relative overflow-hidden shadow-2xl">
          <div className="absolute right-0 bottom-0 w-80 h-80 bg-white/5 rounded-full translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          
          <div className="relative max-w-3xl mx-auto text-center space-y-8">
            <div className="flex justify-center">
              <span className="text-6xl animate-bounce">🟣</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black leading-tight italic">
              "A Message <br className="md:hidden" /> to Farmers"
            </h2>
            
            <div className="space-y-6 text-brand-100 text-lg leading-relaxed font-medium">
              <p>If you are a farmer reading this… CoFarmz is built for you.</p>
              <p className="text-brand-200 italic font-bold">"Not with big promises, but with a clear intention:"</p>
              
              <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-black tracking-wide uppercase mt-8">
                <li className="flex flex-col items-center gap-2">
                  <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">🌱</span>
                  EASIER JOURNEY
                </li>
                <li className="flex flex-col items-center gap-2">
                  <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">💰</span>
                  EARN BETTER
                </li>
                <li className="flex flex-col items-center gap-2">
                  <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">🤝</span>
                  STAND WITH YOU
                </li>
                <li className="flex flex-col items-center gap-2">
                  <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">🚀</span>
                  GROW TOGETHER
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── FINAL CTAs ── */}
        <section className="pb-24 text-center space-y-12 animate-fade-in-up">
          <div className="space-y-4">
            <span className="text-5xl">🔵</span>
            <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight">Join Our Community</h2>
            <p className="text-gray-500 font-bold max-w-lg mx-auto">Be part of a growing farming ecosystem. Let's make farming better, together.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button 
              onClick={() => router.push('/nearby-farmers?type=farmers')}
              className="w-full sm:w-auto px-10 py-5 bg-brand-600 text-white rounded-2xl font-black hover:bg-brand-700 hover:scale-105 transition-all shadow-xl shadow-brand-200 text-lg flex items-center justify-center gap-3"
            >
              <i className="ph-bold ph-plant"></i>
              Join as Farmer
            </button>
            <button 
              onClick={() => router.push('/nearby-farmers?type=buyers')}
              className="w-full sm:w-auto px-10 py-5 bg-white text-gray-900 border-2 border-gray-100 rounded-2xl font-black hover:bg-gray-50 hover:scale-105 transition-all shadow-xl text-lg flex items-center justify-center gap-3"
            >
              <i className="ph-bold ph-handshake"></i>
              Connect as Buyer
            </button>
          </div>

          <div className="pt-12">
            <div className="inline-block p-4 bg-brand-50 rounded-2xl border border-brand-100 transform rotate-[-2deg] shadow-soft">
              <p className="text-brand-800 text-2xl font-black italic">
                🔴 "You grow for World. Now let’s grow together."
              </p>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.2; }
        }
        .animate-fade-in-down { animation: fade-in-down 1s ease-out forwards; }
        .animate-fade-in-up { animation: fade-in-up 1s ease-out forwards; }
        .animate-fade-in { animation: fade-in 1.5s ease-out forwards; }
        .wave-animation {
          animation: wave 10s infinite ease-in-out;
        }
        @keyframes wave {
          0%, 100% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.2) translate(20px, -20px); }
        }
      `}</style>
    </div>
  );
}
