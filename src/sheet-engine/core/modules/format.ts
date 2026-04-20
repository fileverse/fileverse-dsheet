import numeral from 'numeral';
import _ from 'lodash';
import { isRealNum, valueIsError, detectDateFormat } from './validation';
// @ts-ignore
import SSF from './ssf';
import { Cell, CellMatrix } from '../types';
import { getCellValue } from './cell';

const base1904 = new Date(1900, 2, 1, 0, 0, 0);

/** Below this absolute value, never use automatic scientific (Sheets-like). */
export const GS_PLAIN_MAX_ABS = 999999999999997;
/** Smallest 16-digit positive integer — use plain / text, not E-notation. */
export const GS_SIXTEEN_DIGIT_MIN_ABS = 1e15;

/** Scientific only in (GS_PLAIN_MAX_ABS, 1e15) — 999…997 itself stays plain. */
export function gsAllowsScientificMagnitude(av: number): boolean {
  return (
    Number.isFinite(av) &&
    av > GS_PLAIN_MAX_ABS &&
    av < GS_SIXTEEN_DIGIT_MIN_ABS
  );
}

/** Integer string (optional `-`, optional `,`) with ≥16 digits — store literally under General/Auto. */
export function isSixteenPlusDigitIntegerString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const t = value.trim().replace(/,/g, "");
  if (!/^-?\d+$/.test(t)) return false;
  const core = t.startsWith("-") ? t.slice(1) : t;
  return core.length >= 16;
}

/**
 * Display string for a JS number when `toString()` may use `e` notation.
 * Applies Sheets-like rules: no E below GS_PLAIN_MAX_ABS or at/above 16-digit scale.
 */
export function formatMForNumericCellAvoidingGsRules(v: number): string {
  const av = Math.abs(v);
  if (v === Infinity || v === -Infinity) return String(v);
  if (gsAllowsScientificMagnitude(av)) {
    const s = v.toString();
    let len = 0;
    if (s.toLowerCase().includes("e")) {
      const mant = s.split(/[eE]/)[0];
      if (mant.includes(".")) {
        len = Math.min(5, (mant.split(".")[1] || "").length);
      }
    } else if (s.includes(".")) {
      len = Math.min(5, (s.split(".")[1] || "").split(/[eE]/)[0].length);
    }
    return v.toExponential(len);
  }
  if (av >= GS_SIXTEEN_DIGIT_MIN_ABS) {
    return v.toLocaleString("en-US", { maximumFractionDigits: 50, useGrouping: false });
  }
  return v.toLocaleString("en-US", { maximumFractionDigits: 21, useGrouping: false });
}

export function datenum_local(v: Date, date1904?: number) {
  let epoch = Date.UTC(
    v.getFullYear(),
    v.getMonth(),
    v.getDate(),
    v.getHours(),
    v.getMinutes(),
    v.getSeconds(),
  );
  const dnthresh_utc = Date.UTC(1899, 11, 31, 0, 0, 0);

  if (date1904) epoch -= 1461 * 24 * 60 * 60 * 1000;
  else if (v >= base1904) epoch += 24 * 60 * 60 * 1000;
  return (epoch - dnthresh_utc) / (24 * 60 * 60 * 1000);
}

