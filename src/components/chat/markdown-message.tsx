import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";
import { remarkAgbCode } from "./remark-agb-code";

/**
 * Nodo hast minimale: sufficiente per estrarre il testo grezzo di un blocco di codice
 * dal nodo `pre > code` passato come prop `node` (vedi `code` più sotto), senza dipendere
 * da `@types/hast` (non hoistata nel node_modules root sotto pnpm, stessa ragione di
 * `MdastNode` in remark-agb-code.ts).
 */
interface HastLikeNode {
  type: string;
  value?: string;
  children?: HastLikeNode[];
}

function extractText(node: HastLikeNode): string {
  if (node.type === "text" && typeof node.value === "string") return node.value;
  return (node.children ?? []).map(extractText).join("");
}

/**
 * Rende una risposta AI in markdown (liste, grassetto, link, tabelle GFM, code block)
 * con i codici prodotto AGB sempre in monospace, anche dentro il testo "prosa"
 * (vedi remark-agb-code.ts per il perché e il come).
 *
 * Streaming: il contenuto arriva a pezzi e può essere markdown sintatticamente
 * incompleto (una ``` non chiusa, una tabella a metà). `react-markdown` fa il parsing
 * con `micromark`, che è tollerante: markdown incompleto produce un albero parziale
 * ma valido (mai un'eccezione) — nessun guard aggiuntivo necessario, verificato con
 * i casi limite in markdown-message.test.tsx.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkAgbCode]}
        components={{
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} className="text-info underline">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-line-strong bg-surface-sunken px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-line-strong px-2 py-1">{children}</td>,
          // Un <pre> compare nell'albero SOLO per un blocco di codice (fenced o indentato):
          // uno span di codice inline (`…`) non è mai avvolto in <pre> — è un segnale
          // affidabile, a differenza di "className contiene language-" (assente se il
          // fence non specifica un linguaggio, es. ``` senza tag) o "il testo contiene
          // newline" (falso negativo per un fence di una riga sola senza linguaggio).
          // Estraiamo il testo grezzo direttamente dal nodo hast (non dai `children` già
          // renderizzati) così il componente `code` qui sotto gestisce solo lo stile
          // inline e non viene mai invocato per il caso "blocco" (che rendiamo qui).
          pre: ({ node }) => {
            const codeNode = node?.children.find((child) => child.type === "element" && child.tagName === "code");
            const text = extractText(codeNode ?? { type: "" }).replace(/\n$/, "");
            return <CodeBlock>{text}</CodeBlock>;
          },
          code: ({ children }) => (
            <code className="rounded bg-ink/[0.06] px-1 font-mono text-[0.92em]">{children}</code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
