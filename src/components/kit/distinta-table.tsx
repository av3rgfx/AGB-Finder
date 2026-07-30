import { CopyCodeButton } from "@/components/product/copy-code-button";
import { ListinoButton } from "@/components/listino/listino-button";
import { formatPrice } from "@/lib/format";

export interface DistintaComponent {
  id: string;
  componentCode: string;
  componentName: string;
  position: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  ruleDescription: string | null;
  listinoPage: number | null;
}

/**
 * Le sole RIGHE della distinta. I totali stanno nel riepilogo sotto
 * (`RiepilogoSconto`) e non qui: questa tabella scorre in orizzontale a 375px,
 * e un piè di tabella dentro l'area a scorrimento e` un numero che sul telefono
 * non si vede — mentre e` il numero per cui si apre la pagina.
 */
export function DistintaTable({
  components,
  warnings = [],
}: {
  components: DistintaComponent[];
  warnings?: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {warnings.length > 0 && (
        <div
          role="alert"
          className="rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink"
        >
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-sunken text-left text-xs font-semibold uppercase text-ink-subtle">
              <th className="px-4 py-2.5">Posizione</th>
              <th className="px-4 py-2.5">Codice</th>
              <th className="px-4 py-2.5">Componente</th>
              <th className="px-4 py-2.5 text-right">Qtà</th>
              <th className="px-4 py-2.5 text-right">Prezzo</th>
              <th className="px-4 py-2.5 text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id} className="border-t border-line hover:bg-surface-sunken/50">
                <td className="px-4 py-2 text-ink-subtle">{component.position}</td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <CopyCodeButton code={component.componentCode} />
                    <ListinoButton code={component.componentCode} page={component.listinoPage} />
                  </span>
                </td>
                <td className="px-4 py-2 text-ink" title={component.ruleDescription ?? undefined}>
                  {component.componentName}
                </td>
                <td className="px-4 py-2 text-right font-medium text-ink">{component.quantity}</td>
                <td className="px-4 py-2 text-right text-ink">
                  {formatPrice(component.unitPrice)}
                </td>
                <td className="px-4 py-2 text-right font-medium text-ink">
                  {formatPrice(component.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
