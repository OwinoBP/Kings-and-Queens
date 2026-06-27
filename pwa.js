if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  const installButton = document.getElementById('pwa-install-btn');
  if (installButton) {
    installButton.hidden = false;
    installButton.addEventListener('click', async () => {
      installButton.hidden = true;
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      }
    });
  }
});
