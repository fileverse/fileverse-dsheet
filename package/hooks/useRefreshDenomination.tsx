import { useEffect, useRef } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

export const useRefreshDenomination = ({
  sheetEditorRef
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>
}) => {
  const cryptoPriceRef = useRef<{ bitcoin: {}, ethereum: object, solana: object } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrice = async () => {
    // @ts-expect-error later
    const cryptoPrices = await fetch(`${window.NEXT_PUBLIC_PROXY_BASE_URL}/proxy`, {
      headers:
      {
        'target-url': 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,aed,ars,aud,bdt,bhd,bmd,brl,cad,chf,clp,cny,czk,dkk,eur,gbp,gel,hkd,huf,idr,ils,inr,jpy,krw,kwd,lkr,mmk,mxn,myr,ngn,nok,nzd,php,pkr,pln,rub,sar,sek,sgd,thb,try,twd,uah,vef,vnd,zar',
        method: 'GET',
        'Content-Type': 'application/json'
      }
    });
    const cryptoData = await cryptoPrices.json();
    cryptoPriceRef.current = cryptoData;
    refreshDenomination();
  }

  const refreshDenomination = async () => {
    if (cryptoPriceRef.current === null) return;
    const currentData = sheetEditorRef.current?.getSheet();
    const cellData = currentData?.celldata;
    if (!cellData) return;

    for (let i = 0; i < cellData?.length; i++) {
      const cell = { ...cellData[i] } as any; cellData[i];
      if (!cell.v.baseValue) continue;
      cell.v = typeof cell.v === 'string' ? cell.v : { ...cellData[i].v };

      const value = cell.v?.m?.toString();
      const decemialCount = cell.v?.m?.includes('.') ? cell.v?.m?.split(' ')[0]?.split('.')[1]?.length : 0;
      cell.v.m = value.replace(/\d+(\.\d+)?/, (Number(cell.v?.v) / cell.v?.baseCurrencyPrice).toFixed(decemialCount).toString());
      sheetEditorRef.current?.setCellValue(cell.r, cell.c, cell.v);
    }
    sheetEditorRef.current?.calculateFormula();
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
