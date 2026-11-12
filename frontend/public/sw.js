// Mediconnect: recibe los avisos del servidor y los muestra como notificaciones del celular,
// aunque la página esté cerrada. Se registra solo cuando el paciente activa los avisos.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { cuerpo: evento.data ? evento.data.text() : '' };
  }
  // "Es tu turno": se queda en pantalla hasta que el paciente la toque y vibra más fuerte
  const llamado = datos.tipo === 'llamado';
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || 'Mediconnect', {
      body: datos.cuerpo || '',
      icon: '/img/icono-192.png',
      badge: '/img/insignia-96.png',
      tag: datos.id ? `mediconnect-${datos.id}` : undefined,
      data: { url: datos.url || '/paciente' },
      lang: 'es-CO',
      requireInteraction: llamado,
      vibrate: llamado ? [300, 120, 300, 120, 300] : [150, 80, 150],
    })
  );
});

// Al tocar el aviso se abre (o se trae al frente) la página del turno
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url || '/paciente', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).pathname.startsWith('/paciente'));
      if (abierta) return abierta.focus();
      return self.clients.openWindow(url);
    })
  );
});
