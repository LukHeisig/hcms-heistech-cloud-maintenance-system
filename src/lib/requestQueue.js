// Globální omezovač souběžných požadavků.
// Server vrací 429, pokud přijde příliš mnoho dotazů naráz (Dashboard + Layout).
// Tato fronta pouští ven vždy jen omezený počet požadavků současně.

const MAX_CONCURRENT = 3;

let active = 0;
const queue = [];

function runNext() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  active++;
  const { fn, resolve, reject } = queue.shift();
  Promise.resolve()
    .then(fn)
    .then(resolve, reject)
    .finally(() => {
      active--;
      runNext();
    });
}

export function throttled(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    runNext();
  });
}