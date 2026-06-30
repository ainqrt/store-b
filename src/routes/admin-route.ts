// app/api/admin/stores/route.ts
import { Hono } from "hono";
import { eq, desc, count, gt, lt, and } from "drizzle-orm";
import { getDB } from "../db/client";
import { user, store, platformData, plans, category,  product, variant } from "../db/schema";
import { createRazorpayOrder, generateHmacSHA256 } from "../lib/utils/razorpay";

const adminStoresApi = new Hono<{ Bindings: { DB: D1Database } }>();

// GET - /api/admin/all-stores
adminStoresApi.get("/all-stores", async (c) => {
  try {
    const db = getDB(c.env.DB);

    const storesWithData = await db
      .select({
        id: store.id,
        slug: store.slug,
        name: store.name,
        owner: store.owner,
        createdAt: store.createdAt,
        user: {
          id: user.id,
          email: user.email,
        },
        membershipType:store.membershipType,
        expiryDate:store.expiryDate


      })
      .from(store)
      .leftJoin(user, eq(store.owner, user.id))
      .orderBy(desc(store.createdAt));

    return c.json(storesWithData);
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to fetch stores" }, 500);
  }
});


adminStoresApi.delete("/delete-store/:id", async (c) => {
  const storeId = parseInt(c.req.param("id"));
  const db = getDB(c.env.DB);

  try {
    // 1. Fetch products first to get IDs for variant deletion
    const storeProducts = await db
      .select({ id: product.id })
      .from(product)
      .where(eq(product.storeId, storeId));

    const productIds = storeProducts.map((p) => p.id);

    // 2. Explicitly type the array as any[] to bypass the Drizzle type mismatch
    const deletePromises: any[] = [
      db.delete(category).where(eq(category.storeId, storeId)),
    ];

    // Handle nested variants safely
    if (productIds.length > 0) {
      for (const id of productIds) {
        deletePromises.push(db.delete(variant).where(eq(variant.productId, id)));
      }
      deletePromises.push(db.delete(product).where(eq(product.storeId, storeId)));
    }

    // Finally, delete the store itself
    deletePromises.push(db.delete(store).where(eq(store.id, storeId)));

    // 3. Execute as a D1 Batch
    // We spread the array because .batch() expects separate arguments or a tuple
    await db.batch(deletePromises as [any, ...any[]]);

    return c.json({ success: true, message: "Store and all associated data purged successfully." });
  } catch (error: any) {
    console.error("D1 Batch Delete Error:", error);
    return c.json({ error: "Failed to delete store", details: error.message }, 500);
  }
});

// PUT - /api/admin/stores/:storeId/membership
adminStoresApi.put("/stores/:storeId/membership", async (c) => {
  try {
    const storeId = Number(c.req.param("storeId"));
    const { membershipType, expiryDate } = await c.req.json();

    if (!storeId || !membershipType || !expiryDate) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const db = getDB(c.env.DB);

    // 1. Perform the update directly
    const result = await db
      .update(store)
      .set({
        membershipType,
        expiryDate,
      })
      .where(eq(store.id, storeId));

    // 2. Check if any row was actually updated
    if (!result.meta.changes) {
      return c.json({ error: "Store not found" }, 404);
    }

    return c.json({ message: "Membership updated" });
  } catch (e) {
    console.error(e);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET - Platform Data
adminStoresApi.get("/platform-data", async (c) => {
  try {
    const db = getDB(c.env.DB);
    const result = await db.select().from(platformData).limit(1);

    return c.json(result[0] ?? {
      id: 0,
      paymentType: "whatsapp",
      whatsapp: "",
      adminEmail: "",
      razorpayKeyId: "",
      razorpayKeySecret: "",
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PUT - Platform Data
adminStoresApi.put("/platform-data", async (c) => {
  try {
    const updateData = await c.req.json();
    const db = getDB(c.env.DB);
    const existing = await db.select().from(platformData).limit(1);

    if (existing.length) {
      await db.update(platformData)
        .set(updateData)
        .where(eq(platformData.id, existing[0].id));
    } else {
      await db.insert(platformData).values(updateData);
    }

    return c.json({ message: "Platform data updated" });
  } catch (e) {
    console.error(e);
    return c.json({ error: "Failed to update platform data" }, 500);
  }
});

// Plans CRUD
adminStoresApi.get("/plans", async (c) => {
  const db = getDB(c.env.DB);
  const rows = await db.select().from(plans).orderBy(desc(plans.createdAt));
  return c.json(rows.map(p => ({
    ...p,
    features: p.features ? JSON.parse(p.features) : []
  })));
});

adminStoresApi.post("/plans", async (c) => {
  const { name, description, price, originalPrice, type, features, cta, popular } =
    await c.req.json();
  if (!name || !description || price === undefined)
    return c.json({ error: "Missing required fields" }, 400);

  const db = getDB(c.env.DB);
  await db.insert(plans).values({
    name,
    description,
    price,
    originalPrice: originalPrice || price,
    type: type || "monthly",
    features: JSON.stringify(features || []),
    cta: cta || "Get Plan",
    popular: popular ?? false,
  });

  return c.json({ message: "Plan created" }, 201);
});

adminStoresApi.put("/plans/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const db = getDB(c.env.DB);

  const exists = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  if (!exists.length) return c.json({ error: "Plan not found" }, 404);

  await db.update(plans).set({
    ...body,
    features: JSON.stringify(body.features || []),
  }).where(eq(plans.id, id));

  return c.json({ message: "Plan updated" });
});

adminStoresApi.delete("/plans/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = getDB(c.env.DB);

  const exists = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  if (!exists.length) return c.json({ error: "Plan not found" }, 404);

  await db.delete(plans).where(eq(plans.id, id));
  return c.json({ message: "Plan deleted" });
});

// Dashboard Stats
adminStoresApi.get("/stats", async (c) => {
  try {
    const db = getDB(c.env.DB);

    const totalUsers = (await db.select({ count: count() }).from(user))[0].count;
    const totalStores = (await db.select({ count: count() }).from(store))[0].count;
    

    return c.json({
      totalUsers,
      totalStores
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});







export default adminStoresApi;
