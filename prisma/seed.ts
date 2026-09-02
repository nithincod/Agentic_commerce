import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Seeding AgentPay...");

  await prisma.agentAction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.campaignExposure.deleteMany();
  await prisma.campaignTarget.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.checkout.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      name: "Demo Merchant",
      email: "merchant@agentpay.com",
      role: "MERCHANT",
    },
  });

  const merchant = await prisma.merchant.create({
    data: {
      name: "Demo Store",
      slug: "demo-store",
      ownerId: user.id,
    },
  });

  await prisma.product.createMany({
    data: [
      {
        merchantId: merchant.id,
        name: "Gaming Mouse Pro",
        description: "Wireless gaming mouse with 16000 DPI",
        category: "gaming",
        price: 1799,
        inventory: 25,
      },
      {
        merchantId: merchant.id,
        name: "RGB Gaming Mouse",
        description: "RGB wireless gaming mouse with 12000 DPI",
        category: "gaming",
        price: 1999,
        inventory: 15,
      },
      {
        merchantId: merchant.id,
        name: "Precision Gaming Mouse",
        description: "Lightweight high precision gaming mouse",
        category: "gaming",
        price: 1599,
        inventory: 8,
      },
      {
        merchantId: merchant.id,
        name: "Gaming Mouse Pad",
        description: "Large RGB gaming mouse pad",
        category: "accessories",
        price: 499,
        inventory: 50,
      },
      {
        merchantId: merchant.id,
        name: "Mechanical Gaming Keyboard",
        description: "RGB mechanical keyboard with blue switches",
        category: "gaming",
        price: 3499,
        inventory: 20,
      },
      {
        merchantId: merchant.id,
        name: "Wireless Gaming Headset",
        description: "Low latency wireless gaming headset",
        category: "gaming",
        price: 2999,
        inventory: 12,
      },
    ],
  });

  console.log("Seed completed.");
  console.log(`Created merchant user: ${user.email}`);
  console.log(`Created merchant: ${merchant.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
