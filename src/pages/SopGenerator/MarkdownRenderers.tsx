/* eslint-disable react-refresh/only-export-components -- this module exports a
   components-map config object alongside its renderer components, not a route/page */
import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Divider,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { Components } from 'react-markdown';

// Mirrors sop_generator/src/sop_pipeline/pipeline.py's `_slugify`: lowercase, drop
// everything outside [a-z0-9 -], then turn each remaining space into a '-' (no
// run-collapsing) — so the Table of Contents anchors resolve to the same ids.
const NON_SLUG_RE = /[^a-z0-9 -]/g;

function slugify(headingText: string): string {
  return headingText.toLowerCase().replace(NON_SLUG_RE, '').replace(/ /g, '-');
}

function textContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return textContent((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}

function heading(variant: 'h4' | 'h5' | 'h6') {
  return function Heading({ children }: { children?: React.ReactNode }) {
    const id = slugify(textContent(children));
    return (
      <Typography
        id={id}
        variant={variant}
        sx={{ mt: 3, mb: 1, scrollMarginTop: 16 }}
      >
        {children}
      </Typography>
    );
  };
}

function MermaidBlock({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, source);
        if (!cancelled) setSvg(rendered);
      } catch {
        if (!cancelled) setError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) return null;

  return (
    <Box
      ref={containerRef}
      sx={{ my: 2, display: 'flex', justifyContent: 'center' }}
      // mermaid's own SVG output, rendered with securityLevel: 'strict'
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

export const mdComponents: Components = {
  h1: heading('h4'),
  h2: heading('h4'),
  h3: heading('h5'),
  h4: heading('h6'),
  h5: heading('h6'),
  h6: heading('h6'),
  p: ({ children }) => (
    <Typography variant="body1" sx={{ color: 'text.primary', mb: 1.5 }}>
      {children}
    </Typography>
  ),
  a: ({ children, href }) => (
    <Link href={href} sx={{ color: 'info.main' }}>
      {children}
    </Link>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ pl: 3, mb: 1.5, color: 'text.primary' }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ pl: 3, mb: 1.5, color: 'text.primary' }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
      {children}
    </Typography>
  ),
  hr: () => <Divider sx={{ my: 2 }} />,
  table: ({ children }) => (
    <TableContainer sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Table size="small">{children}</Table>
    </TableContainer>
  ),
  thead: ({ children }) => <TableHead>{children}</TableHead>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => (
    <TableCell sx={{ fontWeight: 700, borderColor: 'divider' }}>{children}</TableCell>
  ),
  td: ({ children }) => <TableCell sx={{ borderColor: 'divider' }}>{children}</TableCell>,
  img: () => null,
  // The `code` renderer below already emits its own <pre>/<Box> wrapper for block
  // code, so the default <pre> element react-markdown would wrap it in is skipped.
  pre: ({ children }) => <>{children}</>,
  code: (props) => {
    const { className, children } = props as {
      className?: string;
      children?: React.ReactNode;
      inline?: boolean;
    };
    const isInline = !className;
    if (!isInline && className === 'language-mermaid') {
      return <MermaidBlock source={textContent(children)} />;
    }
    if (isInline) {
      return (
        <Typography
          component="code"
          sx={{
            fontFamily: 'monospace',
            fontSize: 13,
            bgcolor: 'action.hover',
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
          }}
        >
          {children}
        </Typography>
      );
    }
    return (
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          borderRadius: 1,
          bgcolor: 'action.hover',
          border: 1,
          borderColor: 'divider',
          overflowX: 'auto',
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        <code className={className}>{children}</code>
      </Box>
    );
  },
};
