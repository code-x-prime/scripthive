import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeDemoArticlePdf } from "../src/utils/demoPdf.js";

export const DEMO_PREFIX = "SH-DEMO-";

const slugify = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

type DemoSubmission = {
  id: string;
  journalId: string;
  title: string;
  authorName: string;
  authorEmail: string;
  country: string;
  coAuthors?: string;
  abstract: string;
  keywords: string;
  status: string;
  paymentStatus: string;
  productionStatus?: string | null;
  daysAgo: number;
  pageStart?: number;
  pageEnd?: number;
  slug?: string;
  doi?: string;
  doiStatus?: string;
  invoiceStatus?: "Draft" | "Pending" | "Paid" | "Overdue";
  currency?: "USD" | "INR";
  partKey?: string;
  viewCount?: number;
  downloadCount?: number;
  pdfSizeKb?: number;
};

const DEMO_SUBMISSIONS: DemoSubmission[] = [
  // —— New (Pending) ——
  {
    id: `${DEMO_PREFIX}001`,
    journalId: "SGMRJ",
    title: "Machine Learning Applications in Rural Healthcare Networks",
    authorName: "Dr. Ananya Sharma",
    authorEmail: "ananya.sharma.demo@example.com",
    country: "India",
    coAuthors: "R. Patel, S. Mehta",
    abstract: "<p>This study explores ML models for early disease detection in rural clinics across South Asia.</p>",
    keywords: "machine learning, healthcare, rural medicine",
    status: "Pending",
    paymentStatus: "Pending",
    daysAgo: 2
  },
  {
    id: `${DEMO_PREFIX}002`,
    journalId: "SGJETR",
    title: "Optimizing Solar Microgrids with IoT Sensor Arrays",
    authorName: "James Okonkwo",
    authorEmail: "j.okonkwo.demo@example.com",
    country: "Nigeria",
    abstract: "<p>We present a low-cost IoT framework for monitoring and balancing village-scale solar microgrids.</p>",
    keywords: "IoT, solar energy, microgrid",
    status: "Pending",
    paymentStatus: "Pending",
    daysAgo: 5
  },
  {
    id: `${DEMO_PREFIX}003`,
    journalId: "SGJPLS",
    title: "Biodiversity Patterns in Himalayan Alpine Meadows",
    authorName: "Mei Lin Chen",
    authorEmail: "mei.chen.demo@example.com",
    country: "China",
    abstract: "<p>Seasonal field surveys reveal shifting species composition linked to temperature anomalies.</p>",
    keywords: "biodiversity, ecology, Himalaya",
    status: "Pending",
    paymentStatus: "Pending",
    daysAgo: 8
  },
  {
    id: `${DEMO_PREFIX}004`,
    journalId: "SGJVSR",
    title: "Philological Notes on Rigvedic Hymn 10.129",
    authorName: "Prof. Vikram Desai",
    authorEmail: "v.desai.demo@example.com",
    country: "India",
    abstract: "<p>A comparative reading of manuscript traditions and commentarial glosses on cosmogonic hymn 10.129.</p>",
    keywords: "Rigveda, philology, Sanskrit",
    status: "Pending",
    paymentStatus: "Pending",
    daysAgo: 1
  },
  // —— Under review ——
  {
    id: `${DEMO_PREFIX}005`,
    journalId: "SGMRJ",
    title: "Cross-Cultural Perspectives on Digital Ethics in AI Research",
    authorName: "Elena Vasquez",
    authorEmail: "e.vasquez.demo@example.com",
    country: "Spain",
    abstract: "<p>Ethical frameworks for AI deployment are compared across EU, US, and Asian regulatory contexts.</p>",
    keywords: "AI ethics, regulation, digital policy",
    status: "UnderReview",
    paymentStatus: "Pending",
    daysAgo: 42
  },
  {
    id: `${DEMO_PREFIX}006`,
    journalId: "SGJSSH",
    title: "Urban Migration and Youth Identity in Post-Industrial Cities",
    authorName: "Thomas Bergmann",
    authorEmail: "t.bergmann.demo@example.com",
    country: "Germany",
    abstract: "<p>Qualitative interviews with second-generation migrants in Ruhr region manufacturing towns.</p>",
    keywords: "migration, sociology, identity",
    status: "UnderReview",
    paymentStatus: "Pending",
    daysAgo: 15
  },
  {
    id: `${DEMO_PREFIX}007`,
    journalId: "SGJASH",
    title: "Telemedicine Adoption Among Elderly Patients Post-Pandemic",
    authorName: "Dr. Fatima Al-Hassan",
    authorEmail: "f.alhassan.demo@example.com",
    country: "UAE",
    abstract: "<p>Survey of 420 patients aged 65+ on barriers and facilitators to telehealth consultations.</p>",
    keywords: "telemedicine, geriatrics, public health",
    status: "UnderReview",
    paymentStatus: "Pending",
    daysAgo: 18
  },
  {
    id: `${DEMO_PREFIX}008`,
    journalId: "SGJETR",
    title: "Lightweight CNN Architectures for Edge-Based Quality Control",
    authorName: "Priya Nambiar",
    authorEmail: "p.nambiar.demo@example.com",
    country: "India",
    abstract: "<p>Compressed neural networks achieve 94% defect detection on factory floor Raspberry Pi clusters.</p>",
    keywords: "CNN, edge computing, manufacturing",
    status: "UnderReview",
    paymentStatus: "Pending",
    daysAgo: 20
  },
  // —— Rejected ——
  {
    id: `${DEMO_PREFIX}009`,
    journalId: "SGMRJ",
    title: "A Speculative Essay on Unverified Herbal Cancer Cures",
    authorName: "Unknown Author",
    authorEmail: "rejected1.demo@example.com",
    country: "India",
    abstract: "<p>Claims without clinical trial evidence — does not meet peer-review standards.</p>",
    keywords: "herbal, cancer",
    status: "Rejected",
    paymentStatus: "Pending",
    daysAgo: 95
  },
  {
    id: `${DEMO_PREFIX}010`,
    journalId: "SGJPLS",
    title: "Perpetual Motion Device Using Magnetic Levitation",
    authorName: "J. Crackpot",
    authorEmail: "rejected2.demo@example.com",
    country: "USA",
    abstract: "<p>Violates laws of thermodynamics — rejected at desk review.</p>",
    keywords: "physics, energy",
    status: "Rejected",
    paymentStatus: "Pending",
    daysAgo: 30
  },
  {
    id: `${DEMO_PREFIX}011`,
    journalId: "SGJSSH",
    title: "Plagiarized Content from Published Monograph (2019)",
    authorName: "Redacted Author",
    authorEmail: "rejected3.demo@example.com",
    country: "UK",
    abstract: "<p>High similarity index detected — manuscript withdrawn.</p>",
    keywords: "ethics, plagiarism",
    status: "Rejected",
    paymentStatus: "Pending",
    daysAgo: 22
  },
  // —— Accepted (unpaid / pending payment) ——
  {
    id: `${DEMO_PREFIX}012`,
    journalId: "SGMRJ",
    title: "Sustainable Supply Chains in Textile Manufacturing",
    authorName: "Carlos Mendez",
    authorEmail: "c.mendez.demo@example.com",
    country: "Mexico",
    abstract: "<p>Life-cycle assessment of water and carbon footprints in denim production hubs.</p>",
    keywords: "sustainability, textiles, supply chain",
    status: "Accepted",
    paymentStatus: "Pending",
    invoiceStatus: "Pending",
    currency: "USD",
    daysAgo: 28
  },
  {
    id: `${DEMO_PREFIX}013`,
    journalId: "SGJASH",
    title: "Nutritional Interventions for Adolescent Anemia in Rural Schools",
    authorName: "Dr. Kavita Rao",
    authorEmail: "k.rao.demo@example.com",
    country: "India",
    abstract: "<p>12-week iron supplementation trial across 18 government schools in Maharashtra.</p>",
    keywords: "nutrition, anemia, pediatrics",
    status: "Accepted",
    paymentStatus: "Pending",
    invoiceStatus: "Draft",
    currency: "INR",
    daysAgo: 26
  },
  // —— Accepted + Paid (DOI pending, publish queue, production) ——
  {
    id: `${DEMO_PREFIX}014`,
    journalId: "SGMRJ",
    title: "Blockchain Traceability for Organic Spice Exports",
    authorName: "Arjun Malhotra",
    authorEmail: "a.malhotra.demo@example.com",
    country: "India",
    abstract: "<p>Hyperledger-based ledger pilots with Kerala pepper and cardamom cooperatives.</p>",
    keywords: "blockchain, agriculture, traceability",
    status: "Accepted",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "INR",
    daysAgo: 35
  },
  {
    id: `${DEMO_PREFIX}015`,
    journalId: "SGJETR",
    title: "5G Network Slicing for Smart Campus Deployments",
    authorName: "Yuki Tanaka",
    authorEmail: "y.tanaka.demo@example.com",
    country: "Japan",
    abstract: "<p>Latency and throughput benchmarks for e-learning and lab automation slices.</p>",
    keywords: "5G, network slicing, campus network",
    status: "Accepted",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 32
  },
  {
    id: `${DEMO_PREFIX}016`,
    journalId: "SGJPLS",
    title: "CRISPR Off-Target Analysis in Model Plant Species",
    authorName: "Dr. Sofia Andersson",
    authorEmail: "s.andersson.demo@example.com",
    country: "Sweden",
    abstract: "<p>Whole-genome sequencing reveals off-target profiles across three Arabidopsis lines.</p>",
    keywords: "CRISPR, genomics, plant biology",
    status: "Accepted",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 40
  },
  {
    id: `${DEMO_PREFIX}017`,
    journalId: "SGJSSH",
    title: "Digital Archives and Memory Politics in Southeast Asia",
    authorName: "Nguyen Thi Lan",
    authorEmail: "n.lan.demo@example.com",
    country: "Vietnam",
    abstract: "<p>How national digitization projects reshape public narratives of colonial history.</p>",
    keywords: "archives, history, digital humanities",
    status: "Accepted",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 38
  },
  // Production pipeline
  {
    id: `${DEMO_PREFIX}018`,
    journalId: "SGMRJ",
    title: "Renewable Energy Policy Instruments: A Meta-Analysis",
    authorName: "Dr. Hassan Farouk",
    authorEmail: "h.farouk.demo@example.com",
    country: "Egypt",
    abstract: "<p>Comparative effectiveness of feed-in tariffs, auctions, and green certificates across 42 countries.</p>",
    keywords: "renewable energy, policy, meta-analysis",
    status: "Accepted",
    paymentStatus: "Paid",
    productionStatus: "ReadyForPreparation",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 42
  },
  {
    id: `${DEMO_PREFIX}019`,
    journalId: "SGJASH",
    title: "Mindfulness-Based Stress Reduction in Nursing Staff",
    authorName: "Maria Gonzalez",
    authorEmail: "m.gonzalez.demo@example.com",
    country: "USA",
    abstract: "<p>8-week MBSR program reduces burnout scores in ICU nurses at tertiary hospitals.</p>",
    keywords: "mindfulness, nursing, burnout",
    status: "Accepted",
    paymentStatus: "Paid",
    productionStatus: "ReadyForPreparation",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 44
  },
  {
    id: `${DEMO_PREFIX}020`,
    journalId: "SGJETR",
    title: "Autonomous Drone Swarms for Precision Agriculture Mapping",
    authorName: "Liam O'Brien",
    authorEmail: "l.obrien.demo@example.com",
    country: "Ireland",
    abstract: "<p>Coordinated UAV fleets generate NDVI maps for variable-rate fertilizer application.</p>",
    keywords: "drones, agriculture, precision farming",
    status: "Accepted",
    paymentStatus: "Paid",
    productionStatus: "ReadyForUpload",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 46
  },
  {
    id: `${DEMO_PREFIX}021`,
    journalId: "SGJPLS",
    title: "Marine Microplastic Ingestion in Commercial Fish Stocks",
    authorName: "Dr. Aisha Rahman",
    authorEmail: "a.rahman.demo@example.com",
    country: "Bangladesh",
    abstract: "<p>FTIR spectroscopy quantifies microplastic loads in Bay of Bengal catch samples.</p>",
    keywords: "microplastics, marine biology, fisheries",
    status: "Accepted",
    paymentStatus: "Paid",
    productionStatus: "ReadyForUpload",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 48
  },
  {
    id: `${DEMO_PREFIX}022`,
    journalId: "SGJVSR",
    title: "Manuscript Traditions of the Bhagavad Gita Commentaries",
    authorName: "Dr. Ramesh Iyer",
    authorEmail: "r.iyer.demo@example.com",
    country: "India",
    abstract: "<p>Collation of 14th–18th century commentarial variants from Kerala palm-leaf collections.</p>",
    keywords: "Bhagavad Gita, manuscript, Sanskrit",
    status: "Accepted",
    paymentStatus: "Paid",
    productionStatus: "ReadyToPublished",
    invoiceStatus: "Paid",
    currency: "INR",
    daysAgo: 50
  },
  {
    id: `${DEMO_PREFIX}023`,
    journalId: "SGMRJ",
    title: "Gender Equity in STEM Faculty Hiring Committees",
    authorName: "Dr. Emily Watson",
    authorEmail: "e.watson.demo@example.com",
    country: "Canada",
    abstract: "<p>Blind review protocols and their impact on shortlist diversity in North American universities.</p>",
    keywords: "STEM, gender equity, hiring",
    status: "Accepted",
    paymentStatus: "Paid",
    productionStatus: "ReadyToPublished",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 52
  },
  // Ready for publish page (Accepted + Paid, no production stage)
  {
    id: `${DEMO_PREFIX}024`,
    journalId: "SGMRJ",
    title: "Climate Resilience Strategies for Coastal Smallholder Farms",
    authorName: "Isabella Costa",
    authorEmail: "i.costa.demo@example.com",
    country: "Brazil",
    abstract: "<p>Agroforestry and salt-tolerant cultivars tested in Pernambuco coastal communities.</p>",
    keywords: "climate change, agriculture, resilience",
    status: "Accepted",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 36
  },
  {
    id: `${DEMO_PREFIX}025`,
    journalId: "SGJETR",
    title: "Quantum-Resistant Cryptography for IoT Firmware Updates",
    authorName: "Chen Wei",
    authorEmail: "c.wei.demo@example.com",
    country: "Singapore",
    abstract: "<p>Lattice-based signatures evaluated on constrained ARM Cortex-M devices.</p>",
    keywords: "cryptography, IoT, post-quantum",
    status: "Accepted",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "USD",
    daysAgo: 34,
    doi: "10.55662/sgjetr.v1i2.025",
    doiStatus: "Minted"
  },
  // —— Published (public archive) ——
  {
    id: `${DEMO_PREFIX}026`,
    journalId: "SGMRJ",
    title: "Deep Learning for Early Detection of Diabetic Retinopathy",
    authorName: "Dr. Priya Nair",
    authorEmail: "p.nair.pub.demo@example.com",
    country: "India",
    coAuthors: "A. Kumar, S. Reddy",
    abstract: "<p>Convolutional ensemble achieves 96.2% sensitivity on fundus image screening datasets.</p>",
    keywords: "deep learning, ophthalmology, diabetes",
    status: "Published",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "INR",
    pageStart: 1,
    pageEnd: 12,
    slug: "deep-learning-for-early-detection-of-diabetic-retinopathy",
    doi: "10.55662/sgmrj.2025.v1i1a.1476",
    doiStatus: "Minted",
    partKey: "SGMRJ-1-1-A",
    daysAgo: 35,
    viewCount: 671,
    downloadCount: 28,
    pdfSizeKb: 512
  },
  {
    id: `${DEMO_PREFIX}027`,
    journalId: "SGMRJ",
    title: "Natural Language Processing for Low-Resource Indian Languages",
    authorName: "Rahul Verma",
    authorEmail: "r.verma.pub.demo@example.com",
    country: "India",
    abstract: "<p>Transformer fine-tuning benchmarks on Bhojpuri, Maithili, and Awadhi corpora.</p>",
    keywords: "NLP, low-resource languages, transformers",
    status: "Published",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "INR",
    pageStart: 13,
    pageEnd: 24,
    slug: "natural-language-processing-for-low-resource-indian-languages",
    doi: "10.55662/sgmrj.2025.v1i1a.1477",
    doiStatus: "Minted",
    partKey: "SGMRJ-1-1-A",
    daysAgo: 72,
    viewCount: 542,
    downloadCount: 22,
    pdfSizeKb: 890
  },
  {
    id: `${DEMO_PREFIX}028`,
    journalId: "SGMRJ",
    title: "Smart Agriculture Using IoT and Machine Learning",
    authorName: "Dr. Sanjay Gupta",
    authorEmail: "s.gupta.pub.demo@example.com",
    country: "India",
    abstract: "<p>Soil moisture and weather fusion models optimize irrigation scheduling in Punjab wheat belts.</p>",
    keywords: "IoT, agriculture, machine learning",
    status: "Published",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "INR",
    pageStart: 25,
    pageEnd: 36,
    slug: "smart-agriculture-using-iot-and-machine-learning",
    doi: "10.55662/sgmrj.2025.v1i1a.1478",
    doiStatus: "Minted",
    partKey: "SGMRJ-1-1-A",
    daysAgo: 105,
    viewCount: 623,
    downloadCount: 19,
    pdfSizeKb: 699
  },
  {
    id: `${DEMO_PREFIX}029`,
    journalId: "SGMRJ",
    title: "Renewable Energy Integration in Urban Power Grids",
    authorName: "Dr. Elena Popov",
    authorEmail: "e.popov.pub.demo@example.com",
    country: "Russia",
    abstract: "<p>Hybrid solar-wind forecasting improves grid stability in mid-sized metropolitan networks.</p>",
    keywords: "renewable energy, smart grid, urban planning",
    status: "Published",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "USD",
    pageStart: 1,
    pageEnd: 10,
    slug: "renewable-energy-integration-in-urban-power-grids",
    doi: "10.55662/sgmrj.2025.v1i1b.1479",
    doiStatus: "Minted",
    partKey: "SGMRJ-1-1-B",
    daysAgo: 52,
    viewCount: 312,
    downloadCount: 18,
    pdfSizeKb: 450
  },
  {
    id: `${DEMO_PREFIX}030`,
    journalId: "SGJETR",
    title: "Structural Health Monitoring with Embedded Fibre Optics",
    authorName: "Dr. Kenji Sato",
    authorEmail: "k.sato.pub.demo@example.com",
    country: "Japan",
    abstract: "<p>Distributed strain sensing on bridge decks enables real-time fatigue crack prediction.</p>",
    keywords: "structural engineering, fibre optics, SHM",
    status: "Published",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "USD",
    pageStart: 1,
    pageEnd: 14,
    slug: "structural-health-monitoring-with-embedded-fibre-optics",
    doi: "10.55662/sgjetr.2025.v2i1a.1480",
    doiStatus: "Minted",
    partKey: "SGJETR-2-1-A",
    daysAgo: 130,
    viewCount: 401,
    downloadCount: 15,
    pdfSizeKb: 720
  },
  {
    id: `${DEMO_PREFIX}031`,
    journalId: "SGJETR",
    title: "Additive Manufacturing of Titanium Aerospace Components",
    authorName: "Mark Stevens",
    authorEmail: "m.stevens.pub.demo@example.com",
    country: "USA",
    abstract: "<p>Selective laser melting parameters tuned for Ti-6Al-4V fatigue life in turbine brackets.</p>",
    keywords: "additive manufacturing, aerospace, titanium",
    status: "Published",
    paymentStatus: "Paid",
    invoiceStatus: "Paid",
    currency: "USD",
    pageStart: 15,
    pageEnd: 28,
    slug: "additive-manufacturing-of-titanium-aerospace-components",
    doi: "10.55662/sgjetr.2025.v2i1a.1481",
    doiStatus: "Minted",
    partKey: "SGJETR-2-1-A",
    daysAgo: 88,
    viewCount: 289,
    downloadCount: 12,
    pdfSizeKb: 580
  }
];

