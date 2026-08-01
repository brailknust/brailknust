"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-3 mt-1 text-xl font-semibold leading-7">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-5 text-lg font-semibold leading-7 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold leading-6 first:mt-0">{children}</h3>,
        h4: ({ children }) => <h4 className="mb-2 mt-4 font-semibold first:mt-0">{children}</h4>,
        p: ({ children }) => <p className="my-2 break-words leading-6 first:mt-0 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li className="pl-1 leading-6">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-accent pl-3 text-muted">{children}</blockquote>
        ),
        hr: () => <hr className="my-5 border-border" />,
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-background">{children}</thead>,
        th: ({ children }) => <th className="border-b border-r border-border px-3 py-2 font-semibold last:border-r-0">{children}</th>,
        td: ({ children }) => <td className="border-b border-r border-border px-3 py-2 align-top leading-5 last:border-r-0">{children}</td>,
        tr: ({ children }) => <tr className="last:[&>td]:border-b-0">{children}</tr>,
        code: ({ children, className }) => className ? (
          <code className={`${className} block overflow-x-auto rounded-md bg-foreground p-3 font-mono text-xs text-background`}>
            {children}
          </code>
        ) : (
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
        ),
        pre: ({ children }) => <pre className="my-3 overflow-x-auto">{children}</pre>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
