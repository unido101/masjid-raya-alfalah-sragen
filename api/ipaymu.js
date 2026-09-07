import { createHash, createHmac } from 'node:crypto';

const minimumDonation = 5000;

function text(value, maximum = 120) {
  return String(value || '').trim().slice(0, maximum);
}

function originFrom(request) {
  const forwardedHost = request.headers['x-forwarded-host'];
  const host = forwardedHost || request.headers.host;
  const protocol = request.headers['x-forwarded-proto'] || 'https';

  return `${protocol}://${host}`;
}

function createTimestamp() {
  const now = new Date();

  const pad = (value) => String(value).padStart(2, '0');

  return (
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

function createSignature({ method, va, body, apiKey }) {
  const bodyHash = createHash('sha256')
    .update(body)
    .digest('hex');

  const stringToSign =
    `${method}:${va}:${bodyHash}:${apiKey}`;

  return createHmac('sha256', apiKey)
    .update(stringToSign)
    .digest('hex');
}

export default async function handler(request, response) {
  // Only allow POST
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');

    return response.status(405).json({
      error: 'Method tidak diizinkan.'
    });
  }

  // Get iPaymu credentials
  const va = process.env.IPAYMU_VA;
  const apiKey = process.env.IPAYMU_API_KEY;

  if (!va || !apiKey) {
    return response.status(503).json({
      error: 'Pembayaran iPaymu belum dikonfigurasi oleh admin.'
    });
  }

  // Get request data
  const amount = Number(request.body?.amount);
  const buyerName = text(request.body?.name);
  const buyerEmail = text(request.body?.email);
  const buyerPhone = text(request.body?.phone);

  // Validate amount
  if (!Number.isInteger(amount)) {
    return response.status(400).json({
      error: 'Nominal donasi harus berupa angka.'
    });
  }

  // Validate minimum donation
  if (amount < minimumDonation) {
    return response.status(400).json({
      error: `Donasi minimum Rp${minimumDonation.toLocaleString('id-ID')}.`
    });
  }

  // Validate name
  if (!buyerName) {
    return response.status(400).json({
      error: 'Nama wajib diisi.'
    });
  }

  // Validate phone
  if (!buyerPhone) {
    return response.status(400).json({
      error: 'Nomor WhatsApp wajib diisi.'
    });
  }

  // Validate email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return response.status(400).json({
      error: 'Format email tidak valid.'
    });
  }

  // Generate unique reference ID
  const referenceId =
    `ALF-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

  // Get application origin
  const origin = originFrom(request);

  // iPaymu request body
  const body = {
    name: buyerName,
    phone: buyerPhone,
    email: buyerEmail,
    amount,

    notifyUrl:
      `${origin}/api/ipaymu-callback`,

    referenceId,

    paymentMethod: 'qris',
    paymentChannel: 'mpm',

    successUrl:
      `${origin}/terima-kasih.html?reference=${encodeURIComponent(referenceId)}`,

    cancelUrl:
      `${origin}/`
  };

  // Convert body to JSON
  const payload = JSON.stringify(body);

  // Generate iPaymu signature
  const signature = createSignature({
    method: 'POST',
    va,
    body: payload,
    apiKey
  });

  // Generate timestamp
  const timestamp = createTimestamp();

  // iPaymu base URL
  const baseUrl =
    process.env.IPAYMU_BASE_URL ||
    'https://sandbox.ipaymu.com';

  // Direct Payment endpoint
  const endpoint =
    `${baseUrl}/api/v2/payment/direct`;

  try {
    console.log('Sending payment request to iPaymu:', {
      endpoint,
      amount,
      referenceId,
      paymentMethod: 'qris',
      paymentChannel: 'mpm'
    });

    const payment = await fetch(endpoint, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        va,
        signature,
        timestamp
      },

      body: payload
    });

    // Read iPaymu response
    const result = await payment.json();

    console.log('iPaymu response:', {
      status: payment.status,
      result
    });

    console.log(
      'iPaymu FULL RESULT:',
      JSON.stringify(result, null, 2)
    );

    // Get QRIS data from iPaymu
    const data = result?.Data;

    const qrImage =
      data?.QrImage ||
      data?.qrImage ||
      null;

    const qrTemplate =
      data?.QrTemplate ||
      data?.qrTemplate ||
      null;

    const transactionId =
      data?.TransactionId ||
      data?.transactionId ||
      null;

    const sessionId =
      data?.SessionId ||
      data?.sessionId ||
      null;

    const paymentNo =
      data?.PaymentNo ||
      data?.paymentNo ||
      null;

    const expired =
      data?.Expired ||
      data?.expired ||
      null;

    // Check iPaymu response
    if (!payment.ok || !result?.Success || !qrImage) {
      console.error(
        'iPaymu payment rejected:',
        result
      );

      return response.status(502).json({
        error:
          result?.Message ||
          result?.message ||
          'Pembayaran belum dapat dibuat. Silakan coba lagi.'
      });
    }

    // Payment successfully created
    console.log('iPaymu QRIS created successfully:', {
      referenceId,
      transactionId,
      sessionId,
      qrImage,
      qrTemplate,
      expired
    });

    return response.status(200).json({
      success: true,

      referenceId,

      transactionId,
      sessionId,

      paymentMethod: 'qris',
      paymentChannel: 'mpm',

      qrImage,
      qrTemplate,

      paymentNo,
      expired,

      message: 'QRIS berhasil dibuat.'
    });

  } catch (error) {
    console.error(
      'iPaymu checkout failed:',
      error
    );

    return response.status(502).json({
      error:
        'Gagal menghubungi iPaymu. Silakan coba lagi.'
    });
  }
}