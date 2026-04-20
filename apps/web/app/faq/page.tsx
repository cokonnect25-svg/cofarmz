'use client';

import { useState } from 'react';
import Link from 'next/link';

const faqs = {
  general: [
    {
      q: 'What is CoFarmz?',
      a: 'CoFarmz is a technology-driven platform that connects farmers with machinery rental services, crop management tools, and a network of agricultural buyers and sellers across India.',
    },
    {
      q: 'How do I create an account?',
      a: 'Click "Sign Up" on the top navigation, enter your name, email, and password, choose your role (Farmer or Buyer), and you\'re ready to go in under 2 minutes.',
    },
    {
      q: 'How do I rent farm equipment?',
      a: 'Browse available equipment on the home page or Fleet section, click on any listing to see details and pricing, then tap "Rent Now" to send a booking request to the owner.',
    },
    {
      q: 'How do I list my equipment for rent?',
      a: 'Once logged in, click "List Equipment" in the top navigation. Fill in your equipment details, upload photos, set your daily rate, and publish. Your listing goes live immediately.',
    },
    {
      q: 'Is CoFarmz available across India?',
      a: 'Yes! CoFarmz is available across India. We started in Tamil Nadu and are rapidly expanding to all states.',
    },
    {
      q: 'Can I use CoFarmz on my mobile device?',
      a: 'Yes, CoFarmz is fully responsive and works on all smartphones, tablets, and desktop browsers. A dedicated mobile app is coming soon.',
    },
  ],
  rentals: [
    {
      q: 'How does the rental booking process work?',
      a: 'You send a booking request to the equipment owner with your desired dates. The owner reviews and accepts or rejects the request. Once accepted, you coordinate pickup/delivery directly.',
    },
    {
      q: 'What happens after my booking is confirmed?',
      a: 'After confirmation, you can chat with the equipment owner via our messaging system to arrange logistics, pickup time, and any special requirements.',
    },
    {
      q: 'How is the rental price calculated?',
      a: 'Equipment is priced per day by the owner. The total cost is the daily rate × number of rental days. There are no hidden platform fees for basic rentals.',
    },
    {
      q: 'Can I cancel a booking?',
      a: 'Yes, you can cancel a pending or confirmed booking from your "My Reservations" page. Please coordinate with the owner promptly to avoid any inconvenience.',
    },
  ],
  support: [
    {
      q: 'How do I contact CoFarmz support?',
      a: 'You can reach us via WhatsApp or phone at +91 91777 38383. Our team is available Monday–Saturday, 9 AM to 6 PM IST.',
    },
    {
      q: 'Is my personal data secure?',
      a: 'Absolutely. We use industry-standard encryption for all data. Your personal information is never shared with third parties without your consent.',
    },
    {
      q: 'I found a bug or issue. How do I report it?',
      a: 'Please contact us on WhatsApp at +91 91777 38383 with a screenshot and description of the issue. We aim to resolve all bugs within 24–48 hours.',
    },
  ],
};

const categories = [
  { key: 'general', label: 'General', icon: '💬' },
  { key: 'rentals', label: 'Rentals', icon: '🚜' },
  { key: 'support', label: 'Support', icon: '🛟' },
];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('general');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items = faqs[activeCategory as keyof typeof faqs];

  return (
    <div className="min-min-h-[100dvh] bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-700 to-green-600 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
            <span>❓</span> Help & Support
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Frequently Asked Questions</h1>
          <p className="text-green-100 text-base">
            Find answers to common questions about CoFarmz below.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Category Tabs */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(cat.key); setOpenIndex(0); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                activeCategory === cat.key
                  ? 'bg-green-700 text-white shadow-md shadow-green-700/30'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-green-400 hover:text-green-700'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Sidebar — category list */}
          <div className="lg:col-span-2 space-y-2">
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => { setActiveCategory(cat.key); setOpenIndex(0); }}
                className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-left transition-all ${
                  activeCategory === cat.key
                    ? 'bg-green-700 text-white shadow-lg shadow-green-700/20'
                    : 'bg-white text-gray-700 border border-gray-100 hover:border-green-300'
                }`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <div>
                  <p className="font-bold text-sm">{cat.label}</p>
                  <p className={`text-xs mt-0.5 ${activeCategory === cat.key ? 'text-green-200' : 'text-gray-400'}`}>
                    {faqs[cat.key as keyof typeof faqs].length} questions
                  </p>
                </div>
                <svg className={`w-4 h-4 ml-auto ${activeCategory === cat.key ? 'text-white' : 'text-gray-300'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}

            {/* Contact card */}
            <div className="bg-gray-900 rounded-2xl p-5 mt-4">
              <p className="text-white font-bold text-sm mb-1">Still have questions?</p>
              <p className="text-gray-400 text-xs mb-4">Our team is ready to help you.</p>
              <a
                href="https://wa.me/919177738383"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Accordion */}
          <div className="lg:col-span-3 space-y-3">
            {items.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <span className={`font-semibold text-sm pr-4 ${openIndex === i ? 'text-green-700' : 'text-gray-800'}`}>
                    {item.q}
                  </span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    openIndex === i ? 'bg-green-700 rotate-45' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-3.5 h-3.5 ${openIndex === i ? 'text-white' : 'text-gray-500'}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>
                {openIndex === i && (
                  <div className="px-6 pb-5">
                    <div className="w-full h-px bg-gray-100 mb-4"></div>
                    <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 bg-gradient-to-r from-green-700 to-green-600 rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-black text-white mb-2">Need More Help?</h2>
          <p className="text-green-100 text-sm mb-6">
            If your question isn't answered here, our team is happy to assist you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/919177738383"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white text-green-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-green-50 transition"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp Support
            </a>
            <a
              href="tel:+919177738383"
              className="inline-flex items-center justify-center gap-2 bg-white/20 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-white/30 transition border border-white/30"
            >
              📞 Call +91 91777 38383
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
