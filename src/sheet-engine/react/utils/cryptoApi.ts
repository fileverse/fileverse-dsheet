// Utility for fetching and caching crypto prices from CoinGecko
const COINGECKO_API =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,aed,ars,aud,bdt,bhd,bmd,brl,cad,chf,clp,cny,czk,dkk,eur,gbp,gel,hkd,huf,idr,ils,inr,jpy,krw,kwd,lkr,mmk,mxn,myr,ngn,nok,nzd,php,pkr,pln,rub,sar,sek,sgd,thb,try,twd,uah,vef,vnd,zar';
const CACHE_DURATION = 60 * 1000; // 1 minute
const CRYPTO_LIST = ['bitcoin', 'ethereum', 'solana'];
const FIAT_LIST = [
  'usd',
  'aed',
  'ars',
  'aud',
  'bdt',
  'bhd',
  'bmd',
  'brl',
  'cad',
  'chf',
  'clp',
  'cny',
  'czk',
  'dkk',
  'eur',
  'gbp',
  'gel',
  'hkd',
  'huf',
  'idr',
  'ils',
  'inr',
  'jpy',
  'krw',
  'kwd',
  'lkr',
  'mmk',
  'mxn',
  'myr',
  'ngn',
  'nok',
  'nzd',
  'php',
  'pkr',
  'pln',
  'rub',
  'sar',
  'sek',
  'sgd',
  'thb',
  'try',
  'twd',
  'uah',
  'vef',
  'vnd',
  'zar',
];

// In-memory cache: { 'btc-usd': { price: number, timestamp: number } }
const priceCache: Record<string, { price: number; timestamp: number }> = {};

function updatePriceCache(data: any, timestamp: number): void {
  CRYPTO_LIST.forEach((crypto) => {
    FIAT_LIST.forEach((fiat) => {
      const price = data[crypto]?.[fiat];
      if (typeof price === 'number') {
        const key = `${crypto}-${fiat}`.toLowerCase();
        priceCache[key] = { price, timestamp };
      }
    });
  });
}

const fetchCall = async (url: string) => {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => response.json())
      .then((data) => resolve(data))
      .catch((error) => reject(error));
  });
};

export async function getCryptoPrice(
  crypto: string,
  fiat: string,
): Promise<number> {
  const key = `${crypto}-${fiat}`.toLowerCase();
  const now = Date.now();
  if (priceCache[key] && now - priceCache[key].timestamp < CACHE_DURATION) {
    return priceCache[key].price;
  }
  if (priceCache[key]) {
    fetchCall(COINGECKO_API).then((data) => {
      updatePriceCache(data, now);
    });
    return priceCache[key].price;
  }

  const data: any = await fetchCall(COINGECKO_API);
  const price = data[crypto]?.[fiat];
  if (typeof price !== 'number') throw new Error('Invalid price data');

  updatePriceCache(data, now);
  return price;
}

export const getCachedPrice = (crypto: string, fiat: string) => {
  const key = `${crypto}-${fiat}`.toLowerCase();
  getCryptoPrice(crypto, fiat);
  return priceCache[key]?.price;
};

// Optionally, add a function to clear the cache (for testing or force refresh)
export function clearCryptoPriceCache() {
  Object.keys(priceCache).forEach((key) => delete priceCache[key]);
}
