"use client";

import { useEffect, useState } from "react";

// Converte la chiave pubblica VAPID (base64url) nel formato che il
// browser si aspetta per pushManager.subscribe().
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Status = "checking" | "unsupported" | "off" | "on" | "loading" | "denied";

// Pulsante "Attiva notifiche": registra il service worker e sottoscrive
// l'utente alle notifiche push del browser/telefono. Su iPhone funziona
// solo se l'app è stata aggiunta alla schermata Home (limite di Apple).
export default function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    async function check() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (typeof Notification === "undefined") {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "on" : "off");
      } catch {
        setStatus("unsupported");
      }
    }
    check();
  }, []);

  async function subscribe() {
    setStatus("loading");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setStatus("unsupported");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setStatus("on");
    } catch (err) {
      console.error("Errore attivazione notifiche push:", err);
      setStatus("off");
    }
  }

  if (status === "checking" || status === "unsupported") return null;

  if (status === "on") {
    return <p className="px-3 text-xs text-gray-400">🔔 Notifiche attive</p>;
  }

  if (status === "denied") {
    return (
      <p className="px-3 text-xs text-gray-400">
        🔕 Notifiche bloccate dal browser (controlla le impostazioni del sito)
      </p>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={status === "loading"}
      className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
    >
      {status === "loading" ? "Attivazione…" : "🔔 Attiva notifiche"}
    </button>
  );
}
