
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DB_NAME = "alfalah";

let cachedClient = global.mongoClient || null;

async function getDb() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI belum diatur");
  }

  if (!cachedClient) {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    cachedClient = client;
    global.mongoClient = client;
  }

  return cachedClient.db(DB_NAME);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Mengubah tanggal YYYY-MM-DD menjadi awal hari WIB.
function startOfWibDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getTodayWibStart() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - 7 * 60 * 60 * 1000);
}

function getDateFilter(query) {
  const filter = {};

  if (query.from) {
    const from = startOfWibDay(query.from);
    if (!from) throw new Error("Format tanggal mulai tidak valid");
    filter.$gte = from;
  }

  if (query.to) {
    const to = startOfWibDay(query.to);
    if (!to) throw new Error("Format tanggal akhir tidak valid");

    const exclusiveEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    filter.$lt = exclusiveEnd;
  }

  return Object.keys(filter).length ? filter : null;
}

function buildDonationFilter(query) {
  const filter = {};
  const dateFilter = getDateFilter(query);

  if (dateFilter) filter.createdAt = dateFilter;

  if (query.program) {
    filter.program = {
      $regex: escapeRegex(query.program),
      $options: "i",
    };
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const search = escapeRegex(query.search);

    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { whatsapp: { $regex: search, $options: "i" } },
      { program: { $regex: search, $options: "i" } },
    ];
  }

  return filter;
}

function donorKeyExpression() {
  return {
    $cond: [
      {
        $and: [
          { $ne: [{ $ifNull: ["$whatsapp", ""] }, ""] },
        ],
      },
      "$whatsapp",
      {
        $concat: [
          "nama:",
          { $ifNull: ["$name", "Tanpa nama"] },
        ],
      },
    ],
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method tidak diizinkan",
    });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak. Silakan login sebagai admin.",
    });
  }

  try {
    const db = await getDb();
    const donations = db.collection("donations");
    const query = req.query || {};
    const view = query.view || "summary";

    // RINGKASAN DASHBOARD
    if (view === "summary") {
      const todayStart = getTodayWibStart();

      const [total, nominal, today, donorCount] = await Promise.all([
        donations.countDocuments({}),
        donations.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ["$amount", 0] } },
            },
          },
        ]).toArray(),
        donations.countDocuments({
          createdAt: { $gte: todayStart },
        }),
        donations.aggregate([
          { $group: { _id: donorKeyExpression() } },
          { $count: "total" },
        ]).toArray(),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          totalReports: total,
          totalReportedAmount: nominal[0]?.total || 0,
          reportsToday: today,
          uniqueDonors: donorCount[0]?.total || 0,
        },
        note: "Nominal merupakan laporan sedekah dari donatur, belum diverifikasi.",
      });
    }

    // DAFTAR LAPORAN DONASI
    if (view === "donations") {
      const filter = buildDonationFilter(query);
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        donations.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .project({
            name: 1,
            whatsapp: 1,
            program: 1,
            amount: 1,
            status: 1,
            createdAt: 1,
          })
          .toArray(),
        donations.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // DATABASE DONATUR
    if (view === "donors") {
      const filter = buildDonationFilter(query);
      delete filter.$or;

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: donorKeyExpression(),
            name: { $last: "$name" },
            whatsapp: { $last: "$whatsapp" },
            totalReportedAmount: {
              $sum: { $ifNull: ["$amount", 0] },
            },
            donationCount: { $sum: 1 },
            lastDonation: { $max: "$createdAt" },
            programs: { $addToSet: "$program" },
          },
        },
      ];

      if (query.search) {
        const search = escapeRegex(query.search);
        pipeline.push({
          $match: {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { whatsapp: { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      const page = Math.max(1, parseInt(query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

      const [items, countResult] = await Promise.all([
        donations.aggregate([
          ...pipeline,
          { $sort: { lastDonation: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ]).toArray(),
        donations.aggregate([
          ...pipeline,
          { $count: "total" },
        ]).toArray(),
      ]);

      const total = countResult[0]?.total || 0;

      return res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // RIWAYAT SATU DONATUR
    if (view === "donor") {
      const whatsapp = String(query.whatsapp || "").trim();

      if (!whatsapp) {
        return res.status(400).json({
          success: false,
          message: "Nomor WhatsApp wajib diisi",
        });
      }

      const items = await donations.find({ whatsapp })
        .sort({ createdAt: -1 })
        .project({
          name: 1,
          whatsapp: 1,
          program: 1,
          amount: 1,
          status: 1,
          createdAt: 1,
        })
        .toArray();

      const totalReportedAmount = items.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0
      );

      return res.status(200).json({
        success: true,
        data: {
          whatsapp,
          name: items[0]?.name || "",
          donationCount: items.length,
          totalReportedAmount,
          history: items,
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: "Jenis tampilan tidak dikenal",
    });

  } catch (error) {
    console.error("Admin donations API error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};