export function genarate(value: string | number | boolean) {
  // 万 单位格式增加！！！
  let m: string | null = null;
  let ct: any = {};
  let v: any = value;

  if (_.isNil(value)) {
    return null;
  }

  if (
    /^-?[0-9]{1,}[,][0-9]{3}(.[0-9]{1,2})?$/.test(value as string) &&
    !Array.isArray(value)
  ) {
    value = value as string;
    // 表述金额的字符串，如：12,000.00 或者 -12,000.00
    m = value;
    v = Number(value.split('.')[0].replace(',', ''));
    let fa = '#,##0';
    if (value.split('.')[1]) {
      fa = '#,##0.';
      for (let i = 0; i < value.split('.')[1].length; i += 1) {
        fa += 0;
      }
    }
    ct = { fa, t: 'n' };
  } else if (value.toString().substring(0, 1) === "'") {
    m = value.toString().substring(1);
    ct = { fa: '@', t: 's' };
  } else if (value.toString().toUpperCase() === 'TRUE') {
    m = 'TRUE';
    ct = { fa: 'General', t: 'b' };
    v = true;
  } else if (value.toString().toUpperCase() === 'FALSE') {
    m = 'FALSE';
    ct = { fa: 'General', t: 'b' };
    v = false;
  } else if (valueIsError(value.toString())) {
    m = value.toString();
    ct = { fa: 'General', t: 'e' };
  } else if (
    /^\d{6}(18|19|20)?\d{2}(0[1-9]|1[12])(0[1-9]|[12]\d|3[01])\d{3}(\d|X)$/i.test(
      value as string,
    )
  ) {
    m = value.toString();
    ct = { fa: '@', t: 's' };
  } else if (isSixteenPlusDigitIntegerString(value)) {
    const raw = (value as string).trim().replace(/,/g, '');
    m = raw;
    v = raw;
    ct = { fa: 'General', t: 'g' };
  } else if (
    isRealNum(value) &&
    Math.abs(parseFloat(value as string)) > 0 &&
    (Math.abs(parseFloat(value as string)) < 1e-9 ||
      gsAllowsScientificMagnitude(Math.abs(parseFloat(value as string))))
  ) {
    v = parseFloat(value as string);
    const str = v.toExponential();
    if (str.indexOf('.') > -1) {
      let strlen = str.split('.')[1].split('e')[0].length;
      if (strlen > 5) {
        strlen = 5;
      }

      ct = { fa: `#0.${new Array(strlen + 1).join('0')}E+00`, t: 'n' };
    } else {
      ct = { fa: '#0.E+00', t: 'n' };
    }

    m = SSF.format(ct.fa, v);
  } else if (value.toString().indexOf('%') > -1) {
    const index = value.toString().indexOf('%');
    const value2 = value.toString().substring(0, index);
    const value3 = value2.replace(/,/g, '');

    if (index === value.toString().length - 1 && isRealNum(value3)) {
      if (value2.indexOf('.') > -1) {
        if (value2.indexOf('.') === value2.lastIndexOf('.')) {
          const value4 = value2.split('.')[0];
          const value5 = value2.split('.')[1];

          let len = value5.length;
          if (len > 9) {
            len = 9;
          }

          if (value4.indexOf(',') > -1) {
            let isThousands = true;
            const ThousandsArr = value4.split(',');

            for (let i = 1; i < ThousandsArr.length; i += 1) {
              if (ThousandsArr[i].length < 3) {
                isThousands = false;
                break;
              }
            }

            if (isThousands) {
              ct = {
                fa: `#,##0.${new Array(len + 1).join('0')}%`,
                t: 'n',
              };
              v = numeral(value).value();
              m = SSF.format(ct.fa, v);
            } else {
              m = value.toString();
              ct = { fa: '@', t: 's' };
            }
          } else {
            ct = { fa: `0.${new Array(len + 1).join('0')}%`, t: 'n' };
            v = numeral(value).value();
            m = SSF.format(ct.fa, v);
          }
        } else {
          m = value.toString();
          ct = { fa: '@', t: 's' };
        }
      } else if (value2.indexOf(',') > -1) {
        let isThousands = true;
        const ThousandsArr = value2.split(',');

        for (let i = 1; i < ThousandsArr.length; i += 1) {
          if (ThousandsArr[i].length < 3) {
            isThousands = false;
            break;
          }
        }

        if (isThousands) {
          ct = { fa: '#,##0%', t: 'n' };
          v = numeral(value).value();
          m = SSF.format(ct.fa, v);
        } else {
          m = value.toString();
          ct = { fa: '@', t: 's' };
        }
      } else {
        ct = { fa: '0%', t: 'n' };
        v = numeral(value).value();
        m = SSF.format(ct.fa, v);
      }
    } else {
      m = value.toString();
      ct = { fa: '@', t: 's' };
    }
  } else if (value.toString().indexOf('.') > -1) {
    if (value.toString().indexOf('.') === value.toString().lastIndexOf('.')) {
      const value1 = value.toString().split('.')[0];
      const value2 = value.toString().split('.')[1];

      let len = value2.length;
      if (len > 9) {
        len = 9;
      }

      if (value1.indexOf(',') > -1) {
        let isThousands = true;
        const ThousandsArr = value1.split(',');

        for (let i = 1; i < ThousandsArr.length; i += 1) {
          if (!isRealNum(ThousandsArr[i]) || ThousandsArr[i].length < 3) {
            isThousands = false;
            break;
          }
        }

        if (isThousands) {
          ct = { fa: `#,##0.${new Array(len + 1).join('0')}`, t: 'n' };
          v = numeral(value).value();
          m = SSF.format(ct.fa, v);
        } else {
          m = value.toString();
          ct = { fa: '@', t: 's' };
        }
      } else {
        if (isRealNum(value1) && isRealNum(value2)) {
          ct = { fa: `0.${new Array(len + 1).join('0')}`, t: 'n' };
          v = numeral(value).value();
          m = SSF.format(ct.fa, v);
        } else {
          m = value.toString();
          ct = { fa: '@', t: 's' };
        }
      }
    } else {
      m = value.toString();
      ct = { fa: '@', t: 's' };
    }
  } else if (isRealNum(value)) {
    const pv = parseFloat(value as string);
    const av = Math.abs(pv);
    v = pv;
    ct = { fa: 'General', t: 'n' };
    if (av >= GS_SIXTEEN_DIGIT_MIN_ABS) {
      m = pv.toLocaleString('en-US', { maximumFractionDigits: 50, useGrouping: false });
    } else {
      m = pv.toString();
    }
  } else if (typeof value === 'string') {
    const df = detectDateFormat(value.toString());
    if (df) {
      const dateObj = new Date(
        df.year,
        df.month - 1,
        df.day,
        df.hours,
        df.minutes,
        df.seconds,
      );
      v = datenum_local(dateObj);
      console.log("df", df, value);
      console.log("v", v, dateObj);
      ct.t = 'd';

      const map: Record<string, string> = {
        'yyyy-MM-dd': 'yyyy-MM-dd',
        'yyyy-MM-dd HH:mm': 'yyyy-MM-dd HH:mm',
        'yyyy-MM-ddTHH:mm': 'yyyy-MM-dd HH:mm',
        'yyyy/MM/dd': 'yyyy/MM/dd',
        'yyyy/MM/dd HH:mm': 'yyyy/MM/dd HH:mm',
        'yyyy.MM.dd': 'yyyy.MM.dd',
        'MM/dd/yyyy h:mm AM/PM': 'MM/dd/yyyy h:mm AM/PM',
        'MM/dd/yyyy': 'MM/dd/yyyy',
        'M/d/yyyy': 'M/d/yyyy',
        'MM/dd/yy': 'MM/dd/yy',
        'dd/MM/yyyy': 'dd/MM/yyyy',
        'dd-MM-yyyy': 'dd-MM-yyyy',
        'dd.MM.yyyy': 'dd.MM.yyyy',
        'named-mdy-full': 'mmmm d, yyyy',
        'named-mdy-abbr': 'mmm d, yyyy',
        'named-dmy-full': 'd mmmm yyyy',
        'named-dmy-abbr': 'd mmm yyyy',
        'named-abbr-dashes': 'mmm-d-yyyy',
      };

      ct.fa = map[df.formatType] || 'dd/MM/yyyy';
      console.log("ct.fa", ct.fa, v);
      m = SSF.format(ct.fa, v);
      console.log("m", m);
    } else {
      m = String(value);
      ct.fa = 'General';
      ct.t = 'g';
    }
  } else {
    m = String(value);
    ct.fa = 'General';
    ct.t = 'g';
  }

  return [m, ct, v];
}

