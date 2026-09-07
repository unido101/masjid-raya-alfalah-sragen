import { createHash } from 'node:crypto';

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

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  const va = process.env.IPAYMU_VA;
  const apiKey = process.env.IPAYMU_API_KEY;
  if (!va || !apiKey) {
    return response.status(503).json({ error: 'Pembayaran iPaymu belum dikonfigurasi oleh admin.' });
  }

  const amount = Number(request.body?.amount);
  const buyerName = text(request.body?.name);
  const buyerEmail = text(request.body?.email);
  if (!Number.isInteger(amount) || amount < minimumDonation || !buyerName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return response.status(400).json({ error: `Isi data dengan benar. Donasi minimum Rp${minimumDonation.toLocaleString('id-ID')}.` });
  }

  const referenceId = `ALF-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const origin = originFrom(request);
  const body = {
    product: ['Infaq Masjid Raya Al-Falah Sragen'],
    qty: [1],
    price: [amount],
    buyerName,
    buyerEmail,
    referenceId,
    returnUrl: `${origin}/terima-kasih.html?reference=${encodeURIComponent(referenceId)}`,
    cancelUrl: `${origin}/`,
  };
  const payload = JSON.stringify(body);
  const signature = createHash('sha256').update(`${va}${apiKey}${payload}`).digest('hex');
  const endpoint = process.env.IPAYMU_BASE_URL || 'https://my.ipaymu.com/api/v2/payment';

  try {
    const payment = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', va, signature, timestamp: String(Date.now()) },
      body: payload,
    });
    const result = await payment.json();
    const checkoutUrl = result?.Data?.Url || result?.Data?.url || result?.url;
    if (!payment.ok || !checkoutUrl) {
      console.error('iPaymu checkout rejected', result);
      return response.status(502).json({ error: 'Pembayaran belum dapat dibuat. Silakan coba lagi atau gunakan QRIS.' });
    }
    return response.status(200).json({ checkoutUrl });
  } catch (error) {
    console.error('iPaymu checkout failed', error);
    return response.status(502).json({ error: 'Gagal menghubungi iPaymu. Silakan coba lagi.' });
  }
}
