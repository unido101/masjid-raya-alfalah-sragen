
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "alfalah";

let client;
let clientPromise;

async function getCollection() {
  if (!uri) {
    throw new Error("MONGODB_URI belum dikonfigurasi.");
  }

  if (!clientPromise) {
    client ||= new MongoClient(uri);
    clientPromise = client.connect();
  }

  const connectedClient = await clientPromise;
  return connectedClient.db(dbName).collection("reports");
}

function cleanText(value, maxLength = 1000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.round(amount);
}


function isAdmin(request) {
  const expectedToken = process.env.ADMIN_TOKEN;

  const authorization =
    request.headers.authorization ||
    request.headers.Authorization ||
    "";

  if (!expectedToken || typeof authorization !== "string") {
    return false;
  }

  const prefix = "Bearer ";

  if (!authorization.startsWith(prefix)) {
    return false;
  }

  const suppliedToken = authorization
    .slice(prefix.length)
    .trim();

  return suppliedToken.length > 0 &&
    suppliedToken === expectedToken.trim();
}

function publicReport(report) {
  return {
    id: report._id.toString(),
    title: report.title || "",
    period: report.period || "",
    summary: report.summary || "",
    penerimaan: report.penerimaan || 0,
    penyaluran: report.penyaluran || 0,
    status: report.status,
    createdAt: report.createdAt || null,
    updatedAt: report.updatedAt || null
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") {
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    return response.status(204).end();
  }

  try {
    const collection = await getCollection();


    // GET: admin dapat melihat semua laporan,
    // pengunjung publik hanya melihat laporan terbit.
    if (request.method === "GET") {
      const admin = isAdmin(request);

      const filter = admin
        ? {}
        : { status: "published" };

      const reports = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      return response.status(200).json(
        reports.map(publicReport)
      );
    }

    // Perubahan data hanya untuk admin.
    if (!isAdmin(request)) {
      return response.status(401).json({
        error: "Akses admin tidak valid."
      });
    }

    // POST: membuat laporan baru.
    if (request.method === "POST") {
      const body = request.body || {};
      const title = cleanText(body.title, 150);

      if (!title) {
        return response.status(400).json({
          error: "Judul laporan wajib diisi."
        });
      }

      const now = new Date();

      const report = {
        title,
        period: cleanText(body.period, 100),
        summary: cleanText(body.summary, 2000),
        penerimaan: cleanAmount(body.penerimaan),
        penyaluran: cleanAmount(body.penyaluran),
        status:
          body.status === "published" ? "published" : "draft",
        createdAt: now,
        updatedAt: now
      };

      const result = await collection.insertOne(report);

      return response.status(201).json({
        success: true,
        id: result.insertedId.toString(),
        message: "Laporan berhasil dibuat."
      });
    }

    // PUT: memperbarui laporan.
    if (request.method === "PUT") {
      const id = cleanText(request.query?.id, 100);

      if (!ObjectId.isValid(id)) {
        return response.status(400).json({
          error: "ID laporan tidak valid."
        });
      }

      const body = request.body || {};
      const title = cleanText(body.title, 150);

      if (!title) {
        return response.status(400).json({
          error: "Judul laporan wajib diisi."
        });
      }

      const update = {
        title,
        period: cleanText(body.period, 100),
        summary: cleanText(body.summary, 2000),
        penerimaan: cleanAmount(body.penerimaan),
        penyaluran: cleanAmount(body.penyaluran),
        status:
          body.status === "published" ? "published" : "draft",
        updatedAt: new Date()
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );

      if (!result.matchedCount) {
        return response.status(404).json({
          error: "Laporan tidak ditemukan."
        });
      }

      return response.status(200).json({
        success: true,
        message: "Laporan berhasil diperbarui."
      });
    }

    // DELETE: menghapus laporan.
    if (request.method === "DELETE") {
      const id = cleanText(request.query?.id, 100);

      if (!ObjectId.isValid(id)) {
        return response.status(400).json({
          error: "ID laporan tidak valid."
        });
      }

      const result = await collection.deleteOne({
        _id: new ObjectId(id)
      });

      if (!result.deletedCount) {
        return response.status(404).json({
          error: "Laporan tidak ditemukan."
        });
      }

      return response.status(200).json({
        success: true,
        message: "Laporan berhasil dihapus."
      });
    }

    response.setHeader("Allow", "GET, POST, PUT, DELETE");

    return response.status(405).json({
      error: "Method tidak diizinkan."
    });
  
} catch (error) {
  console.error("Laporan API error:", {
    message: error?.message,
    code: error?.code,
    name: error?.name
  });

  return response.status(500).json({
    error: "Terjadi kesalahan saat memproses laporan.",
    detail: error?.message || "Unknown server error"
  });
}
}