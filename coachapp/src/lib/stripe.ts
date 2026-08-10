import Stripe from "stripe";

// Client Stripe lato server. La chiave segreta vive solo nelle env var di
// Vercel (STRIPE_SECRET_KEY), mai nel codice o lato browser.
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY non configurata");
  }
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}
