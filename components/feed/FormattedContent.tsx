'use client';

import React, { useState } from 'react';
import { Check, Copy, Code } from 'lucide-react';

interface FormattedContentProps {
  content: string;
  kind?: number;
}

export function FormattedContent({ content, kind }: FormattedContentProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split content by code blocks: ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const blocks: Array<{ type: 'code' | 'text'; lang?: string; code?: string; text?: string }> = [];

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }
    blocks.push({
      type: 'code',
      lang: match[1] || 'code',
      code: match[2].trim()
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push({ type: 'text', text: content.slice(lastIndex) });
  }

  // Render inline text elements (headers, blockquotes, inline backticks, bold/italic, URLs)
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');

    return lines.map((line, idx) => {
      // 1. Headers
      if (line.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-lg font-bold text-white pt-2 pb-1 border-b border-white/10 my-1">
            {line.replace(/^#\s+/, '')}
          </h1>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-base font-bold text-white pt-1.5 pb-1 border-b border-white/10 my-1">
            {line.replace(/^##\s+/, '')}
          </h2>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-pink-300 my-1">
            {line.replace(/^###\s+/, '')}
          </h3>
        );
      }

      // 2. Blockquotes
      if (line.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            className="border-l-2 border-pink-500 pl-3 my-1.5 text-xs text-white/80 italic bg-white/[0.02] py-1 rounded-r-md"
          >
            {line.replace(/^>\s+/, '')}
          </blockquote>
        );
      }

      // Empty line -> paragraph break
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }

      // Inline formatting helper
      const renderInlineTokens = (str: string) => {
        // Match backtick inline code `code`, bold **text**, links http...
        const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g);

        return parts.map((part, pIdx) => {
          if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
              <code
                key={pIdx}
                className="px-1.5 py-0.5 mx-0.5 rounded bg-[#161412] border border-white/20 text-pink-300 font-mono text-[11px]"
              >
                {part.slice(1, -1)}
              </code>
            );
          }

          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <strong key={pIdx} className="font-bold text-white">
                {part.slice(2, -2)}
              </strong>
            );
          }

          if (part.match(/^https?:\/\/[^\s]+/)) {
            return (
              <a
                key={pIdx}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-pink-400 hover:underline font-mono text-xs break-all"
              >
                {part}
              </a>
            );
          }

          return part;
        });
      };

      return (
        <p key={idx} className="leading-relaxed">
          {renderInlineTokens(line)}
        </p>
      );
    });
  };

  return (
    <div className="space-y-3 font-sans text-xs sm:text-sm text-white/90">
      {kind === 30023 && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-[10px] font-mono font-bold text-pink-400">
          <span>RFC / Long-form Dispatch</span>
        </div>
      )}

      {blocks.map((block, index) => {
        if (block.type === 'code' && block.code) {
          return (
            <div
              key={`code-${index}`}
              className="my-3 rounded-[16px] bg-[#000000] border border-white/20 overflow-hidden font-mono shadow-md"
            >
              {/* Code block header bar */}
              <div className="px-3.5 py-2 bg-[#161412] border-b border-white/10 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-white/70">
                  <Code size={13} className="text-pink-400" />
                  <span className="uppercase font-bold tracking-wider">{block.lang || 'code'}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyCode(block.code || '', index);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer text-[10px]"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code block body */}
              <pre className="p-4 overflow-x-auto text-xs text-emerald-300 font-mono leading-relaxed selection:bg-emerald-500/30">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        return <div key={`text-${index}`}>{renderFormattedText(block.text || '')}</div>;
      })}
    </div>
  );
}
