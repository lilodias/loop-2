let googlePromise;

export function loadGoogleMaps() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key || key === 'COLE_SUA_CHAVE_AQUI') return Promise.reject(new Error('Configure a chave do Google Maps no arquivo frontend/.env.local.'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googlePromise) return googlePromise;

  googlePromise = new Promise((resolve, reject) => {
    const callback = '__loopMapsReady';
    const timer = window.setTimeout(() => reject(new Error('O Google Maps demorou demais para responder. Confira a chave e as APIs habilitadas.')), 15000);
    window[callback] = () => {
      window.clearTimeout(timer);
      delete window[callback];
      resolve(window.google.maps);
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${callback}&language=pt-BR&region=BR`;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      delete window[callback];
      googlePromise = undefined;
      reject(new Error('Falha ao carregar o Google Maps. Confira a chave e a conexão.'));
    };
    document.head.appendChild(script);
  });
  return googlePromise;
}

export function distanceKm(a, b) {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(Number(b.lat) - Number(a.lat));
  const dLng = radians(Number(b.lng) - Number(a.lng));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(Number(a.lat))) * Math.cos(radians(Number(b.lat))) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
