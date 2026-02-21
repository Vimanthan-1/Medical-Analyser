import React from 'react';

/**
 * Parses and renders AI explanation text cleanly.
 * Handles:
 *  - Raw JSON wrapper ({"explanation":"..."}) from old/non-streaming backend
 *  - **bold** markdown
 *  - Numbered lists (1. 2. 3.)
 *  - \n line breaks
 */

function stripJsonWrapper(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            return parsed.explanation ?? parsed.response ?? trimmed;
        } catch {
            // partial JSON mid-stream — return as-is for now
        }
    }
    return trimmed;
}

function parseLine(line: string, key: number): React.ReactNode {
    // Render **bold** inline
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{part}</strong> : part
    );
    return <React.Fragment key={key}>{rendered}</React.Fragment>;
}

interface Props {
    text: string;
    streaming?: boolean; // show cursor when still streaming
}

export function ExplanationRenderer({ text, streaming = false }: Props) {
    const clean = stripJsonWrapper(text);

    // Split into lines, group numbered items
    const lines = clean.split(/\n/).filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));

    return (
        <div className="space-y-2 text-sm text-foreground leading-relaxed">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-1" />;

                // Detect numbered list item: "1." "2." etc.
                const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/s);
                if (numMatch) {
                    return (
                        <div key={i} className="flex gap-3 items-start">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                                {numMatch[1]}
                            </span>
                            <span className="flex-1">{parseLine(numMatch[2], i)}</span>
                        </div>
                    );
                }

                return <p key={i}>{parseLine(trimmed, i)}</p>;
            })}
            {streaming && (
                <span className="inline-block w-1.5 h-4 bg-primary animate-pulse rounded-sm ml-0.5" />
            )}
        </div>
    );
}
