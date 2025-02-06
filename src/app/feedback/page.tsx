import { Metadata } from "next";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { SubLayout } from "@/components/layout/sub-layout";
import { AuthService } from "@/lib/services/auth.service";
import { AuthServerService } from "@/lib/services/auth.server";

export const metadata: Metadata = {
  title: "Feedback - Favely",
  description: "Submit feedback to help us improve Favely",
};

export default async function FeedbackPage() {
  const user = await AuthServerService.getCurrentUser();

  return (
    <SubLayout title="Feedback">
      <div className="px-4 md:px-6 lg:px-8 pt-4 pb-20 sm:pb-8">
        <div  className="pb-20 sm:pb-8">
          <h1 className="text-3xl font-bold">Feedback</h1>
          <p className="text-muted-foreground mt-2">
            Help us improve Favely by sharing your thoughts and suggestions
          </p>
        </div>
        <FeedbackForm 
          userId={user?.id} 
          username={user?.username || undefined}
        />
      </div>
    </SubLayout>
  );
} 