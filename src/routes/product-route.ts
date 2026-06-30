import { Hono } from "hono";
import { requireAuth } from "../lib/middleware/require-auth";
import { getDB } from "../db/client";
import { product, store, variant } from "../db/schema";
import { eq } from "drizzle-orm";

const productApi = new Hono<{ Bindings: { DB: D1Database; } }>();

productApi.post('/:slug', requireAuth, async (c) => {
    try {
        const { slug } = await c.req.param();
        const db = getDB(c.env.DB);

        // Check if store exists
        const existingStore = await db
            .select()
            .from(store)
            .where(eq(store.slug, slug));

        if (existingStore.length === 0) {
            return c.json({ error: "Store not found" }, 404);
        }

        const storeId = existingStore[0].id;

        // Request body
        const { name,
            description,
            price,
            salePrice,
            images,
            categories,
            variants,
            link,
            type,
            minOrder,
            stock,
            unit
        } = await c.req.json();

        // Insert product
        const insertedProduct = await db
            .insert(product)
            .values({
                name,
                description,
                price,
                salePrice,
                images,
                categories,
                storeId,
                link,
                type,
                minOrder,
                stock,
                unit
            })
            .returning({ id: product.id }); // get new product id

        const productId = insertedProduct[0].id;

        if (type === "variant") {
            const variantValues = variants.map((v: { type: string; value: string; price?: number }) => ({
                type: v.type,
                value: v.value,
                price: v.price ?? 0,
                productId,
            }));

            await db.insert(variant).values(variantValues);
        }

        return c.json({
            message: "Product created successfully",
            productId,
        });

    } catch (error) {
        console.error(error);
        return c.json({ error: "Internal server error" }, { status: 500 });
    }
});

