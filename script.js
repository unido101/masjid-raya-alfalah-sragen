const donationModal = document.querySelector('#donation-modal');
const registrationModal = document.querySelector('#registration-modal');
const closeModal = (modal) => modal.close();

document.querySelectorAll('.open-donation').forEach((button) => button.addEventListener('click', () => donationModal.showModal()));
document.querySelectorAll('.register-program').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('#program-name').value = button.dataset.program;
  registrationModal.showModal();
}));
document.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', () => closeModal(button.closest('dialog'))));
document.querySelectorAll('dialog').forEach((modal) => modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal(modal);
}));
document.querySelector('.copy-button').addEventListener('click', async (event) => {
  await navigator.clipboard.writeText(event.currentTarget.dataset.copy);
  event.currentTarget.textContent = 'Nomor rekening tersalin';
  setTimeout(() => { event.currentTarget.textContent = 'Salin nomor rekening'; }, 1800);
});
document.querySelector('#registration-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const message = `Assalamu'alaikum, saya ingin mendaftar program *${data.get('program')}*.%0A%0ANama: ${data.get('nama')}%0ANo. WhatsApp: ${data.get('whatsapp')}%0APesan: ${data.get('pesan') || '-'}`;
  window.open(`https://wa.me/6287854429107?text=${message}`, '_blank', 'noopener');
});
const menuButton = document.querySelector('.menu-button');
menuButton.addEventListener('click', () => {
  const links = document.querySelector('.nav-links');
  const open = links.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', open);
});
document.querySelector('#year').textContent = new Date().getFullYear();
