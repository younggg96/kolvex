import HomePageClient from "@/components/pages/HomePageClient";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(SITE_TITLE, SITE_DESCRIPTION, "/");

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kolvex",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512x512.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Kolvex",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <HomePageClient />
    </>
  );
}
