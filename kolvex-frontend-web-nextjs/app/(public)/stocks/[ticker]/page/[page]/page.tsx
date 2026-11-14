// Page 2+ of /stocks/[ticker]; page 1 redirects to /stocks/[ticker].
export { default, generateMetadata } from "../../page";

export async function generateStaticParams() {
  return [];
}
