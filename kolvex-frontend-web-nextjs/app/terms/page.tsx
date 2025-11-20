import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - Kolvex",
  description:
    "Terms of Service for Kolvex AI-powered investment platform",
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Last Updated: November 3, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              By accessing or using Kolvex (&quot;the Service&quot;),
              you agree to be bound by these Terms of Service
              (&quot;Terms&quot;). If you do not agree to these Terms, please do
              not use the Service.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              These Terms constitute a legally binding agreement between you and
              Kolvex AI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
              regarding your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              2. Description of Service
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Kolvex is an AI-powered investment intelligence platform
              that provides:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                Social media monitoring and analysis from platforms including
                Twitter, Reddit, YouTube, and Rednote
              </li>
              <li>Key Opinion Leader (KOL) tracking and sentiment analysis</li>
              <li>Stock market data aggregation and visualization</li>
              <li>AI-generated investment insights and analysis</li>
              <li>Earnings calendar and financial news aggregation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              3. Investment Disclaimer
            </h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-4">
              <p className="text-gray-900 dark:text-yellow-100 font-semibold mb-2">
                IMPORTANT: NOT FINANCIAL ADVICE
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The information provided through Kolvex is for
                informational and educational purposes only. It does not
                constitute financial advice, investment advice, trading advice,
                or any other sort of advice.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You should not treat any of the Service&apos;s content as a
                recommendation to buy, sell, or hold any security or investment.
                We are not registered investment advisors, and the Service does
                not provide personalized investment recommendations.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                All investment decisions should be made based on your own
                research and consultation with qualified financial
                professionals. Investing involves risk, including the possible
                loss of principal.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              4. User Accounts
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              To access certain features of the Service, you may need to create
              an account. You agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                Provide accurate, current, and complete information during
                registration
              </li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>
                Notify us immediately of any unauthorized access or security
                breach
              </li>
              <li>
                Accept responsibility for all activities that occur under your
                account
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              5. Subscription and Payments
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Kolvex offers both free and paid subscription tiers. Paid
              subscriptions are subject to the following terms:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                Subscription fees are billed in advance on a recurring monthly
                or annual basis
              </li>
              <li>All fees are non-refundable except as required by law</li>
              <li>
                We reserve the right to change subscription fees with 30
                days&apos; notice
              </li>
              <li>
                You may cancel your subscription at any time; cancellation takes
                effect at the end of the current billing period
              </li>
              <li>
                Failure to pay subscription fees may result in service
                suspension or termination
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              6. Acceptable Use
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                Use the Service for any illegal purpose or in violation of any
                laws
              </li>
              <li>
                Attempt to gain unauthorized access to the Service or its
                systems
              </li>
              <li>
                Scrape, copy, or redistribute content from the Service without
                permission
              </li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>
                Use automated systems (bots, scrapers) to access the Service
              </li>
              <li>
                Impersonate any person or entity or misrepresent your
                affiliation
              </li>
              <li>Share your account credentials with others</li>
              <li>
                Use the Service to manipulate markets or engage in fraudulent
                activity
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              7. Intellectual Property
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The Service and its original content, features, and functionality
              are owned by Kolvex AI and are protected by international
              copyright, trademark, patent, trade secret, and other intellectual
              property laws.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You may not copy, modify, distribute, sell, or lease any part of
              our Service without our express written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              8. Data Accuracy and Availability
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              While we strive to provide accurate and timely information, we
              cannot guarantee:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>
                The accuracy, completeness, or timeliness of any data or
                analysis
              </li>
              <li>Uninterrupted or error-free service availability</li>
              <li>
                That defects will be corrected or that the Service is free of
                viruses or harmful components
              </li>
              <li>The accuracy of AI-generated content or analysis</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Third-party data sources may have delays, errors, or interruptions
              beyond our control.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              9. Limitation of Liability
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, KOLVEX AI SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER
              INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE,
              GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Your use or inability to use the Service</li>
              <li>
                Any investment decisions made based on information from the
                Service
              </li>
              <li>Unauthorized access to or alteration of your data</li>
              <li>Any third-party content or conduct on the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              10. Indemnification
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You agree to indemnify and hold harmless Kolvex AI, its
              officers, directors, employees, and agents from any claims,
              damages, losses, liabilities, and expenses (including attorney
              fees) arising from:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
              <li>Any investment decisions you make</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              11. Termination
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We may terminate or suspend your account and access to the Service
              immediately, without prior notice or liability, for any reason,
              including if you breach these Terms.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Upon termination, your right to use the Service will immediately
              cease. All provisions of these Terms which by their nature should
              survive termination shall survive.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              12. Changes to Terms
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We reserve the right to modify these Terms at any time. We will
              notify users of material changes via email or through the Service.
              Your continued use of the Service after changes constitutes
              acceptance of the modified Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              13. Governing Law
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              These Terms shall be governed by and construed in accordance with
              the laws of the jurisdiction where Kolvex AI is registered,
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
              14. Contact Information
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Email: legal@kolvex.ai
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              By using Kolvex, you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
