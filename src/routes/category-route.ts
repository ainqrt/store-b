import { Hono } from "hono"
import { requireAuth } from "../lib/middleware/require-auth"
import { getDB } from "../db/client";
import { category, store } from "../db/schema";
import { eq } from "drizzle-orm";

const categoryApi = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string; } }>()

categoryApi.get('/:slug', requireAuth, async (c) => {
    try {
        const { slug } = c.req.param();
        const db = getDB(c.env.DB);

        // 1. Validate store
        const existingStore = await db
            .select()
            .from(store)
            .where(eq(store.slug, slug));

        if (existingStore.length === 0) {
            return c.json({ error: "Store not found" }, 404);
        }

        const storeId = existingStore[0].id;

        const categories = await db
        .select()
        .from(category)
        .where(eq(category.storeId, storeId));

        return c.json({categories})
    } catch (error) {
        console.error(error);
        return c.json({ error: "Internal server error" }, 500);
    }
});


categoryApi.post('/:slug', requireAuth, async (c) => {
    try {
        const { slug } = c.req.param();
        const db = getDB(c.env.DB);

        // 1. Validate store
        const existingStore = await db
            .select()
            .from(store)
            .where(eq(store.slug, slug));

        if (existingStore.length === 0) {
            return c.json({ error: "Store not found" }, 404);
        }

        const storeId = existingStore[0].id;
        const {name} = await c.req.json();

        const result = await db
        .insert(category)
        .values({
            name,
            storeId
        })
        .run();

        if(result.meta.changes === 0) return c.json({error:"Failed to add category"}, 401);

        return c.json({success:true},201);

    } catch (error) {
        console.error(error);
        return c.json({ error: "Internal server error" }, 500);
    }
})

// PUT update all categories (bulk save)
categoryApi.put('/:slug', requireAuth, async (c) => {
  try {
    const { slug } = c.req.param();
    const body = await c.req.json();
    const db = getDB(c.env.DB);

    const existingStore = await db
      .select({
        id:store.id
      })
      .from(store)
      .where(eq(store.slug, slug));

    if (existingStore.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    const storeId = existingStore[0].id;

    // Bulk update (loop categories)
    for (const cat of body.categories) {
      await db
        .update(category)
        .set({
          name: cat.name,
          order: cat.order,
          imageUrl: cat.imageUrl,
        })
        .where(eq(category.id, cat.id));
    }

    return c.json({ success: true });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE category
categoryApi.delete('/:id', requireAuth, async (c) => {
  try {
    const { id } = c.req.param();
    const db = getDB(c.env.DB);

    await db.delete(category).where(eq(category.id, Number(id)));

    return c.json({ success: true });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
export default categoryApi