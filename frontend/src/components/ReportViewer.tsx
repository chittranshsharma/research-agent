'use client';

import ReactMarkdown from 'react-markdown';

interface ReportViewerProps {
  content: string;
}

export function ReportViewer({ content }: ReportViewerProps) {
  return (
    <div className="prose prose-invert prose-blue max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ ...props }) => <h1 className="text-3xl font-bold mt-8 mb-4 text-white" {...props} />,
          h2: ({ ...props }) => <h2 className="text-2xl font-bold mt-8 mb-4 text-white border-b border-border pb-2" {...props} />,
          h3: ({ ...props }) => <h3 className="text-xl font-semibold mt-6 mb-3 text-white" {...props} />,
          p: ({ ...props }) => <p className="leading-relaxed mb-4 text-gray-300" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc pl-6 mb-4 text-gray-300" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-6 mb-4 text-gray-300" {...props} />,
          li: ({ ...props }) => <li className="mb-1" {...props} />,
          a: ({ ...props }) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic text-gray-400 my-4" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !className;
            return isInline ? (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-gray-200" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4 border border-border">
                <code className="text-sm font-mono text-gray-200" {...props}>
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
