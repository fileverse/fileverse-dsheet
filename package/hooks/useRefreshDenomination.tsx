import { useEffect, useRef } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

export const useRefreshDenomination = ({
  sheetEditorRef
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>
}) => {
  const cryptoPriceRef = useRef<{ ETH: number | null, BTC: number | null, SOL: number | null }>({ BTC: null, ETH: 0, SOL: 0 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrice = async () => {
    // @ts-expect-error later
    const cryptoPrices = await fetch(`${window.NEXT_PUBLIC_PROXY_BASE_URL}/proxy`, {
      headers:
      {
        'target-url': 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd',
        method: 'GET',
        'Content-Type': 'application/json'
      }
    });
    const cryptoData = await cryptoPrices.json();
    const ETH = cryptoData.ethereum.usd;
    const BTC = cryptoData.bitcoin.usd;
    const SOL = cryptoData.solana.usd;
    cryptoPriceRef.current = {
      ETH,
      BTC,
      SOL
    }
    refreshDenomination();
  }

  const refreshDenomination = async () => {
    const { ETH, BTC, SOL } = cryptoPriceRef.current;
    if (BTC === null || ETH === null || SOL === null) return;
    const currentData = sheetEditorRef.current?.getSheet();
    const cellData = currentData?.celldata;
    if (!cellData) return;

    for (let i = 0; i < cellData?.length; i++) {
      const cell = { ...cellData[i] } as any; cellData[i];
      if (!cell.v.baseValue) continue;
      cell.v = typeof cell.v === 'string' ? cell.v : { ...cellData[i].v };

      const value = cell.v?.m?.toString();
      const decemialCount = cell.v?.m?.includes('.') ? cell.v?.m?.split(' ')[0]?.split('.')[1]?.length : 0;
      if (value?.includes("BTC")) {
        cell.v.m = value.replace(/\d+(\.\d+)?/, (cell.v?.baseValue / BTC).toFixed(decemialCount).toString());
      } else if (value?.includes("ETH")) {
        cell.v.m = value.replace(/\d+(\.\d+)?/, (cell.v?.baseValue / ETH).toFixed(decemialCount).toString());
      } else if (value?.includes("SOL")) {
        cell.v.m = value.replace(/\d+(\.\d+)?/, (cell.v?.baseValue / SOL).toFixed(decemialCount).toString());
      }
      sheetEditorRef.current?.setCellValue(cell.r, cell.c, cell.v);
    }
  }

  useEffect(() => {
    fetchPrice();
    intervalRef.current = setInterval(() => {
      fetchPrice();
    }, 20 * 60 * 1000);

    return () => {
      if (intervalRef.current)
        clearInterval(intervalRef.current);
    };
  }, []);

  return {
    refreshDenomination
  }
};
