import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "alfalah";

let client;
let clientPromise;

if (!uri) {
  console.error("MONGODB_URI belum dikonfigurasi.");
} else {
  client = new MongoClient(uri);

  clientPromise = client.connect();
}

async function getCollection() {
  if (!clientPromise) {
    throw new Error("MONGODB_URI belum dikonfigurasi.");
  }

  const connectedClient = await clientPromise;

  return connectedClient
    .db(dbName)
    .collection("programs");
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
          name: program.name,
          category: program.category,
          description: program.description,
          image: program.image,
          target: program.target,
          collected: program.collected,
          donors: program.donors,
          status: program.status,
          createdAt: program.createdAt,
          updatedAt: program.updatedAt
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
    // POST PROGRAM
    // =========================

    if (request.method === "POST") {
      const body = request.body || {};

      const name = cleanText(body.name, 120);

      if (!name) {
        return response.status(400).json({
          error: "Nama program wajib diisi."
        });
      }

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

        createdAt: new Date(),
        updatedAt: new Date()
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
    // PUT PROGRAM
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
    // DELETE PROGRAM
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
      error
    );

    return response.status(500).json({
      error: "Terjadi kesalahan pada server."
    });
  }
}