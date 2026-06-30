import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").unique().notNull(),
    password: text("password").notNull(),
    otp: text("otp"),
    createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now') * 1000)`),
});

export const store = sqliteTable("store", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    owner: integer("owner").notNull().references(() => user.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    domain: text("domain").unique(),
    banner: text("banner", { mode: "json" }).$type<string[]>().default([]),
    logo: text("logo"),
    favicon: text("favicon"),
    currency: text("currency", { enum: ["INR", "USD", "AED"] }).notNull().default("INR"),
    
    // whatsapp
    whatsAppOrderEnabled: integer("whatsapp_order_enabled", { mode: "boolean" })
        .notNull()
        .default(false),
    whatsAppNumber: text("whatsapp_number"),

    // Membership
    membershipType: text("type", { enum: ["trial", "basic", "lifetime"] }).default("trial"),
    createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now') * 1000)`),
    expiryDate: integer("expiry_date"),

    // Settings
    settings: text("settings", { mode: "json" })



});


export const category = sqliteTable("category", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name"),
    order: integer("order").notNull().default(0),
    imageUrl: text("image_url").notNull().default(""),
    storeId: integer("store_id").notNull().references(() => store.id, {onDelete:"cascade"})
});

export const product = sqliteTable("product", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    isAvilable:integer("is_avilable", {mode:"boolean"}).default(true),
    description: text("description"),
    images: text("images", { mode: "json" }).$type<{ url: string }[]>().default([]),
    price: integer("price").notNull().default(0),
    salePrice: integer("sale_price").default(0),
    categories: text("categories", { mode: "json" }).$type<{ id: number }[]>().default([]),
    // Relations
    storeId: integer("store_id").notNull().references(() => store.id, {onDelete:"cascade"}),

    type: text("type", { enum: ["simple", "variant", "affiliate"] }).notNull().default("simple"),
    minOrder: integer("min_order").notNull().default(1),
    unit: text("unit"),
    link: text("link"),
    stock: integer("stock").notNull().default(-1),
    createdAt: integer("created_at")
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
});

// Variant table
export const variant = sqliteTable("variant", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    value: text("value").notNull(),
    price: integer("price").notNull().default(0),
    productId: integer("product_id").notNull().references(() => product.id, {onDelete:"cascade"}),
});





export const platformData = sqliteTable("platform_data", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    paymentType: text("payment_type", { enum: ["whatsapp", "razorpay"] }).default("whatsapp"),
    whatsapp: text("whatsapp"),
    adminEmail: text("admin_email"),
    razorpayKeyId: text("razorpay_key_id"),
    razorpayKeySecret: text("razorpay_key_secret"),
});


export const plans = sqliteTable("plans", {
    id: integer("id").primaryKey({ autoIncrement: true }),

    name: text("name").notNull(),
    description: text("description").notNull(),

    price: integer("price").notNull().default(0),
    originalPrice: integer("original_price").default(0),

    type: text("type", {
        enum: ["monthly", "yearly", "lifetime"],
    }).notNull().default("monthly"),

    features: text("features"), // store as JSON stringified array
    cta: text("cta").default("Get Plan"),

    popular: integer("popular", { mode: "boolean" })
        .notNull()
        .default(false),

    createdAt: integer("created_at")
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
}); 