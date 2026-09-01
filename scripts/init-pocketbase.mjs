import PocketBase from "pocketbase";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const pbDir = path.join(projectRoot, "pocketbase");
const pbDataDir = path.join(pbDir, "pb_data");
const csvPath = path.join(projectRoot, "client", "public", "data", "battery_dataset.csv");

const isWin = process.platform === "win32";
const exeName = isWin ? "pocketbase.exe" : "pocketbase";
const exePath = path.join(pbDir, exeName);
const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";

if (process.argv.includes("--serve")) {
  if (!fs.existsSync(exePath)) {
    console.error(`PocketBase executable not found at: ${exePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(pbDataDir)) {
    fs.mkdirSync(pbDataDir, { recursive: true });
  }
  console.log(`Starting PocketBase server (${exePath})...`);
  const child = spawn(exePath, ["serve", `--dir=${pbDataDir}`], {
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", code => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
} else {
  const pb = new PocketBase(PB_URL);
  (async () => {
    let spawnedChild = null;
    try {
      await pb.health.check();
    } catch {
      console.log("PocketBase is not currently running. Starting temporary instance for initialization...");
      spawnedChild = spawn(exePath, ["serve", `--dir=${pbDataDir}`], {
        stdio: "ignore",
        shell: false,
      });
      // Wait for server to be ready
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 200));
        try {
          const h = await pb.health.check();
          if (h.code === 200) break;
        } catch { /* retry */ }
      }
    }

    try {
      await init(pb);
    } finally {
      if (spawnedChild) {
        spawnedChild.kill();
      }
    }
  })().catch(console.error);
}

async function init(pb) {
  console.log(`\n========================================`);
  console.log(`VoltPassport AI - PocketBase Initializer`);
  console.log(`Connecting to: ${PB_URL}`);
  console.log(`========================================\n`);

  try {
    await pb.collection("_superusers").authWithPassword("admin@voltpassport.ai", "admin12345678");
    console.log("✓ Authenticated as superuser (admin@voltpassport.ai)");
  } catch (err) {
    console.error("✗ Failed to authenticate as superuser:", err.message);
    process.exit(1);
  }

  // 1. Update Users collection with activeBatteryId
  try {
    const usersColl = await pb.collections.getOne("users");
    const existingFieldNames = (usersColl.fields || []).map(f => f.name);
    const updatedFields = [...(usersColl.fields || [])];

    if (!existingFieldNames.includes("activeBatteryId")) {
      updatedFields.push({
        name: "activeBatteryId",
        type: "text",
        required: false,
        max: 50,
      });
    }

    await pb.collections.update("users", {
      fields: updatedFields,
      listRule: "", // Allow listing users
      viewRule: "", // Allow viewing user profile
      createRule: "", // Allow public registration
      updateRule: "id = @request.auth.id",
    });
    console.log("✓ Updated 'users' auth collection schema & open registration rule");
  } catch (err) {
    console.warn("! Notice on updating users collection:", err.message);
  }

  // Helper to upsert collection
  async function upsertCollection(collectionData) {
    try {
      const existing = await pb.collections.getOne(collectionData.name);
      console.log(`  Collection '${collectionData.name}' already exists (ID: ${existing.id}), verifying rules...`);
      return await pb.collections.update(existing.id, {
        listRule: collectionData.listRule,
        viewRule: collectionData.viewRule,
        createRule: collectionData.createRule,
        updateRule: collectionData.updateRule,
        deleteRule: collectionData.deleteRule,
      });
    } catch (e) {
      if (e.status === 404) {
        console.log(`  Creating collection '${collectionData.name}'...`);
        return await pb.collections.create(collectionData);
      }
      throw e;
    }
  }

  // 2. Battery Records Collection
  console.log("\nConfiguring 'battery_records' collection...");
  await upsertCollection({
    name: "battery_records",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null,
    fields: [
      { name: "batteryId", type: "text", required: true },
      { name: "batchId", type: "text", required: true },
      { name: "cycle", type: "number", required: true },
      { name: "voltage", type: "number", required: true },
      { name: "current", type: "number", required: true },
      { name: "temperature", type: "number", required: true },
      { name: "chargeTime", type: "number", required: true },
      { name: "dischargeTime", type: "number", required: true },
      { name: "internalResistance", type: "number", required: true },
      { name: "capacity", type: "number", required: true },
      { name: "ambientHumidity", type: "number", required: true },
      { name: "cRate", type: "number", required: true },
      { name: "soh", type: "number", required: true },
      { name: "created", type: "autodate" },
      { name: "updated", type: "autodate" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_batteryId_unique` ON `battery_records` (`batteryId`)"
    ]
  });
  console.log("✓ Collection 'battery_records' ready.");

  // 3. Digital Passports Collection
  console.log("\nConfiguring 'passports' collection...");
  await upsertCollection({
    name: "passports",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { name: "batteryId", type: "text", required: true },
      { name: "batchId", type: "text", required: false },
      { name: "user", type: "relation", required: false, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "soh", type: "number", required: true },
      { name: "grade", type: "text", required: true },
      { name: "status", type: "text", required: false },
      { name: "lifecycle", type: "text", required: false },
      { name: "hash", type: "text", required: false },
      { name: "primaryDriver", type: "text", required: false },
      { name: "confidence", type: "text", required: false },
      { name: "telemetry", type: "json", required: false },
      { name: "notes", type: "text", required: false },
      { name: "created", type: "autodate" },
      { name: "updated", type: "autodate" },
    ],
  });
  console.log("✓ Collection 'passports' ready.");

  // 4. Telemetry Assessments Collection
  console.log("\nConfiguring 'telemetry_assessments' collection...");
  await upsertCollection({
    name: "telemetry_assessments",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null,
    fields: [
      { name: "batteryId", type: "text", required: false },
      { name: "user", type: "relation", required: false, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "cycles", type: "number", required: true },
      { name: "temp", type: "number", required: true },
      { name: "volt", type: "number", required: true },
      { name: "resistance", type: "number", required: true },
      { name: "fastCharge", type: "number", required: true },
      { name: "soh", type: "number", required: true },
      { name: "grade", type: "text", required: true },
      { name: "safety", type: "number", required: true },
      { name: "thermal", type: "text", required: true },
      { name: "mode", type: "text", required: false },
      { name: "factors", type: "json", required: false },
      { name: "created", type: "autodate" },
      { name: "updated", type: "autodate" },
    ],
  });
  console.log("✓ Collection 'telemetry_assessments' ready.");

  // 5. Seed Demo User
  console.log("\nSeeding demo user...");
  try {
    const existingUsers = await pb.collection("users").getList(1, 1, { filter: 'email = "demo@voltpassport.ai"' });
    if (existingUsers.totalItems === 0) {
      await pb.collection("users").create({
        email: "demo@voltpassport.ai",
        password: "password123",
        passwordConfirm: "password123",
        name: "Fleet Engineer",
        activeBatteryId: "BAT0001",
        verified: true,
      });
      console.log("✓ Created demo user: demo@voltpassport.ai / password123");
    } else {
      console.log("✓ Demo user demo@voltpassport.ai already exists.");
    }
  } catch (err) {
    console.warn("! Notice creating demo user:", err.message);
  }

  // 6. Seed Battery Records from CSV
  console.log("\nReading dataset CSV and seeding battery records...");
  if (!fs.existsSync(csvPath)) {
    console.error(`✗ CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headers = lines[0].split(",").map(h => h.trim());
  
  const recordsToSeed = [];
  // Parse up to 200 records from CSV to seed into database
  const limit = Math.min(lines.length, 201); // header + 200 records
  for (let i = 1; i < limit; i++) {
    const cells = lines[i].split(",");
    if (cells.length < 13) continue;
    recordsToSeed.push({
      batteryId: cells[0]?.trim().toUpperCase(),
      batchId: cells[1]?.trim(),
      cycle: Number(cells[2]),
      voltage: Number(cells[3]),
      current: Number(cells[4]),
      temperature: Number(cells[5]),
      chargeTime: Number(cells[6]),
      dischargeTime: Number(cells[7]),
      internalResistance: Number(cells[8]),
      capacity: Number(cells[9]),
      ambientHumidity: Number(cells[10]),
      cRate: Number(cells[11]),
      soh: Number(cells[12]),
    });
  }

  console.log(`Parsed ${recordsToSeed.length} records to seed into PocketBase.`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const record of recordsToSeed) {
    try {
      const existing = await pb.collection("battery_records").getList(1, 1, {
        filter: `batteryId = "${record.batteryId}"`
      });
      if (existing.totalItems > 0) {
        skippedCount++;
        continue;
      }
      await pb.collection("battery_records").create(record);
      createdCount++;
      if (createdCount % 25 === 0 || createdCount === recordsToSeed.length) {
        console.log(`  Seeded ${createdCount} battery records...`);
      }
    } catch (err) {
      console.warn(`  ! Could not seed record ${record.batteryId}:`, err.message);
    }
  }

  console.log(`✓ Seeding finished: ${createdCount} created, ${skippedCount} already existed.`);

  // 7. Seed Initial Sample Passport & Assessment
  console.log("\nSeeding starter passport and telemetry assessment...");
  try {
    const existingPassports = await pb.collection("passports").getList(1, 1, { filter: 'batteryId = "BAT0001"' });
    if (existingPassports.totalItems === 0) {
      await pb.collection("passports").create({
        batteryId: "BAT0001",
        batchId: "BatchC",
        soh: 100.0,
        grade: "A",
        status: "EV READY",
        lifecycle: "Continue EV operation",
        hash: "SHA-256 BAT0001000000010000250000360000005200000115",
        primaryDriver: "Cycle count",
        confidence: "HIGH",
        telemetry: {
          cycles: 1,
          temp: 25.9,
          volt: 365,
          resistance: 0.052,
          fastCharge: 11.5
        },
        notes: "Factory benchmark digital battery passport."
      });
      console.log("✓ Created initial starter passport for BAT0001.");
    }

    const existingAssessments = await pb.collection("telemetry_assessments").getList(1, 1, { filter: 'batteryId = "BAT0001"' });
    if (existingAssessments.totalItems === 0) {
      await pb.collection("telemetry_assessments").create({
        batteryId: "BAT0001",
        cycles: 1,
        temp: 25.9,
        volt: 365,
        resistance: 0.052,
        fastCharge: 11.5,
        soh: 100.0,
        grade: "A",
        safety: 100,
        thermal: "STABLE",
        mode: "TRAINED",
        factors: [
          { label: "Cycle aging", value: 0, tone: "cyan", direction: "raises" },
          { label: "Fast charging", value: 0, tone: "amber", direction: "raises" },
          { label: "Thermal stress", value: 0, tone: "red", direction: "raises" },
          { label: "Resistance", value: 0, tone: "violet", direction: "raises" }
        ]
      });
      console.log("✓ Created initial starter telemetry assessment for BAT0001.");
    }
  } catch (err) {
    console.warn("! Notice creating starter passport/assessment:", err.message);
  }

  console.log(`\n========================================`);
  console.log(`✓ PocketBase Schema & Seeding Complete!`);
  console.log(`========================================\n`);
}

