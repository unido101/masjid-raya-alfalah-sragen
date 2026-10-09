
const donationModal = document.querySelector("#donation-modal");
const registrationModal = document.querySelector("#registration-modal");

// ========================================
// MODAL DONASI
// ========================================

document.querySelectorAll(".open-donation").forEach((button) => {
  button.addEventListener("click", () => {
    donationModal?.showModal();
  });
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

  try {
    const response = await fetch("/api/program", {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`API program gagal: ${response.status}`);
    }

    const programs = await response.json();

    if (!Array.isArray(programs) || programs.length === 0) {
      console.info("Belum ada program aktif dari database.");
      return;
    }

    const visiblePrograms = programs.filter((program) => {
      const status = String(program.status || "active").toLowerCase();
      return status === "active";
    });

    if (visiblePrograms.length === 0) {
      console.info("Belum ada program aktif yang dipublikasikan.");
      return;
    }

    container.replaceChildren();

    visiblePrograms.forEach((program, index) => {
      const article = document.createElement("article");
      article.className = `program-card${index === 1 ? " featured" : ""}`;

      const icon = document.createElement("div");
      icon.className = "program-icon";
      icon.textContent = "✦";

      const category = document.createElement("p");
      category.className = "program-type";
      category.textContent = program.category || "Program Al-Falah";

      const title = document.createElement("h3");
      title.textContent = program.name || "Program Masjid";

      const description = document.createElement("p");
      description.textContent =
        program.description || "Mari bersama mendukung program kebaikan ini.";

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const registerButton = document.createElement("button");
      registerButton.type = "button";
      registerButton.className = "text-link register-program";
      registerButton.dataset.program = program.name || "Program Al-Falah";
      registerButton.textContent = "Daftar program →";

      const donateButton = document.createElement("button");
      donateButton.type = "button";
      donateButton.className = "button-quiet open-donation";
      donateButton.dataset.program = program.name || "Program Al-Falah";
      donateButton.textContent = "Dukung program";

      actions.append(registerButton, donateButton);
      article.append(icon, category, title, description, actions);
      container.appendChild(article);
    });
  } catch (error) {
    // Jika API gagal, kartu bawaan di HTML tetap ditampilkan.
    console.error("Gagal memuat program dari database:", error);
  }
}

loadPrograms();