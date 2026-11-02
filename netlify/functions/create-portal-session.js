// Netlify serverless function: opens Stripe's billing portal for the signed-in
// web subscriber, where they cancel, switch monthly and yearly, update the
// card and see invoices (audit F71).
//
// Expects POST with header  Authorization: Bearer <Firebase ID token>  and no
// body. The uid comes from the verified token, never from the request, so a
// user can only ever open their own billing.
//
// Environment variables (already set for the other functions):
//   STRIPE_SECRET_KEY        — Stripe secret key
//   FIREBASE_SERVICE_ACCOUNT — JSON string of the Firebase service account key
//   SITE_URL                 — fallback origin for the return link
//
// Stripe refuses the session until the customer portal is turned on in the
// Stripe dashboard (Settings → Billing → Customer portal).

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin  = require('firebase-admin');

// Initialize Firebase Admin (once per cold start)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// Send the customer back to the SAME origin they came from: Firebase auth
// state is per-origin (same rule as create-checkout).
const ALLOWED_ORIGINS = ['https://app.getleadoff.com', 'https://lineupcard.app', 'https://www.lineupcard.app'];

function reply(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  const headers = event.headers || {};
  const auth = headers.authorization || headers.Authorization || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) return reply(401, { error: 'not_signed_in' });

  let uid;
  try {
    uid = (await admin.auth().verifyIdToken(match[1])).uid;
  } catch (err) {
    return reply(401, { error: 'not_signed_in' });
  }

  try {
    const snap = await db.collection('users').doc(uid).get();
    const customer = snap.exists ? snap.data().stripeCustomerId : null;
    if (!customer) return reply(404, { error: 'no_billing' });

    const reqOrigin = headers.origin || headers.Origin || '';
    const siteUrl = ALLOWED_ORIGINS.includes(reqOrigin)
      ? reqOrigin
      : (process.env.SITE_URL || 'https://app.getleadoff.com');

    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${siteUrl}/app`,
    });
    return reply(200, { url: session.url });
  } catch (err) {
    console.error('Billing portal error:', err);
    return reply(500, { error: err.message });
  }
};
