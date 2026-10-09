


const donationModal = document.querySelector("#donation-modal");
const registrationModal = document.querySelector("#registration-modal");

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".open-donation");
  if (!button) return;

  const programInput = document.querySelector("#donation-program");
  const formStep = document.querySelector("#donation-form-step");
  const paymentStep = document.querySelector("#donation-payment-step");
  const successStep = document.querySelector("#donation-success-step");
  const errorBox = document.querySelector("#donation-submit-error");
  const updateButton = document.querySelector("#update-donation-button");

  if (!programInput) {
    alert("Kolom program sedekah belum tersedia.");
    return;
  }

  // Tombol pada kartu program membawa nama program.
  let selectedProgram = button.dataset.program || "";

  // Jika tombol berasal dari hero/header, cari program aktif pertama.
  if (!selectedProgram) {
    try {
      const response = await fetch("/api/program");
      if (!response.ok) throw new Error("Gagal mengambil daftar program.");

      const result = await response.json();
      const programs = Array.isArray(result)
        ? result
        : result.programs || [];

      const activePrograms = programs.filter(
        (program) =>
          program.status !== "draft" &&
          program.status !== "inactive"
      );

      selectedProgram = activePrograms[0]?.name || "";
    } catch (error) {
      console.error("Gagal memuat program sedekah:", error);
    }
  }

  if (!selectedProgram) {
    alert("Belum ada program sedekah aktif. Silakan coba lagi nanti.");
    return;
  }

  programInput.value = selectedProgram;

  formStep.hidden = false;
  paymentStep.hidden = true;
  successStep.hidden = true;
  errorBox.hidden = true;

  const form = document.querySelector("#donation-form");
  form?.reset();

  // Isi kembali nama program setelah formulir di-reset.
  programInput.value = selectedProgram;

  if (updateButton) {
    updateButton.disabled = false;
    updateButton.textContent = "Update Sedekah";
  }

  donationModal?.showModal();
});
// ========================================
// PENDAFTARAN PROGRAM
// ========================================

document.addEventListener("click", (event) => {
  const button = event.target.closest(".register-program");

  if (!button) return;

  const programInput = document.querySelector("#program-name");

  if (programInput) {
    programInput.value = button.dataset.program || "";
  }

  registrationModal?.showModal();
});

// ========================================
// TUTUP MODAL
// ========================================

document.querySelectorAll(".modal-close").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest("dialog")?.close();
  });
});

document.querySelectorAll("dialog").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.close();
    }
  });
});

// ========================================
// SALIN NOMOR REKENING
// ========================================

document.querySelector(".copy-button")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const accountNumber = button.dataset.copy || "";

  try {
    await navigator.clipboard.writeText(accountNumber);
    button.textContent = "✓ Nomor berhasil disalin";
  } catch (error) {
    console.error("Gagal menyalin nomor rekening:", error);
    button.textContent = accountNumber;
  }

  setTimeout(() => {
    button.textContent = "Salin nomor rekening";
  }, 2000);
});


/* ========================================
   ALUR DONASI
======================================== */

let pendingDonation = null;

const donationForm = document.querySelector("#donation-form");
const customAmountInput = document.querySelector("#donation-custom-amount");
const paymentStep = document.querySelector("#donation-payment-step");
const successStep = document.querySelector("#donation-success-step");
const formStep = document.querySelector("#donation-form-step");
const updateDonationButton = document.querySelector("#update-donation-button");
const donationError = document.querySelector("#donation-submit-error");

const formatDonationRupiah = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);

// Jika nominal pilihan ditekan, kosongkan nominal custom.
document.querySelectorAll('input[name="nominal"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (input.checked && customAmountInput) {
      customAmountInput.value = "";
    }
  });
});

// Jika nominal custom diisi, batalkan pilihan nominal tetap.
customAmountInput?.addEventListener("input", () => {
  if (customAmountInput.value) {
    document.querySelectorAll('input[name="nominal"]').forEach((input) => {
      input.checked = false;
    });
  }
});

