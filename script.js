const donationModal = document.querySelector('#donation-modal');
const registrationModal = document.querySelector('#registration-modal');

const closeModal = (modal) => modal.close();

document.querySelectorAll('.open-donation').forEach((button) => {
  button.addEventListener('click', () => {
    donationModal.showModal();
  });
});

document.querySelectorAll('.register-program').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('#program-name').value = button.dataset.program;
    registrationModal.showModal();
  });
});

document.querySelectorAll('.modal-close').forEach((button) => {
  button.addEventListener('click', () => {
    closeModal(button.closest('dialog'));
  });
});

document.querySelectorAll('dialog').forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

document.querySelector('.copy-button').addEventListener('click', async (event) => {
  await navigator.clipboard.writeText(event.currentTarget.dataset.copy);

  event.currentTarget.textContent = 'Nomor rekening tersalin';

  setTimeout(() => {
    event.currentTarget.textContent = 'Salin nomor rekening';
  }, 1800);
});


// ========================================
// REGISTRATION FORM
// ========================================

document
  .querySelector('#registration-form')
  .addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    const message =
      `Assalamu'alaikum, saya ingin mendaftar program *${data.get('program')}*.%0A%0A` +
      `Nama: ${data.get('nama')}%0A` +
      `No. WhatsApp: ${data.get('whatsapp')}%0A` +
      `Pesan: ${data.get('pesan') || '-'}`;

    window.open(
      `https://wa.me/6287854429107?text=${message}`,
      '_blank',
      'noopener'
    );
  });


// ========================================
// IPAYMU PAYMENT
// ========================================

document
  .querySelector('#ipaymu-form')
  .addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    const button = form.querySelector(
      'button[type="submit"]'
    );

    const feedback = document.querySelector(
      '#ipaymu-feedback'
    );

    button.disabled = true;
    button.textContent = 'Menyiapkan QRIS…';
    feedback.textContent = '';

    try {
      const payment = await fetch('/api/ipaymu', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(
          Object.fromEntries(
            new FormData(form)
          )
        )
      });

      const result = await payment.json();

      console.log('iPaymu frontend result:', result);

      if (!payment.ok) {
        throw new Error(
          result.error ||
          'Pembayaran belum dapat dibuat.'
        );
      }

      // ====================================
      // QRIS BERHASIL DIBUAT
      // ====================================

      if (!result.qrImage) {
        throw new Error(
          'QRIS berhasil dibuat, tetapi gambar QR tidak ditemukan.'
        );
      }

      // Tampilkan halaman QRIS
      showQrisPayment(result);

    } catch (error) {

      console.error(
        'iPaymu frontend error:',
        error
      );

      feedback.textContent = error.message;

      button.disabled = false;
      button.textContent = 'Lanjut ke iPaymu';
    }
  });


// ========================================
// SHOW QRIS PAYMENT
// ========================================

function showQrisPayment(payment) {

  const formSection =
    document.querySelector('.payment-option.ipaymu');

  if (!formSection) {
    return;
  }

  // Sembunyikan form
  const form =
    document.querySelector('#ipaymu-form');

  form.style.display = 'none';

  // Hapus QRIS sebelumnya jika ada
  const existing =
    document.querySelector('#ipaymu-qris-result');

  if (existing) {
    existing.remove();
  }

  // Buat tampilan QRIS
  const qrisContainer =
    document.createElement('div');

  qrisContainer.id =
    'ipaymu-qris-result';

  qrisContainer.innerHTML = `
    <div class="ipaymu-qris-result">

      <h3>Scan QRIS</h3>

      <p>
        Silakan scan QRIS berikut menggunakan
        aplikasi pembayaran Anda.
      </p>

      <div class="ipaymu-qris-image">
        <img
          src="${payment.qrImage}"
          alt="QRIS pembayaran donasi"
        />
      </div>

      <div class="ipaymu-payment-info">

        <p>
          <strong>Nominal</strong><br>
          Rp${Number(
            form.querySelector('[name="amount"]').value
          ).toLocaleString('id-ID')}
        </p>

        <p>
          <strong>ID Transaksi</strong><br>
          ${payment.transactionId || '-'}
        </p>

        <p>
          <strong>Reference</strong><br>
          ${payment.referenceId || '-'}
        </p>

        <p>
          <strong>Berlaku sampai</strong><br>
          ${payment.expired || '-'}
        </p>

      </div>

      <p class="ipaymu-qris-note">
        Jangan tutup halaman ini sebelum pembayaran selesai.
      </p>

      <button
        type="button"
        class="button button-full"
        id="ipaymu-back-button"
      >
        Kembali
      </button>

    </div>
  `;

  formSection.appendChild(qrisContainer);

  // Tombol kembali
  document
    .querySelector('#ipaymu-back-button')
    .addEventListener('click', () => {

      qrisContainer.remove();

      form.reset();

      form.style.display = '';

      const button =
        form.querySelector(
          'button[type="submit"]'
        );

      button.disabled = false;
      button.textContent =
        'Lanjut ke iPaymu';

      const feedback =
        document.querySelector(
          '#ipaymu-feedback'
        );

      feedback.textContent = '';
    });
}


// ========================================
// MOBILE MENU
// ========================================

const menuButton =
  document.querySelector('.menu-button');

menuButton.addEventListener('click', () => {

  const links =
    document.querySelector('.nav-links');

  const open =
    links.classList.toggle('is-open');

  menuButton.setAttribute(
    'aria-expanded',
    open
  );
});


// ========================================
// YEAR
// ========================================

document.querySelector('#year').textContent =
  new Date().getFullYear();