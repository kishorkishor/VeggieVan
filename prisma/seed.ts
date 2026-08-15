import { PrismaClient, Category, Role, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PRODUCTS } from "../data/products";
import {
  EXPERIMENTS,
  assignVariant,
  type ExperimentKey,
} from "../lib/growth/experiments";

const prisma = new PrismaClient();

export const GROWTH_DEMO_ANCHOR = new Date("2026-07-19T00:00:00.000Z");

const DEMO_SESSION_COUNT = 480;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export type GrowthDemoRows = {
  sessions: Prisma.GrowthSessionCreateManyInput[];
  events: Prisma.GrowthEventCreateManyInput[];
  exposures: Prisma.ExperimentExposureCreateManyInput[];
};

const ACQUISITION = [
  {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    landingPath: "/products",
    referrerCategory: "direct",
  },
  {
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "summer_produce",
    landingPath: "/products/:slug",
    referrerCategory: "search",
  },
  {
    utmSource: "google",
    utmMedium: "organic",
    utmCampaign: null,
    landingPath: "/products/:slug",
    referrerCategory: "search",
  },
  {
    utmSource: "instagram",
    utmMedium: "paid_social",
    utmCampaign: "fresh_week",
    landingPath: "/products/:slug",
    referrerCategory: "social",
  },
] satisfies Array<Pick<
  Prisma.GrowthSessionCreateManyInput,
  "utmSource" | "utmMedium" | "utmCampaign" | "landingPath" | "referrerCategory"
>>;

const EXPERIMENT_ID_CODES: Record<ExperimentKey, string> = {
  checkout_reassurance_v1: "checkout",
  related_product_ranking_v1: "ranking",
};

function deterministicScore(index: number, salt: number) {
  return (index * 37 + salt * 17) % 100;
}

function offset(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds);
}

export function buildGrowthDemoRows(anchorDate: Date): GrowthDemoRows {
  const sessions: GrowthDemoRows["sessions"] = [];
  const events: GrowthDemoRows["events"] = [];
  const exposures: GrowthDemoRows["exposures"] = [];

  for (let index = 0; index < DEMO_SESSION_COUNT; index += 1) {
    const sequence = String(index + 1).padStart(4, "0");
    const sessionId = `growth_demo_session_${sequence}`;
    const firstSeenAt = offset(
      anchorDate,
      -((index % 25) * DAY) - ((index * 73) % (18 * 60)) * MINUTE,
    );
    const acquisition = ACQUISITION[index % ACQUISITION.length];
    const assignments = Object.fromEntries(
      (Object.keys(EXPERIMENTS) as ExperimentKey[]).map((experiment) => [
        experiment,
        assignVariant(sessionId, experiment),
      ]),
    ) as Record<ExperimentKey, "control" | "treatment">;

    const addedToCart = deterministicScore(index, 1) < (
      assignments.related_product_ranking_v1 === "treatment" ? 78 : 75
    );
    const startedCheckout = addedToCart && deterministicScore(index, 2) < 78;
    const completedCheckoutStep = startedCheckout && deterministicScore(index, 3) < 91;
    const completedOrder = completedCheckoutStep && deterministicScore(index, 4) < (
      assignments.checkout_reassurance_v1 === "treatment" ? 43 : 40
    );

    sessions.push({
      id: sessionId,
      firstSeenAt,
      lastSeenAt: offset(firstSeenAt, 30 * MINUTE),
      ...acquisition,
      demo: true,
    });

    const expose = (experiment: ExperimentKey, minute: number) => {
      exposures.push({
        id: `growth_demo_exposure_${EXPERIMENT_ID_CODES[experiment]}_${sequence}`,
        sessionId,
        experiment,
        version: EXPERIMENTS[experiment].version,
        variant: assignments[experiment],
        exposedAt: offset(firstSeenAt, minute * MINUTE),
        receivedAt: offset(firstSeenAt, minute * MINUTE),
        demo: true,
      });
    };

    const event = (
      code: string,
      name: string,
      minute: number,
      properties: Omit<Prisma.GrowthEventCreateManyInput, "id" | "sessionId" | "name" | "occurredAt" | "receivedAt" | "demo"> = {},
    ) => {
      events.push({
        id: `growth_demo_event_${code}_${sequence}`,
        sessionId,
        name,
        occurredAt: offset(firstSeenAt, minute * MINUTE),
        receivedAt: offset(firstSeenAt, minute * MINUTE),
        ...properties,
        demo: true,
      });
    };

    expose("related_product_ranking_v1", 1);
    event("view", "product_viewed", 2, {
      productId: `p${String((index % PRODUCTS.length) + 1).padStart(2, "0")}`,
      placement: index % 5 === 0 ? "recommendation" : "direct",
    });

    if (addedToCart) {
      const cartSize = 1 + (index % 4);
      const unitPrice = 299 + (index % 8) * 75;
      const cartValue = unitPrice * cartSize;
      event("cart", "add_to_cart", 5, {
        productId: `p${String((index % PRODUCTS.length) + 1).padStart(2, "0")}`,
        quantity: 1 + (index % 2),
        unitPrice,
        cartValue,
        cartSize,
        placement: index % 5 === 0 ? "recommendation" : "pdp",
      });

      if (startedCheckout) {
        expose("checkout_reassurance_v1", 9);
        event("checkout", "checkout_started", 10, { cartValue, cartSize });

        if (completedCheckoutStep) {
          event("step", "checkout_step_completed", 15, {
            cartValue,
            checkoutStep: 1 + (index % 3),
          });

          if (completedOrder) {
            event("order", "order_completed", 25, {
              orderId: `growth_demo_order_${sequence}`,
              cartValue: cartValue + 4000, // flat ৳40 delivery
              cartSize,
            });
          }
        }
      }
    }
  }

  return { sessions, events, exposures };
}

