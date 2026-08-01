import { AppShell } from "@/components/app-shell";

type FeaturePlaceholderProps = {
  title: string;
  eyebrow: string;
  summary: string;
  dataSources: string[];
  nextSteps: string[];
};

export function FeaturePlaceholder({
  title,
  eyebrow,
  summary,
  dataSources,
  nextSteps,
}: FeaturePlaceholderProps) {
  return (
    <AppShell title={title} eyebrow={eyebrow}>
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Interface kept, sample data removed</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{summary}</p>
        </section>

        <section className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-lg font-semibold">Data this page will use</h2>
          <ul className="mt-4 grid gap-3">
            {dataSources.map((source) => (
              <li key={source} className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
                {source}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-background p-5">
        <h2 className="text-lg font-semibold">Next build steps</h2>
        <ol className="mt-4 grid gap-3">
          {nextSteps.map((step, index) => (
            <li key={step} className="flex gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm">
              <span className="font-semibold text-muted">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
