import DashboardLayout from "@/components/layout/DashboardLayout";
import { RouteLoadingSignal } from "@/components/layout/NavigationProgress";

/**
 * Chat detail keeps the dashboard frame and an empty body while it loads, so sending the
 * first message does not flash the generic list skeleton before the conversation appears.
 */
export default function ChatDetailLoading() {
  return (
    <DashboardLayout noTransition>
      <RouteLoadingSignal />
      <div className="min-h-0 flex-1" />
    </DashboardLayout>
  );
}
