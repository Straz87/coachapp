// Service worker minimo per le notifiche push (Web Push standard).
// Non fa caching/offline: si occupa solo di ricevere i push dal server
// e mostrarli come notifiche, e di aprire l'app quando l'utente ci clicca.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Hybridmethod", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Hybridmethod";
  const options = {
    body: data.body || "",
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname === url && "focus" in client) {
            return client.focus();
          }
        } catch (e) {
          // ignora URL non parsabili
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
