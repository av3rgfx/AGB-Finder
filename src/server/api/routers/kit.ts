import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import { KitEngine } from "@/server/kit/engine";
import { KitGenerationError, kitInputSchema } from "@/server/kit/types";
import { kitInputFromRequest } from "@/server/kit/from-request";
import {
  applicaSconto,
  centToEuro,
  euroToCent,
  scontoPercentSchema,
} from "@/server/pricing/discount";
import { getDiscountThreshold } from "@/server/settings/discount-threshold";

function toTRPC(error: unknown): never {
  if (error instanceof KitGenerationError)
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  throw error;
}

export const kitRouter = createTRPCRouter({
  /**
   * L'input NON è `kitInputSchema` nudo: il cliente è un dato commerciale e non
   * deve entrare nell'input del motore. `kit.generate` ricostruisce l'input
   * rileggendo le colonne (`from-request.ts`), quindi ogni campo che finisce
   * nell'unione diventa qualcosa che qualcuno deve decidere se ricostruire.
   * Le specifiche stanno in `specs`, il commerciale fuori.
   */
  create: agentProcedure
    .input(z.object({ specs: kitInputSchema, customerId: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      // Lo sconto si TIMBRA alla creazione, non si rilegge dal cliente ogni volta:
      // se vivesse solo su `Customer`, ritoccarlo cambierebbe in silenzio il
      // totale di ogni distinta già mandata. Stessa ragione del ricalcolo
      // versionato.
      const cliente = input.customerId
        ? await ctx.db.customer.findUnique({
            where: { id: input.customerId },
            select: { id: true, discount: true },
          })
        : null;
      if (input.customerId && !cliente)
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente non trovato." });

      const year = new Date().getFullYear();
      const inYear = await ctx.db.kitRequest.count({
        where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
      });
      const requestNumber = `KIT-${year}-${String(inYear + 1).padStart(4, "0")}`;
      const { notes, ...specs } = input.specs;
      // Le colonne del ramo NON scelto restano NULL. Sono esplicitate una per una
      // invece di essere spalmate: la riga è l'input di ogni rigenerazione, e uno
      // spread di un'unione lascerebbe passare in silenzio i campi dell'altro ramo
      // il giorno in cui l'unione cambia.
      const branch =
        specs.series === "TOUR"
          ? { tourSchema: specs.tourSchema }
          : {
              geometry: specs.geometry,
              entrata: specs.entrata,
              seatConfig: specs.seatConfig,
              openingSide: specs.openingSide,
              openingDir: specs.openingDir,
              supplementaryClosures: specs.supplementaryClosures ?? false,
            };
      const request = await ctx.db.kitRequest.create({
        data: {
          windowType: specs.windowType,
          widthMm: specs.widthMm,
          heightMm: specs.heightMm,
          material: specs.material,
          finish: specs.finish,
          series: specs.series,
          sashWeightKg: specs.sashWeightKg ?? null,
          ...branch,
          customerId: cliente?.id ?? null,
          discountPercent: cliente?.discount ?? null,
          notes: notes ?? null,
          requestNumber,
          status: "DRAFT",
          agentId: ctx.session.user.id,
        },
      });
      await ctx.db.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          type: "KIT_REQUEST_CREATED",
          description: `Richiesta kit ${requestNumber}`,
          resourceType: "kit_request",
          resourceId: request.id,
        },
      });
      return { id: request.id, requestNumber };
    }),

  generate: agentProcedure
    .input(z.object({ kitRequestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.kitRequest.findFirst({
        where: { id: input.kitRequestId, agentId: ctx.session.user.id },
      });
      if (!request)
        throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });

      // GUARDIA DEL VERSIONAMENTO. `generate` cancella e riscrive
      // `kit_components` in loco, e dei componenti non esiste storico: su una
      // riga già emessa riscriverebbe in silenzio la distinta che il cliente ha
      // in mano, e su una riga superata corromperebbe lo storico che
      // `ricalcola` aveva congelato. Sono i due casi che il ricalcolo versionato
      // esiste per impedire, quindi la guardia sta QUI e non solo nella UI: una
      // scheda aperta in un'altra tab, il tasto Indietro o un secondo
      // dispositivo aggirano qualunque pulsante nascosto.
      // Rigenerare resta lecito solo su `DRAFT` — è ciò che fa il wizard subito
      // dopo `create`, ed è lo stato in cui `ricalcola` deposita ogni nuova
      // versione.
      if (request.supersededById)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Questa richiesta è già stata ricalcolata: aprire la versione più recente.",
        });
      if (request.status !== "DRAFT")
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Questa distinta è già stata emessa e non si riscrive: usare «Ricalcola» per " +
            "generarne una nuova versione.",
        });

      // La riga È l'input: si ricostruisce per ramo e si ri-valida, invece di
      // spalmare le colonne (vedi kit/from-request.ts).
      const engineInput = (() => {
        try {
          return kitInputFromRequest(request);
        } catch (error) {
          return toTRPC(error);
        }
      })();

      const engine = new KitEngine(ctx.db);
      const output = await engine.generate(engineInput).catch(toTRPC);

      const rows = output.lines
        .filter((line) => line.productId !== null)
        .map((line, index) => ({
          kitRequestId: request.id,
          productId: line.productId!,
          componentCode: line.code,
          componentName: line.name ?? line.code,
          position: line.position,
          quantity: line.quantity,
          unitPrice: line.unitPrice!,
          totalPrice: line.totalPrice!,
          ruleId: line.ruleId,
          ruleDescription: line.ruleDescription,
          sortOrder: index,
        }));

      await ctx.db.$transaction([
        ctx.db.kitComponent.deleteMany({ where: { kitRequestId: request.id } }),
        ctx.db.kitComponent.createMany({ data: rows }),
        ctx.db.kitRequest.update({
          where: { id: request.id },
          data: {
            generatedKit: JSON.parse(JSON.stringify(output)),
            totalComponents: output.totalComponents,
            totalPrice: output.totalPrice,
            engineVersion: output.engineVersion,
            status: "COMPLETED",
            generatedAt: new Date(),
          },
        }),
      ]);
      await ctx.db.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          type: "KIT_GENERATED",
          description: `Kit generato per ${request.requestNumber} (${output.totalComponents} componenti)`,
          resourceType: "kit_request",
          resourceId: request.id,
        },
      });
      return output;
    }),

  /**
   * Ricalcolo versionato. Rigenerare riesegue il codice-regole *corrente* e
   * riscrive `kit_components`: su una richiesta `DRAFT` va benissimo (non è
   * ancora stata emessa a nessuno), ma su una richiesta già generata/inviata
   * cambierebbe sotto i piedi una distinta che il cliente ha già in mano.
   *
   * Sintesi: `DRAFT` → rigenera in loco (nessuna riga nuova, il chiamante fa
   * poi `kit.generate` sullo stesso id). Qualunque altro stato → **crea una
   * nuova versione** copiando tutto ciò che serve a rigenerare (vedi
   * `PersistedKitRequest` in `kit/from-request.ts`) e marca la vecchia riga
   * con `supersededById`, lasciandola intatta. Una riga già ricalcolata non
   * può esserlo di nuovo: si ricalcola sempre la versione più recente.
   */
  ricalcola: agentProcedure
    .input(z.object({ kitRequestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.kitRequest.findFirst({
        where: { id: input.kitRequestId, agentId: ctx.session.user.id },
      });
      if (!request)
        throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });

      if (request.status === "DRAFT")
        return { id: request.id, requestNumber: request.requestNumber };

      if (request.supersededById)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Questa richiesta è già stata ricalcolata: aprire la versione più recente.",
        });

      const year = new Date().getFullYear();
      const inYear = await ctx.db.kitRequest.count({
        where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
      });
      const requestNumber = `KIT-${year}-${String(inYear + 1).padStart(4, "0")}`;

      // Le due scritture (nuova riga + marcatura della vecchia) devono riuscire
      // o fallire insieme: senza transazione, un fallimento della seconda
      // lascerebbe una riga DRAFT orfana (non collegata dalla vecchia, mai
      // restituita al chiamante). `generate` sopra usa già `$transaction` per
      // lo stesso motivo — qui va nella forma a callback perché la seconda
      // scrittura dipende dall'id appena creato dalla prima.
      const nuova = await ctx.db.$transaction(async (tx) => {
        // Copia campo per campo (niente spread): la nuova riga è l'input della
        // sua prima generazione, e un campo dimenticato qui produrrebbe una
        // distinta diversa in silenzio quando il chiamante fa `kit.generate`.
        const creata = await tx.kitRequest.create({
          data: {
            windowType: request.windowType,
            widthMm: request.widthMm,
            heightMm: request.heightMm,
            material: request.material,
            finish: request.finish,
            series: request.series,
            sashWeightKg: request.sashWeightKg,
            geometry: request.geometry,
            entrata: request.entrata,
            seatConfig: request.seatConfig,
            openingSide: request.openingSide,
            openingDir: request.openingDir,
            supplementaryClosures: request.supplementaryClosures,
            tourSchema: request.tourSchema,
            notes: request.notes,
            customerId: request.customerId,
            // La nuova versione eredita lo sconto: ricalcolare la distinta non
            // è rinegoziare il prezzo.
            discountPercent: request.discountPercent,
            requestNumber,
            status: "DRAFT",
            agentId: ctx.session.user.id,
          },
        });

        // `updateMany` condizionato invece di `update`: il check fail-fast sopra
        // (`if (request.supersededById) throw …`) è un check-then-act — due
        // `ricalcola` concorrenti sulla stessa riga possono superarlo entrambi.
        // Condizionando la scrittura a `supersededById: null` la seconda
        // chiamata trova `count === 0` (la prima ha già marcato la riga) e fa
        // fallire l'intera transazione, scartando anche la riga appena creata:
        // nessun orfano.
        const marcate = await tx.kitRequest.updateMany({
          where: { id: request.id, supersededById: null },
          data: { supersededById: creata.id },
        });
        if (marcate.count === 0)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Questa richiesta è già stata ricalcolata: aprire la versione più recente.",
          });

        return creata;
      });

      await ctx.db.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          type: "KIT_REQUEST_CREATED",
          description: `Richiesta kit ${nuova.requestNumber} (nuova versione di ${request.requestNumber})`,
          resourceType: "kit_request",
          resourceId: nuova.id,
        },
      });

      return { id: nuova.id, requestNumber: nuova.requestNumber };
    }),

  /**
   * Cambia lo sconto applicato a una richiesta. **Ammessa in qualunque stato**,
   * a differenza di `generate`: non riscrive nessun componente e non tocca la
   * distinta, cambia una condizione commerciale — che si rinegozia anche dopo
   * aver mandato il preventivo. È il requisito da cui nasce la colonna.
   *
   * L'unico rifiuto è sulla riga **superata**: lì lo sconto va messo sulla
   * versione più recente, altrimenti si modifica una copia che nessuno guarda.
   */
  setDiscount: agentProcedure
    .input(z.object({ id: z.string().min(1), discountPercent: scontoPercentSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.kitRequest.findFirst({
        where: { id: input.id, agentId: ctx.session.user.id },
        select: { id: true, supersededById: true },
      });
      if (!request)
        throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });
      if (request.supersededById)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Questa richiesta è stata ricalcolata: applica lo sconto alla versione più recente.",
        });

      const updated = await ctx.db.kitRequest.update({
        where: { id: request.id },
        data: { discountPercent: input.discountPercent },
        select: { id: true, discountPercent: true },
      });
      return {
        id: updated.id,
        discountPercent: updated.discountPercent === null ? null : Number(updated.discountPercent),
      };
    }),

  get: agentProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const [request, soglia] = await Promise.all([
      ctx.db.kitRequest.findFirst({
        where: { id: input.id, agentId: ctx.session.user.id },
        include: {
          customer: { select: { id: true, companyName: true } },
          components: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: {
                select: {
                  id: true,
                  agbCode: true,
                  name: true,
                  isAvailable: true,
                  listinoPage: true,
                },
              },
            },
          },
        },
      }),
      getDiscountThreshold(ctx.db),
    ]);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });

    // Il netto è DERIVATO, mai salvato: due totali a DB divergono al primo bug.
    // `totalPrice` resta il lordo di listino, quindi nessuna riga storica si
    // muove. Vedi la spec §3.3.
    const lordo = request.totalPrice === null ? null : Number(request.totalPrice);
    const percent = request.discountPercent === null ? null : Number(request.discountPercent);
    const conto =
      lordo === null || percent === null ? null : applicaSconto(euroToCent(lordo), percent);

    return {
      ...request,
      totalPrice: lordo,
      discountPercent: percent,
      discountAmount: conto === null ? null : centToEuro(conto.scontoCent),
      netPrice: conto === null ? lordo : centToEuro(conto.nettoCent),
      soglia,
      components: request.components.map((component) => ({
        ...component,
        unitPrice: Number(component.unitPrice),
        totalPrice: Number(component.totalPrice),
      })),
    };
  }),

  list: agentProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .partial()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        ctx.db.kitRequest.findMany({
          where: { agentId: ctx.session.user.id },
          orderBy: { createdAt: "desc" },
          take: input.limit ?? 20,
          skip: input.offset ?? 0,
          select: {
            id: true,
            requestNumber: true,
            windowType: true,
            series: true,
            material: true,
            widthMm: true,
            heightMm: true,
            status: true,
            totalComponents: true,
            totalPrice: true,
            createdAt: true,
          },
        }),
        ctx.db.kitRequest.count({ where: { agentId: ctx.session.user.id } }),
      ]);
      return {
        items: items.map((item) => ({
          ...item,
          totalPrice: item.totalPrice === null ? null : Number(item.totalPrice),
        })),
        total,
      };
    }),
});
