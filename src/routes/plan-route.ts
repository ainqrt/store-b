import { Hono } from "hono";
import { getDB } from "../db/client";
import { plans } from "../db/schema";
import { eq } from "drizzle-orm";

const planApi = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();



planApi.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, price, originalPrice, type, features, cta, popular } = body;

    if (!name || !price || !description) {
      return c.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDB(c.env.DB);

    const [createdPlan] = await db
      .insert(plans)
      .values({
        name,
        description,
        price,
        originalPrice,
        type,
        features: JSON.stringify(features ?? []),
        cta,
        popular: !!popular,
      })
      .returning();

    return c.json({ success: true, plan: createdPlan });
  } catch (err) {
    console.error(err);
    return c.json({ error: "Internal Server Error" }, { status: 500 });
  }
});



planApi.get("/", async (c) => {
  try {
    const db = getDB(c.env.DB);

    const allPlans = await db.select().from(plans).all();

    // Parse features back to array
    const formattedPlans = allPlans.map((plan) => ({
      ...plan,
      features: plan.features ? JSON.parse(plan.features) : [],
    }));

    return c.json({ success: true, plans: formattedPlans });
  } catch (err) {
    console.error(err);
    return c.json({ error: "Internal Server Error" }, { status: 500 });
  }
});


planApi.put("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();

    if (!id) {
      return c.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    const db = getDB(c.env.DB);

    // Check if plan exists
    const existing = await db.select().from(plans).where(eq(plans.id, id)).get();

    if (!existing) {
      return c.json({ error: "Plan not found" }, { status: 404 });
    }

    const updatedValues = {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      price: body.price ?? existing.price,
      originalPrice: body.originalPrice ?? existing.originalPrice,
      type: body.type ?? existing.type,
      features: body.features ? JSON.stringify(body.features) : existing.features,
      cta: body.cta ?? existing.cta,
      popular:
        typeof body.popular === "boolean"
          ? body.popular
          : Boolean(existing.popular),
    };

    const [updatedPlan] = await db
      .update(plans)
      .set(updatedValues)
      .where(eq(plans.id, id))
      .returning();

    return c.json({ success: true, plan: updatedPlan });
  } catch (err) {
    console.error(err);
    return c.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
export default planApi