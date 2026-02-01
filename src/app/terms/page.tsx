import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Content */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-8 space-y-6">
          <h1 className="text-3xl font-bold text-white mb-6">Terms of Service</h1>

          <p className="text-slate-400 text-sm">
            <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p className="text-slate-300">
              By accessing or using plnngpkr (the "Service"), you agree to be bound by these Terms of Service ("Terms").
              If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">2. Service Description</h2>
            <p className="text-slate-300">
              plnngpkr is a real-time story estimation tool for agile teams. The Service is provided "as is"
              without any warranties, express or implied.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">3. Disclaimer of Warranties</h2>
            <p className="text-slate-300">
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Warranties of merchantability or fitness for a particular purpose</li>
              <li>Non-infringement of intellectual property</li>
              <li>Uninterrupted, secure, or error-free operation</li>
              <li>Accuracy, reliability, or completeness of any content</li>
              <li>Freedom from viruses or other harmful components</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">4. Limitation of Liability</h2>
            <p className="text-slate-300">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE SERVICE PROVIDER, ITS AFFILIATES,
              DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, use, goodwill, or other intangible losses</li>
              <li>Damages arising from your access to or use of (or inability to access or use) the Service</li>
              <li>Any conduct or content of any third party on the Service</li>
              <li>Unauthorized access, use, or alteration of your content or data</li>
              <li>Business interruption or system failures</li>
            </ul>
            <p className="text-slate-300 mt-4">
              This limitation applies whether based on warranty, contract, tort (including negligence),
              or any other legal theory, and whether or not we have been informed of the possibility of such damage.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">5. No Data Persistence Guarantee</h2>
            <p className="text-slate-300">
              Room data is stored in-memory and is not persisted. We make no guarantees regarding:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Data retention or availability</li>
              <li>Recovery of lost data due to server restarts, crashes, or maintenance</li>
              <li>Backup or archival of any content</li>
            </ul>
            <p className="text-slate-300">
              You are solely responsible for maintaining your own records of any important information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">6. User Responsibilities</h2>
            <p className="text-slate-300">You agree to:</p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Use the Service at your own risk</li>
              <li>Not hold the Service provider liable for any damages resulting from your use</li>
              <li>Not use the Service for any unlawful purpose</li>
              <li>Not interfere with or disrupt the Service or servers</li>
              <li>Not attempt to gain unauthorized access to any part of the Service</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">7. Indemnification</h2>
            <p className="text-slate-300">
              You agree to indemnify, defend, and hold harmless the Service provider and its affiliates from any claims,
              damages, losses, liabilities, and expenses (including legal fees) arising from:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Your use or misuse of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">8. Service Availability</h2>
            <p className="text-slate-300">
              We reserve the right to:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Modify, suspend, or discontinue the Service at any time without notice</li>
              <li>Refuse service to anyone for any reason</li>
              <li>Remove or modify content at our discretion</li>
              <li>Change these Terms at any time</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">9. Third-Party Services</h2>
            <p className="text-slate-300">
              The Service may contain links to third-party websites or services. We are not responsible for
              the content, privacy policies, or practices of any third-party sites or services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">10. Governing Law</h2>
            <p className="text-slate-300">
              These Terms shall be governed by and construed in accordance with applicable laws, without regard
              to conflict of law provisions. Any disputes shall be resolved in the appropriate jurisdiction.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">11. Severability</h2>
            <p className="text-slate-300">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be
              limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain
              in full force and effect.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">12. Entire Agreement</h2>
            <p className="text-slate-300">
              These Terms constitute the entire agreement between you and the Service provider regarding the
              use of the Service and supersede all prior agreements.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">13. Contact</h2>
            <p className="text-slate-300">
              By using this Service, you acknowledge that you have read, understood, and agree to be bound by
              these Terms of Service.
            </p>
          </section>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-slate-400 text-sm italic">
              USE AT YOUR OWN RISK. THE SERVICE PROVIDER ASSUMES NO LIABILITY FOR ANY DAMAGES,
              LOSSES, OR ISSUES ARISING FROM YOUR USE OF THIS SERVICE.
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            Return to plnngpkr
          </Link>
        </div>
      </div>
    </div>
  );
}
