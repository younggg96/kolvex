import { publicPageMetadata } from "@/lib/seo";
import ContactPageContent from "@/components/contact/ContactPageContent";

export const metadata = publicPageMetadata(
  "Contact Kolvex — Support & Feedback",
  "Contact the Kolvex team for product support, stock research workspace questions, and feedback.",
  "/contact",
);

export default function ContactPage() {
  return <ContactPageContent />;
}
