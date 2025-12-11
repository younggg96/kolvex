import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Contact Us - Kolvex",
  description: "Get in touch with the Kolvex team",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative overflow-hidden transition-colors duration-300 flex flex-col">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid z-0 opacity-50"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-light/90 dark:via-background-dark/90 to-background-light dark:to-background-dark z-0"></div>

      <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 w-full">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Contact Us
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
              Have questions, suggestions, or need support? We're here to help.
              Reach out to us through any of the following channels.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Email Us
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  For support:{" "}
                  <a
                    href="mailto:support@kolvex.ai"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    support@kolvex.app
                  </a>
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Social Media
                </h3>
                <div className="flex space-x-4">
                  <a
                    href="https://twitter.com/kolvex_ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
                  >
                    Twitter / X
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card-light dark:bg-card-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Send us a message
            </h2>
            <form className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Name
                </label>
                <Input
                  id="name"
                  placeholder="Your name"
                  className="bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark"
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Message
                </label>
                <Textarea
                  id="message"
                  placeholder="How can we help?"
                  rows={4}
                  className="bg-background-light dark:bg-background-dark resize-none border-border-light dark:border-border-dark"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                Send Message
              </Button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