const EDITORIAL_BOARD = [
  { journalId: "SGMRJ", name: "Prof. Anita Deshmukh", role: "Editor-in-Chief", institution: "IIT Bombay, India" },
  { journalId: "SGMRJ", name: "Dr. Michael Torres", role: "Associate Editor", institution: "MIT, USA" },
  { journalId: "SGJETR", name: "Dr. Hiroshi Yamamoto", role: "Editor-in-Chief", institution: "University of Tokyo, Japan" },
  { journalId: "SGJPLS", name: "Prof. Laura Schmidt", role: "Editor-in-Chief", institution: "Max Planck Institute, Germany" },
  { journalId: "SGJVSR", name: "Dr. Padma Krishnan", role: "Editor-in-Chief", institution: "BHU Varanasi, India" }
] as const;

const JOURNAL_ISSN = [
  { id: "SGMRJ", issn: "2583-2140", eIssn: "2583-2159" },
  { id: "SGJETR", issn: "2583-2167", eIssn: "2583-2175" },
  { id: "SGJPLS", issn: "2583-2183", eIssn: "2583-2191" },
  { id: "SGJVSR", issn: "2583-2205", eIssn: "2583-2213" },
  { id: "SGJSSH", issn: "2583-2221", eIssn: "2583-223X" },
  { id: "SGJASH", issn: "2583-2248", eIssn: "2583-2256" }
] as const;

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function clearDemoData(prisma: PrismaClient): Promise<void> {
  const demoIds = DEMO_SUBMISSIONS.map((s) => s.id);

  await prisma.doiRecord.deleteMany({ where: { submissionId: { in: demoIds } } });
  await prisma.invoice.deleteMany({ where: { submissionId: { in: demoIds } } });
  await prisma.submission.deleteMany({ where: { id: { in: demoIds } } });

  await prisma.adminUser.deleteMany({
    where: {
      OR: [
        { username: { in: ["editor.john", "finance.priya", "reviewer.amit"] } },
        { email: "reviewer.demo@scripthive.org" }
      ]
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eb = (prisma as any).editorialBoardMember;
  if (eb) {
    for (const m of EDITORIAL_BOARD) {
      await eb.deleteMany({
        where: { journalId: m.journalId, name: m.name }
      });
    }
  }
}

async function seedDemoUsers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash("Demo@ScriptHive123", 12);

  const editorRole = await prisma.role.findUnique({ where: { name: "editor" } });
  const accountantRole = await prisma.role.findUnique({ where: { name: "accountant" } });
  const reviewerRole = await prisma.role.findUnique({ where: { name: "reviewer" } });
  if (!editorRole || !accountantRole || !reviewerRole) return;

  await prisma.adminUser.upsert({
    where: { username: "editor.john" },
    update: { name: "John Editor", passwordHash, roleId: editorRole.id, isActive: true },
    create: {
      name: "John Editor",
      username: "editor.john",
      passwordHash,
      roleId: editorRole.id
    }
  });

  await prisma.adminUser.upsert({
    where: { username: "finance.priya" },
    update: { name: "Priya Finance", passwordHash, roleId: accountantRole.id, isActive: true },
    create: {
      name: "Priya Finance",
      username: "finance.priya",
      passwordHash,
      roleId: accountantRole.id
    }
  });

  await prisma.adminUser.upsert({
    where: { username: "reviewer.amit" },
    update: {
      name: "Amit Reviewer",
      email: "reviewer.demo@scripthive.org",
      passwordHash,
      roleId: reviewerRole.id,
      isActive: true
    },
    create: {
      name: "Amit Reviewer",
      username: "reviewer.amit",
      email: "reviewer.demo@scripthive.org",
      passwordHash,
      roleId: reviewerRole.id
    }
  });

  console.log("Demo team users: editor.john, finance.priya, reviewer.amit (password: Demo@ScriptHive123)");
}

async function seedDemoAuthor(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash("Author@ScriptHive123", 12);
  const email = "author.demo@scripthive.org";
  const author = await prisma.author.upsert({
    where: { email },
    update: {
      name: "Demo Author",
      passwordHash,
      phone: "+91-9876543210",
      country: "India",
      affiliations: "ScriptHive Research Institute",
      isActive: true
    },
    create: {
      name: "Demo Author",
      email,
      passwordHash,
      phone: "+91-9876543210",
      country: "India",
      affiliations: "ScriptHive Research Institute"
    }
  });
  await prisma.submission.updateMany({
    where: { authorEmail: email },
    data: { authorUserId: author.id }
  });
  console.log("Demo author: author.demo@scripthive.org (password: Author@ScriptHive123)");
}

async function seedVolumesAndParts(prisma: PrismaClient): Promise<Map<string, number>> {
  const partMap = new Map<string, number>();

  const structures = [
    { journalId: "SGMRJ", vol: 1, year: 2025, issue: 1, period: "January", parts: ["A", "B"] },
    { journalId: "SGJETR", vol: 2, year: 2025, issue: 1, period: "March", parts: ["A"] }
  ];

  for (const s of structures) {
    let volume = await prisma.volume.findFirst({
      where: { journalId: s.journalId, number: s.vol }
    });
    if (!volume) {
      volume = await prisma.volume.create({
        data: { journalId: s.journalId, number: s.vol, year: s.year }
      });
    }

    let issue = await prisma.issue.findFirst({
      where: { volumeId: volume.id, number: s.issue }
    });
    if (!issue) {
      issue = await prisma.issue.create({
        data: { volumeId: volume.id, number: s.issue, period: s.period, isCurrent: true }
      });
    } else {
      await prisma.issue.update({
        where: { id: issue.id },
        data: { period: s.period, isCurrent: true }
      });
    }

    for (const partName of s.parts) {
      let part = await prisma.part.findFirst({
        where: { issueId: issue.id, name: partName }
      });
      if (!part) {
        part = await prisma.part.create({
          data: { issueId: issue.id, name: partName }
        });
      }
      partMap.set(`${s.journalId}-${s.vol}-${s.issue}-${partName}`, part.id);
    }
  }

  return partMap;
}

export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  console.log("\n--- Demo data seed (client preview) ---");
  await clearDemoData(prisma);

  for (const j of JOURNAL_ISSN) {
    await prisma.journal.update({
      where: { id: j.id },
      data: { issn: j.issn, eIssn: j.eIssn }
    });
  }

  await seedDemoUsers(prisma);
  await seedDemoAuthor(prisma);
  const partMap = await seedVolumesAndParts(prisma);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eb = (prisma as any).editorialBoardMember;
  if (eb) {
    for (let i = 0; i < EDITORIAL_BOARD.length; i++) {
      const m = EDITORIAL_BOARD[i]!;
      await eb.create({
        data: {
          journalId: m.journalId,
          name: m.name,
          role: m.role,
          institution: m.institution,
          sortOrder: i
        }
      });
    }
  }

  let invoiceSeq = await prisma.invoice.count();

  for (const row of DEMO_SUBMISSIONS) {
    const createdAt = daysAgoDate(row.daysAgo);
    const partId = row.partKey ? partMap.get(row.partKey) ?? null : null;

    let volumeId: number | null = null;
    let issueId: number | null = null;
    if (partId) {
      const part = await prisma.part.findUnique({
        where: { id: partId },
        include: { issue: { include: { volume: true } } }
      });
      volumeId = part?.issue.volumeId ?? null;
      issueId = part?.issueId ?? null;
    }

    const articleSlug = row.slug ?? (row.status === "Published" ? slugify(row.title) : null);
    let pdfPublicPath: string | null = null;
    if (row.status === "Published" && articleSlug && row.pdfSizeKb) {
      pdfPublicPath = writeDemoArticlePdf(
        `uploads/articles/${articleSlug}.pdf`,
        row.title,
        row.pdfSizeKb
      );
    }

    await prisma.submission.create({
      data: {
        id: row.id,
        journalId: row.journalId,
        title: row.title,
        country: row.country,
        authorName: row.authorName,
        authorEmail: row.authorEmail,
        coAuthors: row.coAuthors ?? null,
        abstract: row.abstract,
        keywords: row.keywords,
        articleType: "Research",
        status: row.status,
        productionStatus: row.productionStatus ?? null,
        paymentStatus: row.paymentStatus,
        paymentMethod: row.paymentStatus === "Paid" ? (row.currency === "INR" ? "Razorpay" : "PayPal") : null,
        paidAt: row.paymentStatus === "Paid" ? daysAgoDate(row.daysAgo - 3) : null,
        volumeId,
        issueId,
        partId,
        pageStart: row.pageStart ?? null,
        pageEnd: row.pageEnd ?? null,
        pubDate: row.status === "Published" ? daysAgoDate(row.daysAgo - 5) : null,
        slug: articleSlug,
        pdfPublicPath,
        viewCount: row.viewCount ?? 0,
        downloadCount: row.downloadCount ?? 0,
        apcAmount: row.currency === "INR" ? 11500 : 140,
        apcCurrency: row.currency ?? "USD",
        createdAt,
        updatedAt: createdAt
      }
    });

    if (row.invoiceStatus) {
      invoiceSeq += 1;
      const total = row.currency === "INR" ? 11500 : 140;
      const invId = `INV-DEMO-${String(invoiceSeq).padStart(4, "0")}`;
      await prisma.invoice.create({
        data: {
          id: invId,
          submissionId: row.id,
          customerName: row.authorName,
          customerEmail: row.authorEmail,
          items: [{ description: "Article Processing Charge (APC)", amount: total }],
          subtotal: total,
          tax: 0,
          total,
          currency: row.currency ?? "USD",
          status: row.invoiceStatus,
          method: row.invoiceStatus === "Paid" ? (row.currency === "INR" ? "Razorpay" : "PayPal") : null,
          paidAt: row.invoiceStatus === "Paid" ? daysAgoDate(row.daysAgo - 2) : null,
          dueDate: row.invoiceStatus !== "Paid" ? daysAgoDate(-14) : null,
          createdAt,
          updatedAt: createdAt
        }
      });
    }

    if (row.doi) {
      await prisma.doiRecord.create({
        data: {
          submissionId: row.id,
          doi: row.doi,
          status: row.doiStatus ?? "Minted"
        }
      });
    }
  }

  // Extra overdue invoice for payments demo
  invoiceSeq += 1;
  await prisma.invoice.create({
    data: {
      id: `INV-DEMO-${String(invoiceSeq).padStart(4, "0")}`,
      submissionId: `${DEMO_PREFIX}012`,
      customerName: "Carlos Mendez",
      customerEmail: "c.mendez.demo@example.com",
      items: [{ description: "Article Processing Charge (APC)", amount: 140 }],
      subtotal: 140,
      tax: 0,
      total: 140,
      currency: "USD",
      status: "Overdue",
      dueDate: daysAgoDate(30),
      createdAt: daysAgoDate(28),
      updatedAt: daysAgoDate(10)
    }
  });

  const demoAuthor = await prisma.author.findUnique({ where: { email: "author.demo@scripthive.org" } });
  if (demoAuthor) {
    const authorPortalIds = [
      `${DEMO_PREFIX}001`,
      `${DEMO_PREFIX}005`,
      `${DEMO_PREFIX}009`,
      `${DEMO_PREFIX}012`,
      `${DEMO_PREFIX}026`
    ];
    await prisma.submission.updateMany({
      where: { id: { in: authorPortalIds } },
      data: {
        authorUserId: demoAuthor.id,
        authorEmail: demoAuthor.email,
        authorName: demoAuthor.name,
        authorPhone: demoAuthor.phone,
        country: demoAuthor.country,
        affiliations: demoAuthor.affiliations
      }
    });
    console.log(`Author portal: ${authorPortalIds.length} submissions linked to ${demoAuthor.email}`);
  }

  console.log(`Created ${DEMO_SUBMISSIONS.length} demo submissions (${DEMO_PREFIX}*)`);
  console.log("Pages filled: submissions (all tabs), payments, DOI, production, publish, archives, journals ISSN");
  console.log("Public archive: http://localhost:5173/journals/sgmrj/archive");
  console.log("Re-run: npm run seed  (demo data refreshes each time)\n");
}
