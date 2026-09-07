import { createHash, createHmac } from 'node:crypto';

const minimumDonation = 10000;

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
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');

    return response
      .status(405)
      .json({ error: 'Method tidak diizinkan.' });
  }

  const va = process.env.IPAYMU_VA;
  const apiKey = process.env.IPAYMU_API_KEY;

  if (!va || !apiKey) {
    return response.status(503).json({
      error: 'Pembayaran iPaymu belum dikonfigurasi oleh admin.'
    });
  }

  const amount = Number(request.body?.amount);
  const buyerName = text(request.body?.name);
  const buyerEmail = text(request.body?.email);
  const buyerPhone = text(request.body?.phone);

  if (
    !Number.isInteger(amount) ||
    amount < minimumDonation ||
    !buyerName ||
    !buyerPhone ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)
  ) {
    return response.status(400).json({
      error: `Isi data dengan benar. Donasi minimum Rp${minimumDonation.toLocaleString('id-ID')}.`
    });
  }

  const referenceId =
    `ALF-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

  const origin = originFrom(request);

  const body = {
    name: buyerName,
    phone: buyerPhone,
    email: buyerEmail,
    amount,
    notifyUrl: `${origin}/api/ipaymu-callback`,
    referenceId,
    paymentMethod: 'qris',
    paymentChannel: 'mpm',
    successUrl: `${origin}/terima-kasih.html?reference=${encodeURIComponent(referenceId)}`,
    cancelUrl: `${origin}/`
  };

  const payload = JSON.stringify(body);

  const signature = createSignature({
    method: 'POST',
    va,
    body: payload,
    apiKey
  });

  const timestamp = createTimestamp();

  const baseUrl =
    process.env.IPAYMU_BASE_URL ||
    'https://sandbox.ipaymu.com';

  const endpoint =
    `${baseUrl}/api/v2/payment/direct`;

  try {
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

    const result = await payment.json();

    console.log('iPaymu response:', {
      status: payment.status,
      result
    });

    const checkoutUrl =
      result?.Data?.Url ||
      result?.Data?.url ||
      result?.url;

    if (!payment.ok || !checkoutUrl) {
      console.error(
        'iPaymu checkout rejected:',
        result
      );

      return response.status(502).json({
        error:
          result?.Message ||
          result?.message ||
          'Pembayaran belum dapat dibuat. Silakan coba lagi.'
      });
    }

    return response.status(200).json({
      checkoutUrl,
      referenceId
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