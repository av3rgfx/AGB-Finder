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

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Il modello può generare un link con qualunque schema, incluso `javascript:` —
 * cliccabile darebbe esecuzione di codice arbitrario nel contesto dell'app. Si
 * risolve contro una base fittizia (per accettare anche URL relativi, che ereditano
 * lo schema http/https della base) e si permette solo lo schema esplicitamente in
 * whitelist. `new URL(...)` lancia su input non parsabile: qualunque eccezione è
 * trattata come URL non sicuro, mai propagata (il rendering non deve mai esplodere).
 *
 * La normalizzazione è quella dello standard URL, quindi copre da sola i trucchi
 * classici di offuscamento dello schema (maiuscole, tab/newline/controlli iniettati
 * dentro `javascript:`): esportata apposta per poterla pinnare con test diretti —
 * vedi markdown-message.test.tsx, dove è fissato anche il comportamento voluto sugli
 * URL protocol-relative (`//host` → eredita https dalla base, quindi ammesso).
 */
export function sanitizeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, "https://placeholder.invalid");
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? href : undefined;
  } catch {
    return undefined;
  }
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
          a: ({ children, href }) => {
            const safeHref = sanitizeHref(href);
            // Schema non sicuro (es. javascript:): niente <a>, solo il testo — evita un
            // link cliccabile che eseguirebbe codice invece di navigare.
            if (!safeHref) return <>{children}</>;
            return (
              <a href={safeHref} className="text-info underline">
                {children}
              </a>
            );
          },
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
