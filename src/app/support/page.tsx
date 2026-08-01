import { FeaturePlaceholder } from "@/components/feature-placeholder";

export default function SupportPage() {
  return (
    <FeaturePlaceholder
      title="Support"
      eyebrow="Help"
      summary="Support remains part of the interface map, but canned FAQ content has been removed until the app has real support flows."
      dataSources={["Support content", "User account context", "Future support requests"]}
      nextSteps={[
        "Decide whether support is static help content or saved support requests.",
        "Add a support request model only if messages need tracking.",
        "Link support entries to the signed-in user.",
      ]}
    />
  );
}
