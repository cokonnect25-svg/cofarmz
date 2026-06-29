export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Information You Provide",
      body: "We collect information you provide when you create or update your CoFarmz account, including your name, email address, mobile number, profile photo, role, location, gender, age, supplier type, crops, equipment listings, certifications, booking details, and other profile information you choose to add."
    },
    {
      title: "2. Content, Reels, Photos, and Activity",
      body: "We collect and process content you create, upload, or interact with on CoFarmz, including reels, photos, videos, captions, comments, likes, crop details, equipment details, reviews, favorites, searches, page views, contact actions, and other activity on the platform. Content you publish may be visible to other users based on the feature and your privacy settings."
    },
    {
      title: "3. Messages, Calls, Followers, and Notifications",
      body: "We process messages, conversation details, media shared in messages, read status, follower requests, follower status, calling preferences, call-contact actions, and notification tokens so users can communicate, receive booking updates, manage follower requests, and control who can contact them. Calling can be enabled or disabled from your profile. When calling is enabled, only accepted followers can call you unless another feature requires a booking-related contact."
    },
    {
      title: "4. Location Information",
      body: "With your permission, we may collect precise or approximate location information from your device. We also store locations you enter manually for your profile, crops, equipment, and bookings. Location is used to show nearby farmers, buyers, suppliers, equipment, maps, distance estimates, and location-based recommendations. You can disable device location access in your device settings."
    },
    {
      title: "5. Device, Usage, Cookies, and Analytics",
      body: "We may collect technical and usage information such as IP address, browser type, operating system, device identifiers, app version, session data, pages visited, features used, error logs, and performance data. We use cookies, local storage, Firebase, and analytics tools to keep you logged in, remember preferences, improve performance, understand usage, prevent abuse, and secure the service."
    },
    {
      title: "6. How We Use Information",
      body: "We use information to provide, personalize, and improve CoFarmz; create and manage accounts; display profiles and listings; enable reels, comments, likes, messages, calls, follows, bookings, reviews, maps, and notifications; recommend relevant users, crops, equipment, and content; verify mobile numbers; detect fraud or misuse; debug issues; maintain safety; and comply with legal obligations."
    },
    {
      title: "7. Public and Shared Information",
      body: "Your profile name, role, profile photo, location, crops, equipment, reels, captions, comments, likes, followers/following counts, reviews, and other public or feature-visible information may be seen by other users. Messages are visible to the sender and receiver. Booking details are shared between the renter and the equipment owner as needed to complete the booking."
    },
    {
      title: "8. How We Share Information",
      body: "We do not sell your personal information. We may share information with other CoFarmz users when required by a feature, with trusted service providers that help us operate the platform, with payment or delivery partners if such features are enabled, with authorities when required by law, or when necessary to protect users, prevent fraud, enforce our terms, or respond to safety and security issues."
    },
    {
      title: "9. Service Providers and Integrations",
      body: "CoFarmz may use third-party providers for hosting, database storage, cloud media storage, authentication, mobile verification, maps, analytics, push notifications, content delivery, email, and support. These providers may process information only to provide services to CoFarmz and are subject to their own privacy and security practices."
    },
    {
      title: "10. Data Security",
      body: "We use HTTPS/TLS encryption, password hashing, access controls, and other reasonable technical and organizational measures to protect your information. No system is completely secure, but we work to protect accounts, content, messages, media, and platform data from unauthorized access, disclosure, alteration, or misuse."
    },
    {
      title: "11. Data Retention",
      body: "We keep information for as long as needed to provide CoFarmz, maintain account records, complete bookings, resolve disputes, improve safety, prevent fraud, comply with legal obligations, and enforce our terms. If you delete content or request account deletion, we will delete or anonymize information unless retention is required for security, legal, backup, dispute, or legitimate business reasons."
    },
    {
      title: "12. Your Choices and Controls",
      body: "You can access and update your profile, phone number, location, role, crop and equipment details, reels, calling preference, notification choices, followers, and other account information from the app. You can also control device permissions such as camera, media, notifications, and location through your device settings."
    },
    {
      title: "13. Your Rights",
      body: "Depending on applicable law, you may have the right to access, correct, update, export, restrict, object to processing, or delete your personal information. You may contact us to request help with your data, account, content, privacy settings, or deletion requests."
    },
    {
      title: "14. Safety, Integrity, and Legal Requests",
      body: "We may review or preserve information when needed to investigate suspicious activity, enforce our rules, protect users and the public, respond to legal requests, prevent spam or fraud, resolve technical issues, or maintain the integrity and availability of CoFarmz."
    },
    {
      title: "15. Children's Privacy",
      body: "CoFarmz is not intended for children below the minimum legal age required in their country. We do not knowingly collect personal information from children. If we learn that a child has provided personal information without proper consent, we will take appropriate steps to remove it."
    },
    {
      title: "16. International Processing",
      body: "Your information may be stored and processed using servers, databases, cloud providers, and service providers located in India or other countries. Where required, we take appropriate steps to protect information when it is transferred or processed outside your region."
    },
    {
      title: "17. Policy Updates",
      body: "We may update this Privacy Policy from time to time to reflect new features, legal requirements, security practices, or changes to CoFarmz. Updated versions will be posted on this page with the latest effective date."
    },
    {
      title: "18. Contact Us",
      body: "If you have questions, concerns, complaints, or requests about this Privacy Policy or your data, please contact the CoFarmz Support Team using the official email or WhatsApp number shown below."
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
            what information we collect, how we use and share it, how CoFarmz
            features such as reels, messages, followers, calls, bookings, maps,
            and notifications work with your data, and the choices you have when
            using our platform.
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