export function update(fmt: string, v: any) {
  return SSF.format(fmt, v);
}

/** Max decimal places for toolbar +/- on General (Auto) without switching to a numeric `fa`. */
export const MAX_GENERAL_AUTO_DP = 15;

/**
 * Recompute `m` for numeric cells with `fa === "General"`.
 * When `ct.dp` is set (1..MAX), uses fixed decimals like Sheets Auto + decimal buttons.
 * Otherwise uses the usual `genarate` General display.
 */
export function refreshGeneralNumericDisplay(cell: Cell): void {
  const ct = cell.ct;
  if (!ct || ct.fa !== "General") return;
  const v = cell.v;
  if (v === Infinity || v === -Infinity) {
    cell.m = String(v);
    return;
  }
  // Long integer strings: keep exact digits (IEEE doubles cannot represent them).
  if (typeof v === "string" && /^-?\d+$/.test(v)) {
    const core = v.startsWith("-") ? v.slice(1) : v;
    if (core.length >= 16) {
      cell.m = v;
      return;
    }
  }
  if (!isRealNum(v)) return;
  const num = Number(v);
  if (ct.dp != null && ct.dp >= 1) {
    const d = Math.min(MAX_GENERAL_AUTO_DP, Math.max(1, Math.floor(ct.dp)));
    const s = num.toString();
    if (s.toLowerCase().includes("e")) {
      const g = genarate(num);
      if (g) cell.m = g[0].toString();
      return;
    }
    cell.m = num.toFixed(d);
    return;
  }
  const g = genarate(num);
  if (g) cell.m = g[0].toString();
}

export function is_date(fmt: string, v?: any) {
  console.log(SSF.is_date(fmt, v), 'is_date');
  return SSF.is_date(fmt, v);
}

function fuzzynum(s: string | number) {
  let v = Number(s);
  if (typeof s === 'number') {
    return s;
  }
  if (!Number.isNaN(v)) return v;
  let wt = 1;
  let ss = s
    .replace(/([\d]),([\d])/g, '$1$2')
    .replace(/[$]/g, '')
    .replace(/[%]/g, () => {
      wt *= 100;
      return '';
    });
  v = Number(ss);
  if (!Number.isNaN(v)) return v / wt;
  ss = ss.replace(/[(](.*)[)]/, ($$, $1) => {
    wt = -wt;
    return $1;
  });
  v = Number(ss);
  if (!Number.isNaN(v)) return v / wt;
  return v;
}

export function valueShowEs(r: number, c: number, d: CellMatrix) {
  let value = getCellValue(r, c, d, 'm');
  if (value == null) {
    value = getCellValue(r, c, d, 'v');
  } else {
    if (!Number.isNaN(fuzzynum(value))) {
      if (_.isString(value) && value.indexOf('%') > -1) {
      } else {
        value = getCellValue(r, c, d, 'v');
      }
    }
    // else if (!isNaN(parseDate(value).getDate())){
    else if (d[r]?.[c]?.ct?.t === 'd') {
    } else if (d[r]?.[c]?.ct?.t === 'b') {
    } else {
      value = getCellValue(r, c, d, 'v');
    }
  }
  return value;
}