// Tahap 1: validasi data dan tampilkan cara pembayaran.
donationForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(donationForm);
  const selectedNominal = formData.get("nominal");
  const customNominal = customAmountInput?.value;

  const amount = customNominal
    ? Number(customNominal)
    : Number(selectedNominal);

  const name = String(formData.get("nama") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim();
  const program = String(formData.get("program") || "").trim();

  if (!program) {
    alert("Pilih program sedekah terlebih dahulu.");
    return;
  }

  if (!name || !whatsapp) {
    alert("Nama dan nomor WhatsApp wajib diisi.");
    return;
  }

  if (!Number.isSafeInteger(amount) || amount < 5000) {
    alert("Nominal sedekah minimal Rp5.000.");
    return;
  }

  pendingDonation = {
    name,
    whatsapp,
    program,
    amount
  };

  document.querySelector("#donation-payment-amount").textContent =
    formatDonationRupiah(amount);

  formStep.hidden = true;
  paymentStep.hidden = false;
  successStep.hidden = true;
  donationError.hidden = true;
});

// Tahap 2: simpan laporan sedekah melalui API backend.
updateDonationButton?.addEventListener("click", async () => {
  if (!pendingDonation) {
    donationError.textContent = "Silakan isi formulir sedekah terlebih dahulu.";
    donationError.hidden = false;
    return;
  }

  updateDonationButton.disabled = true;
  updateDonationButton.textContent = "Menyimpan sedekah...";
  donationError.hidden = true;

  try {
    const response = await fetch("/api/donation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(pendingDonation)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.error || "Sedekah belum berhasil disimpan. Silakan coba lagi."
      );
    }

    // Tampilkan ucapan hanya setelah server menyatakan penyimpanan berhasil.
    paymentStep.hidden = true;
    successStep.hidden = false;

    const adminButton = document.querySelector("#donation-admin-whatsapp");
    const adminMessage = [
      "Assalamu'alaikum Admin Baitul Maal Al-Falah.",
      "Saya telah mengisi laporan sedekah melalui website.",
      "",
      `Nama: ${pendingDonation.name}`,
      `Program: ${pendingDonation.program}`,
      `Nominal: ${formatDonationRupiah(pendingDonation.amount)}`,
      "",
      "Mohon informasi jika diperlukan. Terima kasih."
    ].join("\n");

    if (adminButton) {
      adminButton.href =
        `https://wa.me/6287854429107?text=${encodeURIComponent(adminMessage)}`;
    }

    // Perbarui kartu program agar total terbaru dapat terlihat.
    if (typeof loadPrograms === "function") {
      await loadPrograms();
    }
  } catch (error) {
    donationError.textContent =
      error.message || "Terjadi kesalahan saat menyimpan sedekah.";
    donationError.hidden = false;
  } finally {
    updateDonationButton.disabled = false;
    updateDonationButton.textContent = "Update Sedekah";
  }
});

// ========================================
// WHATSAPP PENDAFTARAN
// ========================================

