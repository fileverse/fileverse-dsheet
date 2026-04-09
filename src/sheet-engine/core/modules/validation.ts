import dayjs from 'dayjs';
import _ from 'lodash';
import {
  ERROR_NAME,
  ERROR_DIV_ZERO,
  ERROR_NULL,
  ERROR_NUM,
  ERROR_REF,
  ERROR_VALUE,
  ERROR,
  // @ts-ignore
} from '@sheet-engine/formula-parser';
import { Context } from '../context';
import { hasChinaword } from './text';

export const error = {
  v: '#VALUE!', // 错误的参数或运算符
  n: '#NAME?', // 公式名称错误
  na: '#N/A', // 函数或公式中没有可用数值
  r: '#REF!', // 删除了由其他公式引用的单元格
  d: '#DIV/0!', // 除数是0或空单元格
  nm: '#NUM!', // 当公式或函数中某个数字有问题时
  nl: '#NULL!', // 交叉运算符（空格）使用不正确
  sp: '#SPILL!', // 数组范围有其它值
};

export const errorMessagesFromValue: Record<string, string> = {
  [ERROR_DIV_ZERO]:
    'Invalid calculation: the divisor (second value) cannot be zero',
  [ERROR_NAME]: 'Wrong function name or parameter',
  [ERROR_NULL]: 'Formula returned null',
  [ERROR_NUM]: 'Invalid number',
  [ERROR_REF]: 'Invalid reference',
  [ERROR_VALUE]: 'Invalid value',
  [ERROR]: 'Unknown error',
};

export function detectErrorFromValue(input: string) {
  return errorMessagesFromValue[input];
}

const errorValues = Object.values(error);

export function valueIsError(value: string) {
  return errorValues.includes(value);
}

// 是否是空值
export function isRealNull(val: any) {
  return _.isNil(val) || val.toString().replace(/\s/g, '') === '';
}
export function isHexValue(str: string): boolean {
  // Requires 0x prefix for hex values
  return /^0x[a-fA-F0-9]+$/i.test(str);
}

// 是否是纯数字
export function isRealNum(val: any) {
  if (isHexValue(val?.toString())) {
    return false;
  }
  if (_.isNil(val) || val.toString().replace(/\s/g, '') === '') {
    return false;
  }

  if (typeof val === 'boolean') {
    return false;
  }

  return !Number.isNaN(Number(val));
}

export type DateFormatInfo = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatType: string;
};

const MONTH_NAME_MAP: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH_NAMES_RE =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec';
const MONTH_ABBR_RE = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
const MONTH_ABBR_SET = new Set(MONTH_ABBR_RE.split('|'));

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (year < 1900) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (month === 2) {
    const isLeap = new Date(year, 1, 29).getDate() === 29;
    if (isLeap && day > 29) return false;
    if (!isLeap && day > 28) return false;
  }
  if ([4, 6, 9, 11].includes(month) && day > 30) return false;
  return true;
}

