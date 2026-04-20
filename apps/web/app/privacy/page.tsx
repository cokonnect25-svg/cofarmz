export default function PrivacyPage() {
  return (
    <div className="min-min-h-[100dvh] bg-gray-50">
      <div className="bg-gradient-to-br from-green-700 to-green-600 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-black text-white mb-3">Privacy Policy</h1>
          <p className="text-green-100 text-sm">Last updated: January 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 space-y-8 text-sm text-gray-600 leading-relaxed">
          {[
            { title: '1. Information We Collect', body: 'We collect information you provide when registering (name, email, phone), profile details (location, photo), and usage data (pages visited, equipment listed, bookings made).' },
            { title: '2. How We Use Your Information', body: 'Your information is used to operate the platform, connect farmers and equipment renters, send booking notifications, and improve our services. We do not sell your data to third parties.' },
            { title: '3. Data Security', body: 'We use industry-standard encryption (HTTPS/TLS) for all data transmission. Passwords are hashed using bcrypt. Profile images are stored securely on Cloudflare R2.' },
            { title: '4. Cookies', body: 'We use session cookies to keep you logged in and improve your experience. You can disable cookies in your browser settings, but this may affect platform functionality.' },
            { title: '5. Third-Party Services', body: 'We use Cloudflare for media storage and PostgreSQL for data storage. These services have their own privacy policies. We do not share your personal data with advertisers.' },
            { title: '6. Your Rights', body: 'You may request to view, update, or delete your account data at any time by contacting us via WhatsApp at +91 91777 38383.' },
            { title: '7. Contact Us', body: 'For any privacy concerns, contact CoFarmz support at +91 91777 38383 or via WhatsApp.' },
          ].map(s => (
            <div key={s.title}>
              <h2 className="text-gray-900 font-bold text-base mb-2">{s.title}</h2>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
