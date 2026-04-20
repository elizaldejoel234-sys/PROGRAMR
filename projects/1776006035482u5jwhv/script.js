document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('start-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      alert('Welcome to your new project!');
    });
  }
});