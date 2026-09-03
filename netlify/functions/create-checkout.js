// Netlify serverless function: creates a Stripe Checkout Session for Lineup Card Pro.
// Expects POST with JSON body: { plan: "monthly" | "yearly", firebaseUid: "...", email: "..." }
//
// Environment variables required in Netlify dashboard:
//   STRIPE_SECRET_KEY — your Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_MONTHLY_PRICE_ID — Stripe Price ID for the $2/mo plan
//   STRIPE_YEARLY_PRICE_ID  — Stripe Price ID for the $18/yr plan
//   SITE_URL — fallback origin when the request has no Origin header (e.g. https://app.getleadoff.com)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { plan, firebaseUid, email } = body;

  if (!plan || !firebaseUid) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields: plan, firebaseUid' }),
    };
  }

  // Map plan name to Stripe Price ID
  const priceId =
    plan === 'yearly'
      ? process.env.STRIPE_YEARLY_PRICE_ID
      : process.env.STRIPE_MONTHLY_PRICE_ID;

  if (!priceId) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Stripe price not configured for plan: ' + plan }),
    };
  }

  // Return the customer to the SAME origin the checkout started on.
  // Firebase auth state is per-origin, so bouncing lineupcard.app users to
  // app.getleadoff.com (or vice versa) would land them signed out.
  const ALLOWED_ORIGINS = ['https://app.getleadoff.com', 'https://lineupcard.app', 'https://www.lineupcard.app'];
  const reqOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const siteUrl = ALLOWED_ORIGINS.includes(reqOrigin)
    ? reqOrigin
    : (process.env.SITE_URL || 'https://app.getleadoff.com');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      subscription_data: {
        trial_period_days: 7,
        metadata: { firebaseUid },
      },
      metadata: { firebaseUid },
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?cancelled=true`,
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    };
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
