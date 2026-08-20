const bootScreen = document.querySelector('#boot-screen');
const bootLine = document.querySelector('#boot-line');
const roleElement = document.querySelector('#typing-role');
const asciiArt = document.querySelector('.ascii-art');
const roles = ['Java Developer', 'Backend Developer', 'Computer Science Student', 'Problem Solver'];
let roleIndex = 0;
let characterIndex = 0;
let deleting = false;

asciiArt.textContent = asciiArt.textContent.replace('▯', '⣿').replace('ⴾ', '⣴⣾');

const typeRole = () => {
  const currentRole = roles[roleIndex];
  roleElement.textContent = deleting
    ? currentRole.slice(0, characterIndex - 1)
    : currentRole.slice(0, characterIndex + 1);
  characterIndex += deleting ? -1 : 1;

  let delay = deleting ? 42 : 78;
  if (!deleting && characterIndex === currentRole.length) {
    deleting = true;
    delay = 1500;
  } else if (deleting && characterIndex === 0) {
    deleting = false;
    roleIndex = (roleIndex + 1) % roles.length;
    delay = 350;
  }
  window.setTimeout(typeRole, delay);
};

window.setTimeout(() => {
  bootLine.innerHTML = 'Loading interface <span class="cursor"></span>';
}, 650);
window.setTimeout(() => {
  bootScreen.classList.add('is-hidden');
  document.body.classList.add('ready');
  typeRole();
}, 1500);

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
