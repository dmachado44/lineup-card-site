// Netlify serverless function: handles Stripe webhook events and updates Firestore.
//
// Environment variables required in Netlify dashboard:
//   STRIPE_SECRET_KEY        — Stripe secret key
//   STRIPE_WEBHOOK_SECRET    — Webhook signing secret (whsec_...)
//   FIREBASE_SERVICE_ACCOUNT — JSON string of the Firebase service account key
//
// Stripe webhook endpoint URL (configure in Stripe dashboard):
//   https://lineupcard.app/.netlify/functions/stripe-webhook
//
// Events to listen for:
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_failed
//
// What it writes to users/{uid} (always merged, never a whole-doc set):
//   subscriptionStatus  — only values the iOS app knows: 'active' while the
//                         Stripe subscription is live, then 'expired' (or
//                         back to 'grandfathered') when it ends. The iOS User
//                         model couldn't read 'past_due' or 'cancelled', so
//                         those are never written.
//   subscriptionSource  — 'stripe' when this webhook turns the plan on. The
//                         iOS app writes 'appstore' for App Store plans. Each
//                         side only turns off a plan it manages.
//   stripeStatus        — Stripe's own status, as is (trialing, past_due …).
//   stripe* fields      — ids, plan and trial end for the web's billing.

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

// Stripe statuses that keep the plan on. Everything else (past_due, unpaid,
// canceled, incomplete, incomplete_expired, paused) turns it off.
const LIVE_STRIPE_STATUSES = new Set(['active', 'trialing']);

// subscriptionStatus values this webhook may turn off. 'trial' and
// 'grandfathered' belong to the iOS app, and 'none' / 'expired' are already
// off. 'past_due' and 'cancelled' are values older versions of this webhook
// wrote.
const TURN_OFF_FROM = new Set(['active', 'past_due', 'cancelled']);

function millis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const n = typeof value === 'number' ? value : Date.parse(value);
  return isNaN(n) ? 0 : n;
}

// A grandfathered account that also paid on the web goes back to
// grandfathered, not expired, while its free year has time left (the iOS
// rule in User.isGrandfatheredAndActive).
function stillGrandfathered(user) {
  if (!user.isGrandfathered) return false;
  if (!user.subscriptionExpiry) return true;
  return millis(user.subscriptionExpiry) > Date.now();
}

// Writes one Stripe subscription's current state onto its user doc, inside a
// transaction so the decision is made on the doc it writes.
// `email` only fills a missing email; it never replaces one.
async function applySubscription(firebaseUid, subscription, extra = {}, email = null) {
  const ref   = db.collection('users').doc(firebaseUid);
  const live  = LIVE_STRIPE_STATUSES.has(subscription.status);
  const price = subscription.items.data[0].price;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const user = snap.exists ? snap.data() : {};

    // An event for an older subscription this user has since replaced
    // changes nothing.
    if (!live && user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id) {
      return 'skipped (older subscription)';
    }

    const update = {
      stripeStatus: subscription.status,
      stripePriceId: price.id,
      stripePlan: price.recurring.interval === 'year' ? 'yearly' : 'monthly',
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...extra,
    };

    let result = 'status unchanged';
    if (live) {
      update.stripeSubscriptionId = subscription.id;
      update.subscriptionStatus = 'active';
      update.subscriptionSource = 'stripe';
      result = 'active';
    } else if (TURN_OFF_FROM.has(user.subscriptionStatus) && user.subscriptionSource !== 'appstore') {
      // An App Store plan is the iOS app's to turn off, never this webhook's.
      update.subscriptionStatus = stillGrandfathered(user) ? 'grandfathered' : 'expired';
      result = update.subscriptionStatus;
    }

    // Checkout from /pricing can run before the user ever opens /app, so
    // this may be the doc's first write. The iOS app reads both fields.
    if (user.createdAt == null) update.createdAt = admin.firestore.FieldValue.serverTimestamp();
    if (user.email == null && email) update.email = email;

    tx.set(ref, update, { merge: true });
    return result;
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Verify the webhook signature
  const sig = event.headers['stripe-signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (stripeEvent.type) {
      // ── Checkout completed (new subscription or trial started) ──
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const firebaseUid = session.metadata && session.metadata.firebaseUid;
        if (!firebaseUid) {
          console.warn('checkout.session.completed: no firebaseUid in metadata');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const email = (session.customer_details && session.customer_details.email)
          || session.customer_email || null;

        const result = await applySubscription(firebaseUid, subscription, {
          stripeCustomerId: session.customer,
          stripeTrialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        }, email);

        console.log(`✓ Checkout for user ${firebaseUid}: ${subscription.status} → ${result}`);
        break;
      }

      // ── Subscription updated or deleted (renewal, trial end, cancel) ──
      // Re-read the subscription rather than trust the event body: Stripe
      // can deliver events out of order, and the current state is what counts.
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = await stripe.subscriptions.retrieve(stripeEvent.data.object.id);
        const firebaseUid = subscription.metadata && subscription.metadata.firebaseUid;
        if (!firebaseUid) {
          console.warn(`${stripeEvent.type}: no firebaseUid in metadata`);
          break;
        }

        const result = await applySubscription(firebaseUid, subscription);
        console.log(`✓ ${stripeEvent.type} for user ${firebaseUid}: ${subscription.status} → ${result}`);
        break;
      }

      // ── Payment failed ──
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        // Newer Stripe API versions moved the id under invoice.parent.
        const subscriptionId = invoice.subscription
          || (invoice.parent && invoice.parent.subscription_details
              && invoice.parent.subscription_details.subscription);
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const firebaseUid = subscription.metadata && subscription.metadata.firebaseUid;
        if (!firebaseUid) {
          console.warn('invoice.payment_failed: no firebaseUid in metadata');
          break;
        }

        const result = await applySubscription(firebaseUid, subscription);
        console.log(`⚠ Payment failed for user ${firebaseUid}: ${subscription.status} → ${result}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
