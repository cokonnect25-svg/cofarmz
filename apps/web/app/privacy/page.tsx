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


export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Information We Collect",
      body: "We collect information you provide when creating an account, including your name, email address, phone number, profile photo, bio, and other profile details. We also collect content you upload, such as posts, reels, photos, videos, comments, likes, messages, and call preferences. Technical information such as your IP address, device information, browser type, operating system, app version, and usage logs may also be collected."
    },
    {
      title: "2. How We Use Your Information",
      body: "We use your information to create and manage your account, display your profile, enable posting of reels and media, provide messaging and calling features, personalize your experience, recommend relevant content, improve platform performance, send notifications, prevent fraud, and maintain the security of our services."
    },
    {
      title: "3. Reels, Photos & Videos",
      body: "Content you upload, including reels, photos, videos, captions, comments, and profile images, may be visible to other users according to your privacy settings. By uploading content, you grant CoFarmz permission to securely store, process, and display your content within the platform. You retain ownership of your content."
    },
    {
      title: "4. Followers & Calling Feature",
      body: "Users can follow other users on the platform. If you enable the 'Enable Calling' option in your profile settings, only followers (or users allowed by your privacy settings) can contact you through the calling feature. You can enable or disable calling at any time."
    },
    {
      title: "5. Messages & Notifications",
      body: "We use your information to deliver messages, notifications, booking updates, follower alerts, likes, comments, and other important account-related communications."
    },
    {
      title: "6. Location Information",
      body: "With your permission, we may access your device location to provide nearby recommendations and improve location-based services. You can disable location access through your device settings."
    },
    {
      title: "7. Cookies & Analytics",
      body: "We use cookies, local storage, and analytics technologies to remember your preferences, keep you logged in, improve performance, analyze usage, and enhance your overall experience."
    },
    {
      title: "8. Data Security",
      body: "We use HTTPS/TLS encryption to secure all communications. Passwords are securely encrypted, and we implement appropriate technical and organizational measures to protect your information against unauthorized access, disclosure, or misuse."
    },
    {
      title: "9. Third-Party Services",
      body: "Our platform may use trusted third-party providers for cloud storage, authentication, payment processing, analytics, notifications, and content delivery. These providers process information according to their own privacy policies."
    },
    {
      title: "10. Sharing Your Information",
      body: "We do not sell your personal information. Information may be shared only with trusted service providers, when required by law, to protect the safety of users, or with your explicit consent."
    },
    {
      title: "11. Your Rights",
      body: "You may access, update, download, or delete your account information at any time. You can also manage your privacy settings, calling preferences, notifications, followers, and account visibility directly from your profile."
    },
    {
      title: "12. Children's Privacy",
      body: "Our services are not intended for children below the minimum legal age required in your country. We do not knowingly collect personal information from children."
    },
    {
      title: "13. Policy Updates",
      body: "We may update this Privacy Policy from time to time. Any changes will be published on this page with the latest effective date."
    },
    {
      title: "14. Contact Us",
      body: "If you have any questions or concerns regarding this Privacy Policy, please contact the CoFarmz Support Team through our official email or WhatsApp support."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-700 via-green-600 to-emerald-600 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white">
            Privacy Policy
          </h1>
          <p className="text-green-100 mt-3">
            Effective Date: January 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 md:p-10 space-y-8">
          <p className="text-gray-600 leading-8">
            At <strong>CoFarmz</strong>, we value your privacy and are committed
            to protecting your personal information. This Privacy Policy explains
            what information we collect, how we use it, and the choices you have
            regarding your data when using our platform.
          </p>

          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                {section.title}
              </h2>
              <p className="text-gray-600 leading-8">{section.body}</p>
            </div>
          ))}

          <div className="rounded-2xl bg-green-50 border border-green-200 p-6">
            <h3 className="text-lg font-bold text-green-800 mb-2">
              Contact Information
            </h3>

            <div className="space-y-2 text-gray-700">
              <p>
                <strong>Application:</strong> CoFarmz
              </p>

              <p>
                <strong>Email:</strong> connect@co-konnect.com
              </p>

              <p>
                <strong>WhatsApp:</strong> +91 91777 38383
              </p>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
