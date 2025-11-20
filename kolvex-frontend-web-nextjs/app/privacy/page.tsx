import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - Kolvex",
  description:
    "Privacy Policy for Kolvex AI-powered investment platform",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Last Updated: November 3, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              1. Introduction
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Kolvex AI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
              is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use Kolvex (&quot;the Service&quot;).
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Please read this Privacy Policy carefully. By accessing or using
              the Service, you agree to this Privacy Policy. If you do not agree
              with our policies and practices, please do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              2. Information We Collect
            </h2>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              2.1 Personal Information
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We collect information that identifies, relates to, or could
              reasonably be linked with you (&quot;Personal Information&quot;),
              including:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Account Information:</strong> Email address, username,
                password (encrypted), and profile settings
              </li>
              <li>
                <strong>Payment Information:</strong> Payment card details and
                billing information (processed securely through third-party
                payment processors)
              </li>
              <li>
                <strong>Profile Data:</strong> Subscription tier, account
                preferences, and watchlist data
              </li>
              <li>
                <strong>Communication Data:</strong> Messages, inquiries, and
                support requests
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              2.2 Usage Information
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We automatically collect information about your interaction with
              the Service:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Device Information:</strong> IP address, browser type,
                device type, operating system
              </li>
              <li>
                <strong>Usage Data:</strong> Pages viewed, features used, search
                queries, stocks tracked, time spent on the Service
              </li>
              <li>
                <strong>Log Data:</strong> Server logs, error reports, and
                access times
              </li>
              <li>
                <strong>Analytics Data:</strong> User behavior patterns, feature
                usage statistics
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              2.3 Cookies and Tracking Technologies
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We use cookies, web beacons, and similar technologies to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Maintain your session and keep you logged in</li>
              <li>Remember your preferences and settings</li>
              <li>Analyze usage patterns and improve the Service</li>
              <li>Provide personalized content and recommendations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              3. How We Use Your Information
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Service Provision:</strong> To provide, maintain, and
                improve the Service
              </li>
              <li>
                <strong>Account Management:</strong> To create and manage your
                account, process subscriptions, and handle billing
              </li>
              <li>
                <strong>Personalization:</strong> To customize your experience
                and provide relevant content and recommendations
              </li>
              <li>
                <strong>Communication:</strong> To send you service-related
                notifications, updates, and marketing communications (with your
                consent)
              </li>
              <li>
                <strong>Analytics:</strong> To analyze usage patterns, trends,
                and user behavior to improve the Service
              </li>
              <li>
                <strong>Security:</strong> To detect, prevent, and address
                fraud, security issues, and violations of our Terms
              </li>
              <li>
                <strong>Legal Compliance:</strong> To comply with legal
                obligations and enforce our policies
              </li>
              <li>
                <strong>AI Training:</strong> To improve our AI models and
                algorithms (using aggregated, anonymized data)
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              4. Information Sharing and Disclosure
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We do not sell your Personal Information. We may share your
              information in the following circumstances:
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              4.1 Service Providers
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We share information with third-party service providers who
              perform services on our behalf:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Hosting Providers:</strong> For server infrastructure
                and data storage (e.g., Vercel, Supabase)
              </li>
              <li>
                <strong>Payment Processors:</strong> For secure payment
                processing (e.g., Stripe)
              </li>
              <li>
                <strong>Analytics Services:</strong> For usage analytics and
                monitoring (e.g., Vercel Analytics)
              </li>
              <li>
                <strong>Email Services:</strong> For transactional and marketing
                emails
              </li>
              <li>
                <strong>AI Services:</strong> For natural language processing
                and content analysis
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              4.2 Legal Requirements
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We may disclose your information if required to do so by law or in
              response to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Legal process, court orders, or government requests</li>
              <li>Enforce our Terms of Service or other policies</li>
              <li>
                Protect the rights, property, or safety of Kolvex AI, our
                users, or others
              </li>
              <li>
                Detect, prevent, or address fraud, security, or technical issues
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              4.3 Business Transfers
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If we are involved in a merger, acquisition, or sale of assets,
              your information may be transferred as part of that transaction.
              We will provide notice before your information becomes subject to
              a different privacy policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              5. Data Security
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We implement appropriate technical and organizational measures to
              protect your Personal Information:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Encryption:</strong> Data is encrypted in transit
                (HTTPS/TLS) and at rest
              </li>
              <li>
                <strong>Access Controls:</strong> Limited access to Personal
                Information on a need-to-know basis
              </li>
              <li>
                <strong>Authentication:</strong> Secure authentication
                mechanisms including password hashing
              </li>
              <li>
                <strong>Monitoring:</strong> Regular security audits and
                monitoring for vulnerabilities
              </li>
              <li>
                <strong>Third-Party Security:</strong> We vet service providers
                for their security practices
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              However, no method of transmission over the internet or electronic
              storage is 100% secure. While we strive to protect your Personal
              Information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              6. Data Retention
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We retain your Personal Information for as long as necessary to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Provide you with the Service</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce our agreements</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              When you delete your account, we will delete or anonymize your
              Personal Information within 30 days, except where we are required
              to retain it for legal or compliance purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              7. Your Privacy Rights
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Depending on your location, you may have the following rights
              regarding your Personal Information:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Access:</strong> Request access to your Personal
                Information
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate or
                incomplete information
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your Personal
                Information
              </li>
              <li>
                <strong>Portability:</strong> Request a copy of your data in a
                portable format
              </li>
              <li>
                <strong>Objection:</strong> Object to processing of your
                Personal Information
              </li>
              <li>
                <strong>Restriction:</strong> Request restriction of processing
              </li>
              <li>
                <strong>Withdrawal of Consent:</strong> Withdraw consent for
                processing based on consent
              </li>
              <li>
                <strong>Opt-Out:</strong> Opt-out of marketing communications
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              To exercise these rights, please contact us at
              privacy@kolvex.ai. We will respond to your request within 30
              days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              8. International Data Transfers
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your information may be transferred to and processed in countries
              other than your country of residence. These countries may have
              data protection laws that differ from those in your country.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We take appropriate safeguards to ensure your Personal Information
              remains protected in accordance with this Privacy Policy,
              including using standard contractual clauses approved by relevant
              authorities.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              9. Children&apos;s Privacy
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The Service is not intended for children under 18 years of age. We
              do not knowingly collect Personal Information from children under
              18. If you are a parent or guardian and believe your child has
              provided us with Personal Information, please contact us, and we
              will delete such information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              10. Third-Party Links and Services
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The Service may contain links to third-party websites and
              services. We are not responsible for the privacy practices of
              these third parties. We encourage you to read their privacy
              policies before providing them with your information.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The Service aggregates content from third-party platforms
              (Twitter, Reddit, YouTube, Rednote). Your interactions with that
              content may be subject to those platforms&apos; privacy policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              11. California Privacy Rights (CCPA)
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you are a California resident, you have additional rights under
              the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                Right to know what Personal Information we collect, use,
                disclose, and sell
              </li>
              <li>Right to request deletion of your Personal Information</li>
              <li>
                Right to opt-out of the sale of your Personal Information (we do
                not sell Personal Information)
              </li>
              <li>
                Right to non-discrimination for exercising your CCPA rights
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              To exercise these rights, contact us at privacy@kolvex.ai.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              12. European Privacy Rights (GDPR)
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you are in the European Economic Area (EEA) or United Kingdom,
              you have rights under the General Data Protection Regulation
              (GDPR), including the rights listed in Section 7 above.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Our legal basis for processing your Personal Information includes:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                <strong>Contract:</strong> Processing necessary to provide the
                Service
              </li>
              <li>
                <strong>Consent:</strong> Where you have given consent (e.g.,
                marketing communications)
              </li>
              <li>
                <strong>Legitimate Interests:</strong> For our business purposes
                that do not override your rights
              </li>
              <li>
                <strong>Legal Obligation:</strong> To comply with legal
                requirements
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              13. Changes to This Privacy Policy
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the &quot;Last Updated&quot; date</li>
              <li>Sending you an email notification (for material changes)</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your continued use of the Service after changes become effective
              constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              14. Contact Us
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you have questions, concerns, or requests regarding this
              Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 mb-4">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Email:</strong> privacy@kolvex.ai
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Data Protection Officer:</strong> dpo@kolvex.ai
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Legal Team:</strong> legal@kolvex.ai
              </p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              By using Kolvex, you acknowledge that you have read and
              understood this Privacy Policy and agree to the collection, use,
              and disclosure of your information as described herein.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
