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

        // Retrieve the subscription to get plan details
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0].price.id;
        const interval = subscription.items.data[0].price.recurring.interval; // 'month' | 'year'

        await db.collection('users').doc(firebaseUid).set({
          subscriptionStatus: 'active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          stripePriceId: priceId,
          stripePlan: interval === 'year' ? 'yearly' : 'monthly',
          stripeTrialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`✓ Activated subscription for user ${firebaseUid} (${interval})`);
        break;
      }

      // ── Subscription updated (plan change, renewal, trial end) ──
      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        const firebaseUid = subscription.metadata && subscription.metadata.firebaseUid;
        if (!firebaseUid) {
          console.warn('subscription.updated: no firebaseUid in metadata');
          break;
        }

        const status = subscription.status; // 'active' | 'past_due' | 'canceled' | 'trialing' | etc.
        const mappedStatus =
          status === 'active' || status === 'trialing' ? 'active'
          : status === 'past_due' ? 'past_due'
          : 'cancelled';

        const interval = subscription.items.data[0].price.recurring.interval;

        await db.collection('users').doc(firebaseUid).set({
          subscriptionStatus: mappedStatus,
          stripePlan: interval === 'year' ? 'yearly' : 'monthly',
          stripePriceId: subscription.items.data[0].price.id,
          subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`✓ Updated subscription for user ${firebaseUid}: ${mappedStatus}`);
        break;
      }

      // ── Subscription deleted (cancelled or expired) ──
      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const firebaseUid = subscription.metadata && subscription.metadata.firebaseUid;
        if (!firebaseUid) {
          console.warn('subscription.deleted: no firebaseUid in metadata');
          break;
        }

        await db.collection('users').doc(firebaseUid).set({
          subscriptionStatus: 'cancelled',
          subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`✓ Cancelled subscription for user ${firebaseUid}`);
        break;
      }

      // ── Payment failed ──
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        // Look up the subscription to get firebaseUid
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const firebaseUid = subscription.metadata && subscription.metadata.firebaseUid;
          if (firebaseUid) {
            await db.collection('users').doc(firebaseUid).set({
              subscriptionStatus: 'past_due',
              subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`⚠ Payment failed for user ${firebaseUid}`);
          }
        }
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
