export const DAY = 86400000;
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'LKR'];
export const MAX_CENTS = 100000000000;
export function cents(value) {
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error('Enter a positive price with at most 2 decimal places.');
  const [whole, fraction = ''] = s.split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n <= 0 || n > MAX_CENTS) throw Error('Price must be between 0.01 and 1,000,000,000.00.');
  return n;
}
export function safeURL(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2048) throw Error('Link is too long.');
  let u; try { u = new URL(value); } catch { throw Error('Enter a complete http:// or https:// link.'); }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw Error('Only HTTP and HTTPS links without credentials are allowed.');
  return u.href;
}
const timestamp = n => Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000;
export const emptyState = () => ({version: 1, revision: 0, currency: 'USD', items: []});
export function validateState(s) {
  if (!s || s.version !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0 || !CURRENCIES.includes(s.currency) || !Array.isArray(s.items) || s.items.length > 1000) throw Error('Invalid or unsupported BuyLater backup. Saved data has not been changed.');
  const ids = new Set();
  for (const i of s.items) {
    if (!i || i.version !== 1 || typeof i.id !== 'string' || !/^[\w-]{1,100}$/.test(i.id) || ids.has(i.id) || typeof i.name !== 'string' || !i.name.trim() || i.name.length > 120 || !Number.isSafeInteger(i.cents) || i.cents <= 0 || i.cents > MAX_CENTS || typeof i.url !== 'string' || safeURL(i.url) !== i.url || !['waiting','bought','skipped'].includes(i.status) || !timestamp(i.createdAt) || !timestamp(i.readyAt) || i.readyAt <= i.createdAt || !Number.isSafeInteger(i.revision) || i.revision < 0 || !(i.decidedAt === null || timestamp(i.decidedAt)) || (i.status === 'waiting' ? i.decidedAt !== null : i.decidedAt === null || i.decidedAt < i.readyAt)) throw Error('Invalid item in saved data. Original data has been preserved.');
    ids.add(i.id);
  }
  return s;
}
export function makeItem(name, price, url, days, now = Date.now()) {
  name = name.trim();
  if (!name || name.length > 120) throw Error('Use an item name between 1 and 120 characters.');
  if (![1,7,30].includes(Number(days))) throw Error('Choose a valid waiting period.');
  return {version: 1, id: crypto.randomUUID(), name, cents: cents(price), url: safeURL(url.trim()), status: 'waiting', createdAt: now, readyAt: now + Number(days)*DAY, decidedAt: null, revision: 0};
}
export function decide(item, action, now = Date.now()) {
  if (item.status !== 'waiting' || now < item.readyAt) throw Error('This item is not ready for a decision yet.');
  if (!['bought','skipped','extend'].includes(action)) throw Error('Invalid decision.');
  return {...item, revision: item.revision+1, status: action === 'extend' ? 'waiting' : action, readyAt: action === 'extend' ? now+DAY : item.readyAt, decidedAt: action === 'extend' ? null : now};
}
export function totals(items) {
  return items.reduce((t,i) => {t[i.status] += i.cents; t.counts[i.status]++; return t;}, {waiting:0,bought:0,skipped:0,counts:{waiting:0,bought:0,skipped:0}});
}
export function remaining(readyAt, now=Date.now()) {
  const minutes = Math.ceil((readyAt-now)/60000);
  if (minutes <= 0) return 'Ready to decide';
  const days = Math.floor(minutes/1440), hours = Math.floor(minutes%1440/60), mins = minutes%60;
  return days ? `${days}d ${hours}h left` : hours ? `${hours}h ${mins}m left` : `${mins}m left`;
}