document.querySelector("#registration-form")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  const message = [
    "Assalamu'alaikum, saya ingin mendaftar program:",
    form.get("program"),
    "",
    `Nama: ${form.get("nama")}`,
    `No. WhatsApp: ${form.get("whatsapp")}`,
    `Pesan: ${form.get("pesan") || "-"}`
  ].join("\n");

  const url = `https://wa.me/6287854429107?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank", "noopener,noreferrer");
});

// ========================================
// MENU MOBILE
// ========================================

const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector(".nav-links");

menuButton?.addEventListener("click", () => {
  const isOpen = navLinks?.classList.toggle("is-open") || false;
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

// ========================================
// TAHUN FOOTER
// ========================================

const yearElement = document.querySelector("#year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// ========================================
// PROGRAM DARI MONGODB
// ========================================

async function loadPrograms() {
  const container = document.querySelector(".program-grid");
  if (!container) return;

  const formatRupiah = (value) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Math.max(0, Number(value) || 0));

  try {
    const response = await fetch("/api/program", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`API program gagal: ${response.status}`);
    }

    const programs = await response.json();

    if (!Array.isArray(programs)) {
      throw new Error("Format data program tidak valid.");
    }

    const visiblePrograms = programs.filter((program) => {
      const status = String(program.status || "active").toLowerCase();
      return status === "active";
    });

    container.replaceChildren();

    if (visiblePrograms.length === 0) {
      const empty = document.createElement("p");
      empty.className = "program-empty";
      empty.textContent = "Belum ada program donasi aktif saat ini.";
      container.appendChild(empty);
      return;
    }

    visiblePrograms.forEach((program) => {
      const name = program.name || "Program Kebaikan Al-Falah";
      const target = Math.max(0, Number(program.target) || 0);
      const collected = Math.max(0, Number(program.collected) || 0);
      const donors = Math.max(0, Number(program.donors) || 0);
      const progress = target > 0
        ? Math.min(100, Math.round((collected / target) * 100))
        : 0;

      const article = document.createElement("article");
      article.className = "program-card donation-card";

      // Foto program
      const media = document.createElement("div");
      media.className = "donation-card-media";

      if (program.image) {
        const image = document.createElement("img");
        image.src = program.image;
        image.alt = name;
        image.loading = "lazy";
        image.decoding = "async";

        image.addEventListener("error", () => {
          image.remove();
          media.classList.add("no-image");
          media.textContent = "Masjid Raya Al-Falah";
        }, { once: true });

        media.appendChild(image);
      } else {
        media.classList.add("no-image");
        media.textContent = "Masjid Raya Al-Falah";
      }

      const category = document.createElement("span");
      category.className = "program-type";
      category.textContent = program.category || "Program Kebaikan";

      const title = document.createElement("h3");
      title.textContent = name;

      const description = document.createElement("p");
      description.className = "donation-card-description";
      description.textContent =
        program.description || "Mari bersama mendukung program kebaikan ini.";

      const progressSection = document.createElement("div");
      progressSection.className = "donation-progress";

      const amountRow = document.createElement("div");
      amountRow.className = "donation-amount-row";

      const collectedBlock = document.createElement("div");
      const collectedLabel = document.createElement("span");
      collectedLabel.textContent = "Dana terkumpul";
      const collectedAmount = document.createElement("strong");
      collectedAmount.textContent = formatRupiah(collected);
      collectedBlock.append(collectedLabel, collectedAmount);

      const targetBlock = document.createElement("div");
      targetBlock.className = "donation-target";
      const targetLabel = document.createElement("span");
      targetLabel.textContent = "Target dana";
      const targetAmount = document.createElement("strong");
      targetAmount.textContent = target > 0
        ? formatRupiah(target)
        : "Belum ditentukan";
      targetBlock.append(targetLabel, targetAmount);

      amountRow.append(collectedBlock, targetBlock);

      const progressTrack = document.createElement("div");
      progressTrack.className = "donation-progress-track";
      progressTrack.setAttribute("role", "progressbar");
      progressTrack.setAttribute("aria-label", `Progres ${name}`);
      progressTrack.setAttribute("aria-valuemin", "0");
      progressTrack.setAttribute("aria-valuemax", "100");
      progressTrack.setAttribute("aria-valuenow", String(progress));

      const progressBar = document.createElement("div");
      progressBar.className = "donation-progress-bar";
      progressBar.style.width = `${progress}%`;
      progressTrack.appendChild(progressBar);

      const meta = document.createElement("div");
      meta.className = "donation-card-meta";

      const progressLabel = document.createElement("span");
      progressLabel.textContent = target > 0
        ? `${progress}% dari target`
        : "Target belum ditentukan";

      const donorLabel = document.createElement("span");
      donorLabel.textContent = `${donors.toLocaleString("id-ID")} donatur`;

      meta.append(progressLabel, donorLabel);
      progressSection.append(amountRow, progressTrack, meta);

      const actions = document.createElement("div");
      actions.className = "card-actions donation-card-actions";

      const donateButton = document.createElement("button");
      donateButton.type = "button";
      donateButton.className = "button open-donation";
      donateButton.dataset.program = name;
      donateButton.textContent = "Donasi Sekarang →";

      actions.appendChild(donateButton);

      article.append(
        media,
        category,
        title,
        description,
        progressSection,
        actions
      );

      container.appendChild(article);
    });
  } catch (error) {
    console.error("Gagal memuat program dari database:", error);
    // Konten bawaan HTML tidak dihapus jika API gagal.
  }
}

loadPrograms();

/* ========================================
   LAPORAN PUBLIK DARI MONGODB
======================================== */

async function loadPublicReports() {
  const container = document.querySelector("#reports-list");
  const statusElement = document.querySelector("#reports-status");

  if (!container) return;

  const formatRupiah = (amount) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);

  try {
    const response = await fetch("/api/laporan", {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Gagal mengambil laporan: ${response.status}`);
    }

    const reports = await response.json();

    if (!Array.isArray(reports)) {
      throw new Error("Format data laporan tidak valid.");
    }

    container.replaceChildren();

    if (reports.length === 0) {
      const emptyCard = document.createElement("article");
      emptyCard.className = "report-card";

      const title = document.createElement("h3");
      title.textContent = "Belum ada laporan";

      const description = document.createElement("p");
      description.textContent =
        "Laporan akan ditampilkan di sini setelah dipublikasikan.";

      const badge = document.createElement("span");
      badge.className = "status";
      badge.textContent = "Menunggu publikasi";

      emptyCard.append(title, description, badge);
      container.appendChild(emptyCard);

      if (statusElement) {
        statusElement.textContent =
          "Belum ada laporan yang dipublikasikan.";
      }

      return;
    }

    reports.forEach((report) => {
      const card = document.createElement("article");
      card.className = "report-card";

      const icon = document.createElement("span");
      icon.className = "report-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "▤";

      const title = document.createElement("h3");
      title.textContent = report.title || "Laporan kegiatan";

      const period = document.createElement("p");
      period.textContent = report.period
        ? `Periode: ${report.period}`
        : "";

      const summary = document.createElement("p");
      summary.textContent =
        report.summary || "Ringkasan laporan belum tersedia.";

      const income = document.createElement("p");
      income.textContent =
        `Penerimaan: ${formatRupiah(report.penerimaan)}`;

      const distribution = document.createElement("p");
      distribution.textContent =
        `Penyaluran: ${formatRupiah(report.penyaluran)}`;

      const badge = document.createElement("span");
      badge.className = "status";
      badge.textContent = "Telah dipublikasikan";

      card.append(
        icon,
        title,
        period,
        summary,
        income,
        distribution,
        badge
      );

      container.appendChild(card);
    });

    if (statusElement) {
      statusElement.textContent =
        `${reports.length} laporan berhasil ditampilkan.`;
    }
  } catch (error) {
    console.error("Gagal memuat laporan publik:", error);

    container.replaceChildren();

    const errorCard = document.createElement("article");
    errorCard.className = "report-card";

    const title = document.createElement("h3");
    title.textContent = "Laporan belum dapat dimuat";

    const description = document.createElement("p");
    description.textContent =
      "Silakan coba kembali beberapa saat lagi.";

    errorCard.append(title, description);
    container.appendChild(errorCard);

    if (statusElement) {
      statusElement.textContent =
        "Terjadi kendala saat mengambil laporan.";
    }
  }
}

loadPublicReports();