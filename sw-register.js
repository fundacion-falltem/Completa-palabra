// sw-register.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js')
      .then(r => console.log('SW registrado:', r.scope))
      .catch(e => console.warn('SW error:', e));
  });
}
