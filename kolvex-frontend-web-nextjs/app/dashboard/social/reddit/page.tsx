import { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Construction } from "lucide-react";

export const metadata: Metadata = {
  title: "Reddit - Social Media - Kolvex",
  description: "Reddit discussions and analytics",
};

export default function RedditPage() {
  return (
    <DashboardLayout title="Reddit" showHeader={true}>
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative flex-1 p-4 md:p-6 overflow-auto">
          <Card className="border-dashed">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20">
                <MessageCircle className="h-8 w-8 text-orange-500" />
              </div>
              <CardTitle className="text-xl">Reddit</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                <Construction className="h-5 w-5" />
                <span>Coming Soon</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Reddit community discussions and sentiment analysis is coming soon.
                Track trending topics from r/wallstreetbets, r/stocks, and more!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}


