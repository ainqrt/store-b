import { Hono } from "hono";
import { requireAuth } from "../lib/middleware/require-auth";
import { getDB } from "../db/client";
import { category, product, store, user, variant } from '../db/schema'
import { eq, inArray } from "drizzle-orm";

const storeApi = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string; CF_PROJECT_NAME: string; CF_ACCOUNT_ID: string; CF_API_TOKEN: string; UPLOADTHING_SECRET: string; VERCEL_TOKEN: string; } }>();

storeApi.get('/get-all', requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const db = getDB(c.env.DB);
    const userData = await db
      .select({
        id:user.id
      })
      .from(user)
      .where(eq(user.email, authUser.email))
      .get();

    if (!userData) return c.json({ error: "Unauthorized" });

    const stores = await db.select({
      id: store.id,
      name: store.name,
      slug: store.slug
    })
      .from(store)
      .where(eq(store.owner, userData.id));

    return c.json({ stores }, 201)

  } catch (error) {
    console.error(error);
    c.json({ error: "Internal server error" }, { status: 500 });
  }
});


storeApi.post('/create-one', requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const db = getDB(c.env.DB);

    const userData = await db
      .select({
        id: user.id
      })
      .from(user)
      .where(eq(user.email, authUser.email))
      .get();

    if (!userData) return c.json({ error: "Unauthorized" });

    const { name, slug } = await c.req.json();

    const existingStore = await db
      .select({
        slug: store.slug
      })
      .from(store)
      .where(eq(store.slug, slug));

    if (existingStore.length > 0) {
      return c.json({ error: "Slug already taken" }, 409);
    }

    const expiryDate = Date.now() + 3 * 24 * 60 * 60 * 1000; 
    
    const newStore = await db
      .insert(store)
      .values({
        name: name,
        slug: slug,
        owner: userData.id,
        membershipType:"trial",
        expiryDate:expiryDate
      })
      .returning({ id: store.id }) // get the store.id
      .get();
      

    return c.json({ store: newStore }, 201);

  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});


storeApi.get('/check-slug/:slug', async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDB(c.env.DB);

    // Fetch store by slug
    const existingStore = await db
      .select()
      .from(store)
      .where(eq(store.slug, slug));

    if (existingStore.length === 0) {
      return c.json({ exists: false }, 200);
    }

    const storeData = existingStore[0];
    

    // Build response matching StoreType
    const response = {
      id: storeData.id,
      name: storeData.name,
      slug: storeData.slug,
      owner: storeData.owner ?? undefined,
      domain: storeData.domain ?? undefined,
      logo: storeData.logo ?? undefined,
      description: storeData.description ?? undefined,
      favicon: storeData.favicon ?? undefined,
      
      whatsAppOrderEnabled: storeData.whatsAppOrderEnabled ?? undefined,
      whatsAppNumber: storeData.whatsAppNumber ?? undefined,
      settings: storeData.settings ?? undefined,
      membershipType:storeData.membershipType,
      expiryDate:storeData.expiryDate
    };

    return c.json({ exists: true, store: response }, 200);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});



