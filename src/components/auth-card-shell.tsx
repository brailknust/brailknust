type AuthCardShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

export function AuthCardShell({ children, eyebrow, title, description }: AuthCardShellProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
