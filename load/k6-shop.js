// Load and contention checks for the API. Run against STAGING, never production:
//
//   k6 run -e BASE_URL=https://staging.example.com/api load/k6-shop.js                 browsing only
//   k6 run -e BASE_URL=http://127.0.0.1:4100 -e SCENARIO=lastStock \
//          -e PRODUCT_ID=<id> -e VARIANT_ID=<id> -e SPOOF_IP=true load/k6-shop.js       50 buyers, stock of 1
//   k6 run -e BASE_URL=http://127.0.0.1:4100 -e SCENARIO=webhook \
//          -e WEBHOOK_SECRET=<staging secret> load/k6-shop.js                           replay storm
//
// SCENARIO: browse (default) | lastStock | webhook | all
//
// lastStock needs a READY product whose single variant has stock = 1 (make one in the staging admin) and places
// guest COD orders. Orders are limited to 10 a minute per IP (API) and by nginx, so run this ON the server against
// 127.0.0.1:4100 with SPOOF_IP=true, which gives each virtual buyer its own X-Forwarded-For. That only works because
// the API trusts one proxy hop and nothing sits in front: never point SPOOF_IP at the public nginx address.
// Pass criteria are in `thresholds` below; the lastStock check is "exactly one 201, everything else refused, no 5xx".
import crypto from 'k6/crypto';
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://127.0.0.1:4100').replace(/\/$/, '');
const SCENARIO = __ENV.SCENARIO || 'browse';

const created = new Counter('orders_created');
const soldOut = new Counter('orders_refused_sold_out');
const serverErrors = new Counter('server_errors');

const scenarios = {
  browse: {
    executor: 'constant-arrival-rate',
    rate: 200,
    timeUnit: '1s',
    duration: '60s',
    preAllocatedVUs: 100,
    maxVUs: 400,
    exec: 'browse',
  },
  lastStock: { executor: 'per-vu-iterations', vus: 50, iterations: 1, maxDuration: '60s', exec: 'lastStock' },
  webhook: { executor: 'constant-arrival-rate', rate: 100, timeUnit: '1s', duration: '20s', preAllocatedVUs: 50, maxVUs: 200, exec: 'webhook' },
};

export const options = {
  scenarios: SCENARIO === 'all' ? scenarios : { [SCENARIO]: scenarios[SCENARIO] },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:browse}': ['p(95)<300'],
    server_errors: ['count==0'],
    ...(SCENARIO === 'lastStock' || SCENARIO === 'all' ? { orders_created: ['count==1'] } : {}),
  },
};

export function setup() {
  if (SCENARIO === 'browse' || SCENARIO === 'all') {
    const list = http.get(`${BASE}/products?pageSize=50`);
    const items = list.status === 200 ? list.json('items') : [];
    return { slugs: items.map((p) => p.slug) };
  }
  return { slugs: [] };
}

export function browse(data) {
  group('browse', () => {
    check(http.get(`${BASE}/categories`), { 'categories 200': (r) => r.status === 200 });
    check(http.get(`${BASE}/products?pageSize=24&sort=newest`), { 'products 200': (r) => r.status === 200 });
    if (data.slugs.length) {
      const slug = data.slugs[Math.floor(Math.random() * data.slugs.length)];
      check(http.get(`${BASE}/products/${slug}`), { 'product 200': (r) => r.status === 200 });
    }
  });
  sleep(0.1);
}

export function lastStock() {
  const productId = __ENV.PRODUCT_ID;
  const variantId = __ENV.VARIANT_ID;
  if (!productId || !variantId) throw new Error('PRODUCT_ID and VARIANT_ID are required for the lastStock scenario');
  const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': `k6-${__VU}-${Date.now()}` };
  if (__ENV.SPOOF_IP === 'true') headers['X-Forwarded-For'] = `10.77.${Math.floor(__VU / 250)}.${(__VU % 250) + 1}`;
  const body = JSON.stringify({
    lines: [{ productId, variantId, qty: 1 }],
    contact: { name: `Load Buyer ${__VU}`, email: `k6-${__VU}@example.com`, phone: `+9198000${String(10000 + __VU)}` },
    address: { name: `Load Buyer ${__VU}`, phone: `+9198000${String(10000 + __VU)}`, line1: '1 Test Lane', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'IN' },
    paymentMethod: 'COD',
  });
  const res = http.post(`${BASE}/orders`, body, { headers, tags: { name: 'place-order' }, responseCallback: http.expectedStatuses(201, 400, 409, 422, 429) });
  if (res.status === 201) created.add(1);
  else if (res.status === 409 || res.status === 422 || res.status === 400) soldOut.add(1);
  if (res.status >= 500) serverErrors.add(1);
}

export function webhook() {
  const secret = __ENV.WEBHOOK_SECRET;
  if (!secret) throw new Error('WEBHOOK_SECRET is required for the webhook scenario');
  // The same event id every time: the API must accept it (200) and process it once.
  const body = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_k6_replay', order_id: 'order_k6_unknown' } } } });
  const signature = crypto.hmac('sha256', secret, body, 'hex');
  const res = http.post(`${BASE}/payments/razorpay/webhook`, body, {
    headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'evt_k6_replay' },
    tags: { name: 'webhook' },
  });
  check(res, { 'webhook accepted': (r) => r.status === 200 || r.status === 201 });
  if (res.status >= 500) serverErrors.add(1);
}
