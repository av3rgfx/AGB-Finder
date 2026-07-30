import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ArtechGeometry, Entrata } from "@prisma/client";
import { agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import { scontoPercentSchema } from "@/server/pricing/discount";

/**
 * Anagrafica cliente **minima**: ragione sociale, sconto e profilo serramento —
 * ciò che serve alla scontistica e a non far ri-scegliere a memoria la geometria
 * a ogni richiesta. Gli altri campi del modello (P.IVA, indirizzo, referente,
 * `priceList`, `paymentTerms`) restano a schema e inutilizzati: non si finge di
 * gestirli finché nessuno li chiede.
 *
 * L'anagrafica è CONDIVISA fra gli agenti — `Customer` non ha un proprietario e
 * non glielo si aggiunge: i clienti sono dell'azienda.
 */

/** Ragione sociale: obbligatoria e non fatta di soli spazi. */
const companyNameSchema = z
  .string()
  .trim()
  .min(1, "La ragione sociale è obbligatoria.")
  .max(200, "La ragione sociale non può superare 200 caratteri.");

/**
 * Profilo serramento: enum di Prisma e non `z.string()`. Una geometria inventata
 * va rifiutata al confine — a DB la colonna è un enum e l'insert fallirebbe
 * comunque, ma con un errore di Postgres invece che con un messaggio.
 */
const kitGeometrySchema = z.nativeEnum(ArtechGeometry);
const kitEntrataSchema = z.nativeEnum(Entrata);

/** Prisma restituisce `Decimal`: al client arriva un numero, o niente. */
function toDto(row: {
  id: string;
  companyName: string;
  discount: unknown;
  kitGeometry: ArtechGeometry | null;
  kitEntrata: Entrata | null;
}) {
  return {
    id: row.id,
    companyName: row.companyName,
    discount: row.discount === null || row.discount === undefined ? null : Number(row.discount),
    kitGeometry: row.kitGeometry,
    kitEntrata: row.kitEntrata,
  };
}

const SELECT = {
  id: true,
  companyName: true,
  discount: true,
  kitGeometry: true,
  kitEntrata: true,
} as const;

export const customerRouter = createTRPCRouter({
  list: agentProcedure
    .input(z.object({ search: z.string().trim().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.customer.findMany({
        where: input.search ? { companyName: { contains: input.search, mode: "insensitive" } } : {},
        orderBy: { companyName: "asc" },
        take: 50,
        select: SELECT,
      });
      return rows.map(toDto);
    }),

  create: agentProcedure
    .input(
      z.object({
        companyName: companyNameSchema,
        discount: scontoPercentSchema.optional(),
        kitGeometry: kitGeometrySchema.optional(),
        kitEntrata: kitEntrataSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.customer.create({
        data: {
          companyName: input.companyName,
          discount: input.discount ?? null,
          kitGeometry: input.kitGeometry ?? null,
          kitEntrata: input.kitEntrata ?? null,
        },
        select: SELECT,
      });
      return toDto(row);
    }),

  update: agentProcedure
    .input(
      z.object({
        id: z.string().min(1),
        companyName: companyNameSchema.optional(),
        // `nullable` e non solo `optional`: azzerare lo sconto di un cliente
        // deve essere possibile, ed è diverso dal non toccarlo. Idem per il
        // profilo: un cliente che cambia linea di serramento deve poterlo
        // svuotare, e «svuotato» non è «non specificato».
        discount: scontoPercentSchema.nullable().optional(),
        kitGeometry: kitGeometrySchema.nullable().optional(),
        kitEntrata: kitEntrataSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.customer.update({
        where: { id: input.id },
        data: {
          ...(input.companyName === undefined ? {} : { companyName: input.companyName }),
          ...(input.discount === undefined ? {} : { discount: input.discount }),
          ...(input.kitGeometry === undefined ? {} : { kitGeometry: input.kitGeometry }),
          ...(input.kitEntrata === undefined ? {} : { kitEntrata: input.kitEntrata }),
        },
        select: SELECT,
      });
      return toDto(row);
    }),

  /**
   * Stesso paletto di `user.delete`: un cliente con richieste collegate non si
   * elimina, perché le distinte già emesse perderebbero l'intestatario. Il
   * vincolo sta QUI e non nella UI — un pulsante nascosto non è una regola.
   */
  delete: agentProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const richieste = await ctx.db.kitRequest.count({ where: { customerId: input.id } });
      if (richieste > 0)
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cliente con ${richieste} richieste collegate: non si può eliminare.`,
        });
      await ctx.db.customer.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