// BULK ADD
productApi.post('/:slug/bulk', requireAuth, async (c) => {
  try {
    const { slug } = await c.req.param();
    const db = getDB(c.env.DB);

    // ✅ Check store exists
    const existingStore = await db
      .select()
      .from(store)
      .where(eq(store.slug, slug));

    if (existingStore.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    const storeId = existingStore[0].id;

    // ✅ Parse request body
    const body = await c.req.json();
    if (!Array.isArray(body)) {
      return c.json({ error: "Request body must be an array of products" }, 400);
    }

    // ✅ Prepare product values
    const productsToInsert = body.map((p: any) => ({
      name: p.name,
      price: p.price,
      images: p.images ?? [],
      categories: p.categories ?? [],
      description: p.description ?? "",
      salePrice: p.salePrice ?? 0,
      minOrder: p.minOrder ?? 1,
      stock: p.stock ?? -1,
      unit: p.unit ?? "",
      type: p.type ?? "simple",
      link: p.link ?? "",
      storeId,
    }));

    // ✅ Insert sequentially (no .batch)
    const insertedProducts: any[] = [];
    for (const data of productsToInsert) {
      const [result] = await db.insert(product).values(data).returning();
      insertedProducts.push(result);
    }

    return c.json({
      message: "Products created successfully",
      count: insertedProducts.length,
      products: insertedProducts,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});



// BULK UPDATE
productApi.put('/:slug/bulk', requireAuth, async (c) => {
  try {
    const { slug } = await c.req.param();
    const db = getDB(c.env.DB);

    // ✅ Check store exists
    const existingStore = await db
      .select()
      .from(store)
      .where(eq(store.slug, slug));

    if (existingStore.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    const storeId = existingStore[0].id;

    // ✅ Parse request body
    const body = await c.req.json();
    if (!Array.isArray(body)) {
      return c.json({ error: "Request body must be an array of products" }, 400);
    }

    const updatedProducts = [];
    for (const p of body) {
      if (!p.id) continue; // must have id for editing

      const updated = await db
        .update(product)
        .set({
          name: p.name,
          price: p.price,
          images: p.images ?? [],
          categories: p.categories ?? [],
          description: p.description ?? "",
          salePrice: p.salePrice ?? 0,
          minOrder: p.minOrder ?? 1,
          stock: p.stock ?? -1,
          unit: p.unit ?? "",
          type: p.type ?? "simple",
          link: p.link ?? "",
        })
        .where(eq(product.id, p.id))
        .returning();

      if (updated.length > 0) updatedProducts.push(updated[0]);
    }

    return c.json({
      message: "Products updated successfully",
      count: updatedProducts.length,
      products: updatedProducts,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});




productApi.get('/:slug', requireAuth, async (c) => {
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

        const storeId = existingStore[0].id;

        const products = await db
            .select()
            .from(product)
            .where(eq(product.storeId, storeId));

        return c.json({ products }, 201)
    } catch (error) {
        console.error(error);
        return c.json({ error: "Internal server error" }, { status: 500 });
    }
});

productApi.get('/productId/:id', async (c) => {
    try {
        const { id } = c.req.param();
        const db = getDB(c.env.DB);

        // Check if product exists
        const existingProduct = await db
            .select()
            .from(product)
            .where(eq(product.id, Number(id)));

        if (existingProduct.length === 0) {
            return c.json({ error: "Product not found" }, 404);
        }

        const products = existingProduct[0];

        // Get variants for this product
        const variants = await db
            .select()
            .from(variant)
            .where(eq(variant.productId, products.id));

        return c.json({
            ...products,
            variants: variants ?? []
        }, 201);

    } catch (error) {
        console.error(error);
        return c.json({ error: "Internal server error" }, { status: 500 });
    }
});


// PUT /api/product/productId/:id
productApi.put('/productId/:id', requireAuth, async (c) => {
    try {
        const { id } = c.req.param();
        const db = getDB(c.env.DB);

        // Check if product exists
        const existingProduct = await db
            .select()
            .from(product)
            .where(eq(product.id, Number(id)));

        if (!existingProduct.length) {
            return c.json({ error: "Product not found" }, 404);
        }

        // Request body
        const { name,
            description,
            price,
            salePrice,
            images,
            categories,
            variants,
            type,
            link,
            minOrder,
            stock,
            unit } = await c.req.json();

        // Update product
        await db
            .update(product)
            .set({
                name,
                description,
                price,
                salePrice,
                images,
                categories,
                type,
                link,
                minOrder,
                stock,
                unit
            })
            .where(eq(product.id, Number(id)));

        // Handle variants only if product type is "variant"
        if (type === "variant" && Array.isArray(variants)) {
            // Delete old variants
            await db.delete(variant).where(eq(variant.productId, Number(id)));

            // Insert new variants
            await db.insert(variant).values(
                variants.map((v: { type: string; value: string; price?: number }) => ({
                    type: v.type,
                    value: v.value,
                    price: v.price ?? 0,
                    productId: Number(id),
                }))
            );
        }

        return c.json({
            message: "Product updated successfully",
            productId: Number(id),
        });

    } catch (error) {
        console.error(error);
        return c.json({ error: "Internal server error" }, { status: 500 });
    }
});


// DELETE /api/product/productId/:id
productApi.delete('/productId/:id', requireAuth, async (c) => {
    try {
        const { id } = await c.req.param();
        const db = getDB(c.env.DB);

        // Check if product exists
        const existingProduct = await db
            .select()
            .from(product)
            .where(eq(product.id, Number(id)));

        if (existingProduct.length === 0) {
            return c.json({ error: "Product not found" }, 404);
        }

        // Delete variants first
        await db.delete(variant).where(eq(variant.productId, Number(id)));

        // Delete product
        await db.delete(product).where(eq(product.id, Number(id)));

        return c.json({
            message: "Product and its variants deleted successfully",
            productId: Number(id),
        });

    } catch (error) {
        console.error(error);
        return c.json({ error: "Internal server error" }, { status: 500 });
    }
});

export default productApi