import { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us - Kolvex",
  description: "Get in touch with the Kolvex team",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden transition-colors duration-300 flex flex-col">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid z-0 opacity-50"></div>
      {/* <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-light/90 dark:via-background-dark/90 to-background-light dark:to-background-dark z-0"></div> */}

      <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 w-full">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Contact Us
            </h1>
            <p className="text-muted-foreground mb-8 text-lg">
              Have questions, suggestions, or need support? We&apos;re here to
              help. Reach out to us through any of the following channels.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Email Us
                </h3>
                <p className="text-muted-foreground mt-2">
                  For support:{" "}
                  <a
                    href="mailto:support@kolvex.app"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    support@kolvex.app
                  </a>
                </p>
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </div>
      <Footer />
    </div>
  );
}
