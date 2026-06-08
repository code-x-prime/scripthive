import { prisma } from "./config/prisma.js";

async function main() {
  const journals = await prisma.journal.findMany();
  console.log("Journals in DB:");
  for (const j of journals) {
    console.log(`ID: ${j.id} | Name: ${j.name} | ISSN: ${j.issn} | eISSN: ${j.eIssn}`);
  }
}

main().finally(() => prisma.$disconnect());