export function detectDateFormat(str: string): DateFormatInfo | null {
  if (!str || str.toString().length < 5) return null;
  const s = str.toString().trim();
  let m: RegExpExecArray | null;

  // ISO 8601: 2026-02-25T14:30:00 or 2026-02-25T14:30
  m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    const h = +m[4];
    const mi = +m[5];
    const sec = m[6] != null ? +m[6] : 0;
    if (isValidDateParts(y, mo, d)) {
      return {
        year: y,
        month: mo,
        day: d,
        hours: h,
        minutes: mi,
        seconds: sec,
        formatType: 'yyyy-MM-ddTHH:mm',
      };
    }
  }

  // yyyy-MM-dd with optional time: 2026-02-25 or 2026-02-25 14:30 or 2026-02-25 14:30:00
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    s,
  );
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (isValidDateParts(y, mo, d)) {
      const h = m[4] != null ? +m[4] : 0;
      const mi = m[5] != null ? +m[5] : 0;
      const sec = m[6] != null ? +m[6] : 0;
      return {
        year: y,
        month: mo,
        day: d,
        hours: h,
        minutes: mi,
        seconds: sec,
        formatType: m[4] != null ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd',
      };
    }
  }

  // yyyy/MM/dd with optional time
  m =
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      s,
    );
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (isValidDateParts(y, mo, d)) {
      const h = m[4] != null ? +m[4] : 0;
      const mi = m[5] != null ? +m[5] : 0;
      const sec = m[6] != null ? +m[6] : 0;
      return {
        year: y,
        month: mo,
        day: d,
        hours: h,
        minutes: mi,
        seconds: sec,
        formatType: m[4] != null ? 'yyyy/MM/dd HH:mm' : 'yyyy/MM/dd',
      };
    }
  }

  // yyyy.MM.dd: 2026.02.25
  m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(s);
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (isValidDateParts(y, mo, d)) {
      return {
        year: y,
        month: mo,
        day: d,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType: 'yyyy.MM.dd',
      };
    }
  }

  // MM/dd/yyyy h:mm AM/PM: 02/25/2026 2:30 PM
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(s);
  if (m) {
    const p1 = +m[1];
    const p2 = +m[2];
    const y = +m[3];
    const h = +m[4];
    const mi = +m[5];
    const ampm = m[6].toUpperCase();
    if (p1 <= 12 && isValidDateParts(y, p1, p2)) {
      let actualH = h;
      if (ampm === 'PM' && h !== 12) actualH = h + 12;
      if (ampm === 'AM' && h === 12) actualH = 0;
      return {
        year: y,
        month: p1,
        day: p2,
        hours: actualH,
        minutes: mi,
        seconds: 0,
        formatType: 'MM/dd/yyyy h:mm AM/PM',
      };
    }
  }

  // Slash-separated with 4-digit year last: 25/02/2026, 02/25/2026, 2/25/2026
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const p1 = +m[1];
    const p2 = +m[2];
    const y = +m[3];
    if (p1 > 12 && isValidDateParts(y, p2, p1)) {
      // dd/MM/yyyy
      return {
        year: y,
        month: p2,
        day: p1,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType: 'dd/MM/yyyy',
      };
    }
    if (p2 > 12 && p1 <= 12 && isValidDateParts(y, p1, p2)) {
      // MM/dd/yyyy or M/d/yyyy (single-digit month)
      const formatType = m[1].length === 1 ? 'M/d/yyyy' : 'MM/dd/yyyy';
      return {
        year: y,
        month: p1,
        day: p2,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType,
      };
    }
    if (p1 <= 12 && p2 <= 31 && isValidDateParts(y, p1, p2)) {
      // Ambiguous — default to MM/dd/yyyy
      const formatType = m[1].length === 1 ? 'M/d/yyyy' : 'MM/dd/yyyy';
      return {
        year: y,
        month: p1,
        day: p2,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType,
      };
    }
  }

  // Slash-separated with 2-digit year: MM/dd/yy (e.g. 02/25/26)
  m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(s);
  if (m) {
    const p1 = +m[1];
    const p2 = +m[2];
    const y = 2000 + +m[3];
    if (p1 <= 12 && p2 <= 31 && isValidDateParts(y, p1, p2)) {
      return {
        year: y,
        month: p1,
        day: p2,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType: 'MM/dd/yy',
      };
    }
  }

  // dd-MM-yyyy: 25-02-2026 (only when first part > 12 to avoid ambiguity)
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (m) {
    const p1 = +m[1];
    const p2 = +m[2];
    const y = +m[3];
    if (p1 > 12 && isValidDateParts(y, p2, p1)) {
      return {
        year: y,
        month: p2,
        day: p1,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType: 'dd-MM-yyyy',
      };
    }
  }

  // dd.MM.yyyy: 25.02.2026 (only when first part > 12 to avoid ambiguity)
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) {
    const p1 = +m[1];
    const p2 = +m[2];
    const y = +m[3];
    if (p1 > 12 && isValidDateParts(y, p2, p1)) {
      return {
        year: y,
        month: p2,
        day: p1,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType: 'dd.MM.yyyy',
      };
    }
  }

  // Named month first: "February 25, 2026", "Feb 25, 2026", "February 25 2026"
  m = new RegExp(`^(${MONTH_NAMES_RE})\\s+(\\d{1,2}),?\\s+(\\d{4})$`, 'i').exec(
    s,
  );
  if (m) {
    const mo = MONTH_NAME_MAP[m[1].toLowerCase()];
    const d = +m[2];
    const y = +m[3];
    if (mo && isValidDateParts(y, mo, d)) {
      const isAbbr = MONTH_ABBR_SET.has(m[1].toLowerCase());
      return {
        year: y,
        month: mo,
        day: d,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType: isAbbr ? 'named-mdy-abbr' : 'named-mdy-full',
      };
    }
  }

  // Day first: "25 February 2026", "25 Feb 2026"
  m = new RegExp(`^(\\d{1,2})\\s+(${MONTH_NAMES_RE})\\s+(\\d{4})$`, 'i').exec(
    s,
  );
  if (m) {
    const d = +m[1];
    const mo = MONTH_NAME_MAP[m[2].toLowerCase()];
    const y = +m[3];
    if (mo && isValidDateParts(y, mo, d)) {
      const isAbbr = MONTH_ABBR_SET.has(m[2].toLowerCase());
      return {
        year: y,
        month: mo,
        day: d,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType: isAbbr ? 'named-dmy-abbr' : 'named-dmy-full',
      };
    }
  }

  // Abbreviated month with dashes: "Feb-25-2026"
  m = new RegExp(`^(${MONTH_ABBR_RE})-(\\d{1,2})-(\\d{4})$`, 'i').exec(s);
  if (m) {
    const mo = MONTH_NAME_MAP[m[1].toLowerCase()];
    const d = +m[2];
    const y = +m[3];
    if (mo && isValidDateParts(y, mo, d)) {
      return {
        year: y,
        month: mo,
        day: d,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatType: 'named-abbr-dashes',
      };
    }
  }

  return null;
}

