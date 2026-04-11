export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-green-700 to-green-600 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-black text-white mb-3">Terms & Conditions</h1>
          <p className="text-green-100 text-sm">Last updated: January 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 space-y-8 text-sm text-gray-600 leading-relaxed">

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-2">1. Acceptance of Terms</h2>
            <p>By using CoFarmz, you agree to these Terms & Conditions. If you do not agree, please discontinue use of the platform.</p>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-2">2. User Accounts</h2>
            <p>You must provide accurate information when registering. You are responsible for maintaining the security of your account credentials. CoFarmz reserves the right to suspend accounts that violate these terms.</p>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-2">3. Equipment Listings</h2>
            <p>Equipment owners are responsible for the accuracy of their listings. All machinery must be in safe working condition. CoFarmz is not liable for equipment performance or disputes between users.</p>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-2">4. Rental Agreements</h2>
            <p>Rental transactions are agreements between equipment owners and renters. CoFarmz facilitates the connection but is not a party to any rental agreement. Users must agree on terms, pricing, and logistics independently.</p>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-2">5. Prohibited Activities</h2>
            <p>Users may not post false listings, harass other users, use the platform for illegal activities, or attempt to circumvent the platform&apos;s systems. Violations will result in immediate account termination.</p>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-2">6. Limitation of Liability</h2>
            <p>CoFarmz provides the platform &quot;as is.&quot; We are not liable for any equipment damage, rental disputes, financial losses, or indirect damages arising from use of the platform.</p>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-3">7. Cancellation & Refund Policy</h2>
            <p className="mb-4">Cancellations are accepted before the rental start date. Refunds are calculated based on how far in advance the cancellation is made:</p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 mb-3">
              <table className="w-full text-sm">
                <thead className="bg-green-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-gray-800">Cancellation Notice</th>
                    <th className="text-left px-4 py-3 font-bold text-gray-800">Refund Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="px-4 py-3 text-gray-600">7 or more days before start</td><td className="px-4 py-3 font-semibold text-green-700">100% refund</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-3 text-gray-600">3–6 days before start</td><td className="px-4 py-3 font-semibold text-blue-700">50% refund</td></tr>
                  <tr><td className="px-4 py-3 text-gray-600">1–2 days before start</td><td className="px-4 py-3 font-semibold text-yellow-700">25% refund</td></tr>
                  <tr className="bg-gray-50"><td className="px-4 py-3 text-gray-600">Same day as start</td><td className="px-4 py-3 font-semibold text-red-600">No refund</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">Refunds are processed within 5–7 business days to the original payment method.</p>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-2">8. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.</p>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-base mb-2">9. Contact</h2>
            <p>For questions about these terms, contact us at +91 91777 38383 or via WhatsApp.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