// GET /api/store/get-store-data/:slug
storeApi.get('/get-store-data/:slug', requireAuth, async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDB(c.env.DB);

    // Check if store exists
    const existingStore = await db
      .select()
      .from(store)
      .where(eq(store.slug, slug));

    if (existingStore.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    // Return store details only
    return c.json(existingStore[0]);

  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PUT /api/store/update-any/:slug
storeApi.put('/update-any/:slug', requireAuth, async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDB(c.env.DB);

    // Check if store exists
    const existingStore = await db
      .select({
        slug: store.slug
      })
      .from(store)
      .where(eq(store.slug, slug));

    if (existingStore.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    // Request body contains fields to update
    const storeData = await c.req.json();

    // Update store (only fields provided in storeData)
    await db
      .update(store)
      .set(storeData)
      .where(eq(store.slug, slug));

    return c.json({
      message: "Store updated successfully",
      slug
    });

  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

storeApi.get('/:slug/get-data', requireAuth, async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDB(c.env.DB);

    const url = new URL(c.req.url);
    const fieldsParam = url.searchParams.get("fields");

    let selectedFields: (keyof typeof store._.columns)[] = [];

    if (fieldsParam) {
      selectedFields = fieldsParam
        .split(",")
        .map((f) => f.trim()) as (keyof typeof store._.columns)[];
    }

    let result;

    if (selectedFields.length > 0) {
      // ✅ Convert array into object for drizzle
      const selectObj = Object.fromEntries(
        selectedFields.map((f) => [f, store[f]])
      );

      result = await db
        .select(selectObj)
        .from(store)
        .where(eq(store.slug, slug));
    } else {
      result = await db
        .select()
        .from(store)
        .where(eq(store.slug, slug));
    }

    if (result.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    return c.json({ store: result[0] });

  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});


storeApi.get('/public-data/:slug', async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDB(c.env.DB);

    // Find store by slug
    const existingStore = await db
      .select({
        slug:store.slug,
        id:store.id,
        banner:store.banner
      })
      .from(store)
      .where(eq(store.slug, slug));

    if (existingStore.length === 0) {
      return c.json(
        { error: "Store not found", store: false },
        404
      );
    }

    const currentStore = existingStore[0];

    // Fetch products for this store
    const products = await db
      .select({
        id: product.id,
        name: product.name,
        price: product.price,
        salePrice: product.salePrice,
        images: product.images,
        type: product.type,
        minOrder: product.minOrder,
        stock: product.stock,
        link: product.link,
        categories: product.categories,
      })
      .from(product)
      .where(eq(product.storeId, currentStore.id));

    // Collect product IDs

    // Fetch categories for this store
    const categories = await db
      .select({
        id: category.id,
        name: category.name,
        order:category.order,
        imageUrl:category.imageUrl
      })
      .from(category)
      .where(eq(category.storeId, currentStore.id));

    return c.json(
      {
        success: true,
        store: currentStore,
        products: products,
        categories,
      },
      200
    );
  } catch (error) {
    console.error("Error fetching store:", error);
    return c.json(
      { error: "Internal Server Error" },
      500
    );
  }
});



// CUSTOM DOMAIN


// Add custom domain (Phase 1)

// Add / update domain
storeApi.put('/:slug/domain', async (c) => {
  const { slug } = c.req.param();
  const { domain } = await c.req.json<{ domain: string }>();
  const db = getDB(c.env.DB);

  if (!domain) return c.json({ error: 'Domain is required' }, 400);

  // Check if domain exists in another store
  const existing = await db.select({
    domain: store.domain,
    slug: store.slug
  }).from(store).where(eq(store.domain, domain));
  if (existing.length > 0 && existing[0].slug !== slug) {
    return c.json({ error: 'Domain is already taken by another store' }, 400);
  }

  // Save domain in DB
  await db.update(store).set({ domain }).where(eq(store.slug, slug));

  // Add domain to Vercel
  const res = await fetch(`https://api.vercel.com/v10/projects/prj_lTMk1kSdxCKAxAp6Bhu2ucZrr0P4/domains`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer 3ayUS9paQJqyFmSv0o7e22ba`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  });

  const data: any = await res.json();
  if (!res.ok) return c.json({ error: data.error || data }, 500);

  // Return Vercel DNS instructions if any
  const dnsInstructions = data.verification?.map((v: any) => ({
    type: v.type,
    domain: v.domain,
    value: v.value,
  }));

  return c.json({ success: true, domain, dnsInstructions });
});

// Verify domain
storeApi.get('/:slug/domain/verify', async (c) => {
  const { slug } = c.req.param();
  const db = getDB(c.env.DB);

  const result = await db.select({
    domain: store.domain,
    slug: store.slug
  }).from(store).where(eq(store.slug, slug));
  if (!result[0]?.domain) return c.json({ error: 'No domain configured' }, 400);

  const domain = result[0].domain;

  const res = await fetch(`https://api.vercel.com/v9/projects/prj_lTMk1kSdxCKAxAp6Bhu2ucZrr0P4/domains/${domain}/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer 3ayUS9paQJqyFmSv0o7e22ba`,
    },
  });

  const data: any = await res.json();
  return c.json({ success: true, verified: data.verified });
});

// Check domain
storeApi.get('/domain/:hostname', async (c) => {
  try {
    const { hostname } = c.req.param();
    const db = getDB(c.env.DB);

    // Fetch store by slug
    const existingStore = await db
      .select({
        slug: store.slug,
        domain: store.domain
      })
      .from(store)
      .where(eq(store.domain, hostname));

    if (existingStore.length === 0) {
      return c.json({ exists: false }, 401);
    }

    const storeData = existingStore[0];
    const refinedStoreData = {
      slug: storeData.slug,
      domain: storeData.domain
    }

    return c.json({ exists: true, store: refinedStoreData }, 200);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});





export default storeApi