function checkDateTime(str: string) {
  return detectDateFormat(str) !== null;
}

export function isdatetime(s: any) {
  if (s === null || s.toString().length < 5) {
    return false;
  }
  if (checkDateTime(s)) {
    return true;
  }
  return false;
}

export function diff(now: any, then: any) {
  return dayjs(now).diff(dayjs(then));
}

export function isdatatypemulti(s: any) {
  const type: any = {};

  if (isdatetime(s)) {
    type.date = true;
  }

  if (!Number.isNaN(parseFloat(s)) && !hasChinaword(s)) {
    type.num = true;
  }

  return type;
}

export function isdatatype(s: any) {
  let type = 'string';

  if (isdatetime(s)) {
    type = 'date';
  } else if (!Number.isNaN(parseFloat(s)) && !hasChinaword(s)) {
    type = 'num';
  }

  return type;
}

// 范围是否只包含部分合并单元格
export function hasPartMC(
  ctx: Context,
  cfg: any,
  r1: number,
  r2: number,
  c1: number,
  c2: number,
) {
  let ret = false;

  _.forEach(ctx.config.merge, (mc) => {
    if (r1 < mc.r) {
      if (r2 >= mc.r && r2 < mc.r + mc.rs - 1) {
        if (c1 >= mc.c && c1 <= mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c2 >= mc.c && c2 <= mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c1 < mc.c && c2 > mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
      } else if (r2 >= mc.r && r2 === mc.r + mc.rs - 1) {
        if (c1 > mc.c && c1 < mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c2 > mc.c && c2 < mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c1 === mc.c && c2 < mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c1 > mc.c && c2 === mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
      } else if (r2 > mc.r + mc.rs - 1) {
        if (c1 > mc.c && c1 <= mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c2 >= mc.c && c2 < mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c1 === mc.c && c2 < mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c1 > mc.c && c2 === mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
      }
    } else if (r1 === mc.r) {
      if (r2 < mc.r + mc.rs - 1) {
        if (c1 >= mc.c && c1 <= mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c2 >= mc.c && c2 <= mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c1 < mc.c && c2 > mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
      } else if (r2 >= mc.r + mc.rs - 1) {
        if (c1 > mc.c && c1 <= mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c2 >= mc.c && c2 < mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c1 === mc.c && c2 < mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
        if (c1 > mc.c && c2 === mc.c + mc.cs - 1) {
          ret = true;
          return false;
        }
      }
    } else if (r1 <= mc.r + mc.rs - 1) {
      if (c1 >= mc.c && c1 <= mc.c + mc.cs - 1) {
        ret = true;
        return false;
      }
      if (c2 >= mc.c && c2 <= mc.c + mc.cs - 1) {
        ret = true;
        return false;
      }
      if (c1 < mc.c && c2 > mc.c + mc.cs - 1) {
        ret = true;
        return false;
      }
    }
    return true;
  });

  return ret;
}