type GrowthDemoTransaction = {
  growthEvent: {
    deleteMany(args: { where: { demo: true } }): Promise<unknown>;
    createMany(args: { data: GrowthDemoRows["events"] }): Promise<unknown>;
  };
  experimentExposure: {
    deleteMany(args: { where: { demo: true } }): Promise<unknown>;
    createMany(args: { data: GrowthDemoRows["exposures"] }): Promise<unknown>;
  };
  growthSession: {
    findFirst(args: {
      where: {
        demo: true;
        OR: Array<
          { events: { some: { demo: false } } }
          | { exposures: { some: { demo: false } } }
        >;
      };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    deleteMany(args: { where: { demo: true } }): Promise<unknown>;
    createMany(args: { data: GrowthDemoRows["sessions"] }): Promise<unknown>;
  };
};

type GrowthDemoDatabase = {
  $transaction(operation: (transaction: GrowthDemoTransaction) => Promise<void>): Promise<unknown>;
};

export async function replaceGrowthDemoRows(
  database: GrowthDemoDatabase,
  rows: GrowthDemoRows,
) {
  await database.$transaction(async (transaction) => {
    const mixedSession = await transaction.growthSession.findFirst({
      where: {
        demo: true,
        OR: [
          { events: { some: { demo: false } } },
          { exposures: { some: { demo: false } } },
        ],
      },
      select: { id: true },
    });
    if (mixedSession) {
      throw new Error(
        `Refusing to replace demo growth data: ${mixedSession.id} owns non-demo analytics`,
      );
    }

    await transaction.growthEvent.deleteMany({ where: { demo: true } });
    await transaction.experimentExposure.deleteMany({ where: { demo: true } });
    await transaction.growthSession.deleteMany({ where: { demo: true } });

    await transaction.growthSession.createMany({ data: rows.sessions });
    await transaction.experimentExposure.createMany({ data: rows.exposures });
    await transaction.growthEvent.createMany({ data: rows.events });
  });
}

async function seedProducts() {
  console.log("Seeding products…");
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: p.id },
      // Upsert: create on first run, leave admin edits intact on subsequent runs.
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        price: p.price,
        unit: p.unit,
        category: p.category as Category,
        origin: p.origin,
        organic: p.organic,
        inSeason: p.inSeason,
        featured: p.featured ?? false,
        stock: p.stock,
        images: p.images,
        nutrition: p.nutrition,
        tags: p.tags,
      },
      update: {},
    });
  }
  console.log(`✓ Seeded ${PRODUCTS.length} products`);
}

async function seedUsers() {
  console.log("Seeding users…");
  const users = [
    {
      email: "admin@veggievan.local",
      name: "Riley Admin",
      role: Role.admin,
      password: "admin123",
    },
    {
      email: "staff@veggievan.local",
      name: "Sam Staff",
      role: Role.staff,
      password: "staff123",
    },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
      },
      update: {
        // Keep passwordHash fresh in case bcrypt cost factor changes.
        passwordHash,
        name: u.name,
        role: u.role,
      },
    });
  }
  console.log(`✓ Seeded ${users.length} users`);
}

async function seedOrders() {
  console.log("Seeding orders…");
  // Idempotent for orders: clear and reseed (orders are demo data only).
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  // Fictional demo customers. Money is in paisa; totals follow the same
  // flat ৳40 delivery charge the storefront applies to every order.
  await prisma.order.create({
    data: {
      id: "ord_seed_1",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
      status: "processing",
      customerName: "Rehana Akter",
      customerPhone: "01712345678",
      customerEmail: "rehana@example.com",
      customerAddress: "House 42, Road 11, Flat 3A",
      customerZone: "Dhanmondi",
      subtotal: 29_900,
      shipping: 4_000,
      total: 33_900,
      items: {
        create: [
          { productId: "p11", name: "Everyday Essentials Basket", qty: 1, price: 29_900 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      id: "ord_seed_2",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      status: "pending",
      customerName: "Tanvir Hasan",
      customerPhone: "01819876543",
      customerEmail: null,
      customerAddress: "Sector 7, Road 14, House 9",
      customerZone: "Uttara",
      subtotal: 60_000,
      shipping: 4_000,
      total: 64_000,
      items: {
        create: [
          { productId: "p12", name: "Family Fresh Basket", qty: 2, price: 30_000 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      id: "ord_seed_3",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
      status: "delivered",
      customerName: "Nusrat Jahan",
      customerPhone: "01911223344",
      customerEmail: "nusrat@example.com",
      customerAddress: "Block C, Road 3, House 18",
      customerZone: "Mirpur",
      subtotal: 21_000,
      shipping: 4_000,
      total: 25_000,
      items: {
        create: [
          { productId: "p01", name: "Potato (Alu)", qty: 2, price: 4_500 },
          { productId: "p02", name: "Local Onion (Peyaj)", qty: 1, price: 7_000 },
          { productId: "p05", name: "Green Chilli (Kacha Morich)", qty: 1, price: 5_000 },
        ],
      },
    },
  });

  console.log("✓ Seeded 3 orders");
}

async function seedGrowthDemo() {
  console.log("Seeding synthetic growth analytics...");
  const rows = buildGrowthDemoRows(GROWTH_DEMO_ANCHOR);
  await replaceGrowthDemoRows(prisma, rows);
  console.log(
    `Seeded ${rows.sessions.length} demo sessions, ${rows.exposures.length} exposures, and ${rows.events.length} events`,
  );
}

async function main() {
  await seedProducts();
  await seedUsers();
  await seedOrders();
  await seedGrowthDemo();
}

const entryPoint = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (entryPoint === import.meta.url) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
