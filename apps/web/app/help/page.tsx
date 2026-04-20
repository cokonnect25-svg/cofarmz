'use client';
import Link from 'next/link';

const topics = [
  { icon: '🚜', title: 'Renting Equipment', desc: 'How to browse, book, and manage equipment rentals.', href: '/faq' },
  { icon: '📋', title: 'Listing Your Equipment', desc: 'How to add your machinery and start earning.', href: '/faq' },
  { icon: '👤', title: 'Account & Profile', desc: 'Managing your account, location, and settings.', href: '/faq' },
  { icon: '💬', title: 'Messaging & Chat', desc: 'Communicating with farmers and buyers.', href: '/faq' },
  { icon: '📅', title: 'Bookings & Reservations', desc: 'Tracking and managing your bookings.', href: '/faq' },
  { icon: '🔒', title: 'Privacy & Security', desc: 'How we protect your data.', href: '/privacy' },
];

export default function HelpPage() {
  return (
    <div className="min-min-h-[100dvh] bg-gray-50">
      <div className="bg-gradient-to-br from-green-700 to-green-600 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-black text-white mb-3">Help Center</h1>
          <p className="text-green-100 text-base">How can we help you today?</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {topics.map(t => (
            <Link key={t.title} href={t.href}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-green-400 hover:shadow-md transition-all group">
              <span className="text-3xl mb-3 block">{t.icon}</span>
              <h3 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-green-700 transition-colors">{t.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{t.desc}</p>
            </Link>
          ))}
        </div>

        <div className="bg-gray-900 rounded-3xl p-10 text-center">
          <h2 className="text-xl font-black text-white mb-2">Still need help?</h2>
          <p className="text-gray-400 text-sm mb-6">Our support team is available Mon–Sat, 9 AM – 6 PM IST</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="https://wa.me/919177738383" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition">
              💬 WhatsApp Us
            </a>
            <a href="tel:+919177738383"
              className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition">
              📞 +91 91777 38383
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
