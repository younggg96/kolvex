import { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Youtube, Construction } from "lucide-react";

export const metadata: Metadata = {
  title: "YouTube - Social Media - Kolvex",
  description: "YouTube videos and analytics from financial influencers",
};

export default function YouTubePage() {
  return (
    <DashboardLayout title="YouTube" showHeader={true}>
      <div className="relative flex-1 flex flex-col min-h-0 bg-background">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative flex-1 p-4 md:p-6 overflow-auto">
          <Card className="border-dashed">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/20">
                <Youtube className="h-8 w-8 text-red-500" />
              </div>
              <CardTitle className="text-xl">YouTube</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                <Construction className="h-5 w-5" />
                <span>Coming Soon</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                YouTube video analysis and financial influencer tracking is
                coming soon. Get insights from top finance YouTubers and their
                market predictions!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
