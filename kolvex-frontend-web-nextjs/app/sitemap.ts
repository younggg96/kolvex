import { buildPublicSitemap } from "@/lib/publicSitemap";

// Read publication state afresh; withdrawn reports must leave discovery too.
export const dynamic = "force-dynamic";

export default buildPublicSitemap;
