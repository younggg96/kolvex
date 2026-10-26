import { NextRequest } from "next/server";
import { marketEventsProxy } from "@/lib/server/marketEventsProxy";
export const dynamic = "force-dynamic";
export const GET = (request: NextRequest) => marketEventsProxy(request, true);
export const POST = GET;
