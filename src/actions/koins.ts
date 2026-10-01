"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { grantKoinStartingBalance } from "@/lib/koins";

const id = z.number().int().positive();

/**
 * Sells one item to one member. Everything below happens in a single transaction (see `run`), so a
 * failure partway through — stock gone, balance short, anything — leaves nothing changed: the Koin
 * deduction and the stock deduction always happen together or not at all.
 *
 * `select ... for update` on both the student and the product rows serialises two execs trying to
 * sell the same person (or the same last unit) at the same instant, so the balance/stock checks
 * below are always reading the true, up-to-the-moment numbers, not a stale snapshot.
 */
export async function purchaseKoinItem(input: { studentId: number; productId: number }): Promise<ActionResult<{ balance: number }>> {
  return run("store", async (ctx) => {
    const v = parse(z.object({ studentId: id, productId: id }), input);

    const [event] = await ctx.sql<{ phase: string }>`select phase from events where id = 1`;
    if (event.phase !== "after_school") throw new UserError("The storefront only runs during Phase 2 (After School).");

    const [student] = await ctx.sql<{ id: number; name: string }>`select id, name from students where id = ${v.studentId} for update`;
    if (!student) throw new UserError("That student no longer exists.");
    // Covers a member added to the roster after the Phase 2 bulk grant already ran.
    await grantKoinStartingBalance(ctx.sql, v.studentId);

    const [product] = await ctx.sql<{ name: string; price: number; stock: number }>`
      select name, price, stock from koin_products where id = ${v.productId} for update`;
    if (!product) throw new UserError("That item no longer exists.");
    if (product.stock <= 0) throw new UserError("Item sold out.");

    const [{ balance }] = await ctx.sql<{ balance: number }>`
      select coalesce(sum(delta), 0)::int as balance from koin_transactions where student_id = ${v.studentId} and revoked_at is null`;
    if (balance < product.price) throw new UserError("Not enough Kaco Koins.");

    const stockRows = await ctx.sql<{ stock: number }>`
      update koin_products set stock = stock - 1 where id = ${v.productId} and stock > 0 returning stock`;
    if (!stockRows.length) throw new UserError("Item sold out.");

    await ctx.sql`
      insert into koin_transactions (student_id, delta, description, kind, product_id, created_by)
      values (${v.studentId}, ${-product.price}, ${product.name}, 'purchase', ${v.productId}, ${ctx.actor.id})`;

    const newBalance = balance - product.price;
    await audit(ctx, "koins.purchase", `${student.name} bought ${product.name} for ${product.price} Koins (balance now ${newBalance})`, {
      entity: "student", entityId: v.studentId,
    });
    return { message: `${student.name} bought ${product.name}. Balance: ${newBalance} Koins.`, data: { balance: newBalance } };
  });
}

/** Changes what an item costs. Doesn't touch stock or anything already bought — past purchases keep
 * the price they were actually sold at, snapshotted onto their own koin_transactions row. */
export async function updateKoinProductPrice(input: { id: number; price: number }): Promise<ActionResult> {
  return run("store", async (ctx) => {
    const v = parse(z.object({ id, price: z.number().int().min(1, "Price must be at least 1 Koin").max(999) }), input);
    const rows = await ctx.sql<{ name: string }>`update koin_products set price = ${v.price} where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("That item no longer exists.");
    await audit(ctx, "koins.price", `${rows[0].name} price changed to ${v.price} Koins`, { entity: "koin_product", entityId: v.id });
    return { message: `${rows[0].name} is now ${v.price} Koins.` };
  });
}
