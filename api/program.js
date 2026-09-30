import { MongoClient, ObjectId } from "mongodb";

const minimumDonation = 5000;

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "alfalah";

let client;
let clientPromise;

async function getClient() {
  if (!uri) {
    throw new Error("MONGODB_URI belum dikonfigurasi di Vercel.");
  }

  if (!clientPromise) {
    if (!client) {
      client = new MongoClient(uri);
    }

    clientPromise = client.connect();
  }

  return clientPromise;
}

async function getCollection() {
  const connectedClient = await getClient();

  const db = connectedClient.db(dbName);

  return db.collection("programs");
}

function getAdminToken(request) {
  const authorization =
    request.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function checkAdmin(request) {
  const token = getAdminToken(request);
  const adminToken = process.env.ADMIN_TOKEN;

  return Boolean(
    adminToken &&
    token &&
    token === adminToken
  );
}

function cleanText(value, max = 500) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function cleanNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.round(number);
}

export default async function handler(request, response) {
  response.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  try {
    const collection = await getCollection();

    // =========================
    // GET PROGRAM
    // =========================

    if (request.method === "GET") {
      const programs = await collection
        .find({
          status: {
            $ne: "draft"
          }
        })
        .sort({
          createdAt: -1
        })
        .toArray();

      return response.status(200).json(
        programs.map((program) => ({
          id: program._id.toString(),
          name: program.name || "",
          category: program.category || "",
          description: program.description || "",
          image: program.image || "",
          target: program.target || 0,
          collected: program.collected || 0,
          donors: program.donors || 0,
          status: program.status || "active",
          createdAt: program.createdAt || null,
          updatedAt: program.updatedAt || null
        }))
      );
    }

    // =========================
    // ADMIN CHECK
    // =========================

    if (!checkAdmin(request)) {
      return response.status(401).json({
        error: "Akses admin tidak valid."
      });
    }

    // =========================
    // POST
    // =========================

    if (request.method === "POST") {
      const body = request.body || {};

      const name = cleanText(body.name, 120);

      if (!name) {
        return response.status(400).json({
          error: "Nama program wajib diisi."
        });
      }

      const now = new Date();

      const program = {
        name,

        category: cleanText(
          body.category,
          80
        ),

        description: cleanText(
          body.description,
          1000
        ),

        image: cleanText(
          body.image,
          1000
        ),

        target: cleanNumber(
          body.target
        ),

        collected: cleanNumber(
          body.collected
        ),

        donors: cleanNumber(
          body.donors
        ),

        status:
          body.status === "draft"
            ? "draft"
            : body.status === "inactive"
              ? "inactive"
              : "active",

        createdAt: now,
        updatedAt: now
      };

      const result =
        await collection.insertOne(program);

      return response.status(201).json({
        success: true,
        id: result.insertedId.toString(),
        program: {
          ...program,
          id: result.insertedId.toString()
        }
      });
    }

    // =========================
    // PUT
    // =========================

    if (request.method === "PUT") {
      const id = cleanText(
        request.query?.id,
        100
      );

      if (!ObjectId.isValid(id)) {
        return response.status(400).json({
          error: "ID program tidak valid."
        });
      }

      const body = request.body || {};

      const update = {
        name: cleanText(
          body.name,
          120
        ),

        category: cleanText(
          body.category,
          80
        ),

        description: cleanText(
          body.description,
          1000
        ),

        image: cleanText(
          body.image,
          1000
        ),

        target: cleanNumber(
          body.target
        ),

        collected: cleanNumber(
          body.collected
        ),

        donors: cleanNumber(
          body.donors
        ),

        status:
          body.status === "draft"
            ? "draft"
            : body.status === "inactive"
              ? "inactive"
              : "active",

        updatedAt: new Date()
      };

      if (!update.name) {
        return response.status(400).json({
          error: "Nama program wajib diisi."
        });
      }

      const result =
        await collection.updateOne(
          {
            _id: new ObjectId(id)
          },
          {
            $set: update
          }
        );

      if (!result.matchedCount) {
        return response.status(404).json({
          error: "Program tidak ditemukan."
        });
      }

      return response.status(200).json({
        success: true,
        message: "Program berhasil diperbarui."
      });
    }

    // =========================
    // DELETE
    // =========================

    if (request.method === "DELETE") {
      const id = cleanText(
        request.query?.id,
        100
      );

      if (!ObjectId.isValid(id)) {
        return response.status(400).json({
          error: "ID program tidak valid."
        });
      }

      const result =
        await collection.deleteOne({
          _id: new ObjectId(id)
        });

      if (!result.deletedCount) {
        return response.status(404).json({
          error: "Program tidak ditemukan."
        });
      }

      return response.status(200).json({
        success: true,
        message: "Program berhasil dihapus."
      });
    }

    return response.status(405).json({
      error: "Method tidak diizinkan."
    });

  } catch (error) {
    console.error(
      "Programs API error:",
      error?.message
    );

    console.error(
      "Programs API full error:",
      error
    );

    return response.status(500).json({
      error: "Terjadi kesalahan pada server.",
      detail:
        process.env.NODE_ENV === "development"
          ? error?.message
          : undefined
    });
  }
}