import { FeaturePlaceholder } from "@/components/feature-placeholder";

export default function FeedbackPage() {
  return (
    <FeaturePlaceholder
      title="Feedback"
      eyebrow="Product"
      summary="Feedback is kept as a future route, but the submit form will be added only when feedback can be saved."
      dataSources={["Signed-in user", "Future feedback table", "Feedback status"]}
      nextSteps={[
        "Add a feedback model if in-app feedback should be stored.",
        "Create a submit action with validation.",
        "Add admin review later if needed.",
      ]}
    />
  );
}
