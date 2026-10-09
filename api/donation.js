
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "alfalah";

let client;
let clientPromise;

async function getClient() {
  if (!uri) {
    throw new Error("MONGODB_URI belum dikonfigurasi.");
  }

  if (!clientPromise) {
    if (!client) {
      client = new MongoClient(uri);
    }
    clientPromise = client.connect();
  }

  return clientPromise;
}

function cleanText(value, maxLength = 150) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizePhone(value) {
  return cleanText(value, 25).replace(/[^\d+]/g, "");
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({
      success: false,
      error: "Method tidak diizinkan."
    });
  }

  const body = request.body || {};

  const name = cleanText(body.name, 100);
  const whatsapp = normalizePhone(body.whatsapp);
  const programName = cleanText(body.program, 120);
  const amount = Number(body.amount);

  if (!name || !whatsapp || !programName) {
    return response.status(400).json({
      success: false,
      error: "Nama, nomor WhatsApp, dan program wajib diisi."
    });
  }

  if (!/^\+?\d{9,20}$/.test(whatsapp)) {
    return response.status(400).json({
      success: false,
      error: "Nomor WhatsApp tidak valid."
    });
  }

  if (
    !Number.isSafeInteger(amount) ||
    amount < 5000 ||
    amount > 1000000000
  ) {
    return response.status(400).json({
      success: false,
      error: "Nominal harus antara Rp5.000 dan Rp1.000.000.000."
    });
  }

  let session;

  try {
    const connectedClient = await getClient();
    const db = connectedClient.db(dbName);

    const programs = db.collection("programs");
    const donations = db.collection("donations");

    // Cari program aktif dengan nama yang sama.
    const program = await programs.findOne({
      name: programName,
      status: { $nin: ["draft", "inactive"] }
    });

    if (!program) {
      return response.status(404).json({
        success: false,
        error: "Program tidak ditemukan atau sedang tidak aktif."
      });
    }

    session = connectedClient.startSession();

    const donationId = new ObjectId();
    const now = new Date();

    await session.withTransaction(async () => {
      // Catat laporan sedekah.
      await donations.insertOne(
        {
          _id: donationId,
          programId: program._id,
          program: program.name,
          name,
          whatsapp,
          amount,
          status: "reported",
          createdAt: now
        },
        { session }
      );

      // Tambahkan dana dan jumlah donatur secara atomik.
      const updateResult = await programs.updateOne(
        {
          _id: program._id,
          status: { $nin: ["draft", "inactive"] }
        },
        {
          $inc: {
            collected: amount,
            donors: 1
          },
          $set: {
            updatedAt: now
          }
        },
        { session }
      );

      if (updateResult.matchedCount !== 1) {
        throw new Error("Program tidak dapat diperbarui.");
      }
    });

    return response.status(201).json({
      success: true,
      message: "Laporan sedekah berhasil disimpan.",
      donationId: donationId.toString(),
      amount,
      program: program.name
    });
  } catch (error) {
    console.error("Donation API error:", error?.message);

    return response.status(500).json({
      success: false,
      error: "Sedekah belum berhasil disimpan. Silakan coba kembali."
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}