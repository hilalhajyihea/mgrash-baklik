import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const defaultHours = [
  { dayOfWeek: 0, startTime: "16:00", endTime: "23:00" },
  { dayOfWeek: 1, startTime: "16:00", endTime: "23:00" },
  { dayOfWeek: 2, startTime: "16:00", endTime: "23:00" },
  { dayOfWeek: 3, startTime: "16:00", endTime: "23:00" },
  { dayOfWeek: 4, startTime: "16:00", endTime: "23:00" },
  { dayOfWeek: 5, startTime: "16:00", endTime: "22:00" },
  { dayOfWeek: 6, startTime: "08:00", endTime: "22:00" },
];

async function main() {
  const demoPassword = process.env.DEMO_FIELD_PASSWORD || "ramat123";
  const passwordHash = await hash(demoPassword, 12);

  const field = await prisma.field.upsert({
    where: { slug: "ramat-gan" },
    update: { passwordHash, displayName: "ملعب رمات جان" },
    create: {
      slug: "ramat-gan",
      displayName: "ملعب رمات جان",
      username: "ramatgan",
      passwordHash,
      slotMinutes: 60,
      holdMinutes: 15,
      smsPlanEnabled: true,
      workingHours: {
        create: defaultHours,
      },
    },
  });

  const existingHours = await prisma.workingHours.count({
    where: { fieldId: field.id },
  });
  if (existingHours === 0) {
    await prisma.workingHours.createMany({
      data: defaultHours.map((h) => ({ ...h, fieldId: field.id })),
    });
  }

  console.log(`Demo field ready: /${field.slug} (user: ramatgan / ${demoPassword})`);
  console.log("Platform login: PLATFORM_USERNAME / PLATFORM_PASSWORD from .env");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
