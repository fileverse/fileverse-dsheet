export type FunctionParam = {
  name: string;
  detail: string;
  example: string;
  require: string;
  repeat: string;
  type: string;
};

export type SpreadsheetFunction = {
  API_KEY: string;
  LOGO: string;
  BRAND_COLOR: string;
  n: string;
  t: any;
  d: string;
  a: string;
  m?: number[];
  p: FunctionParam[];
  examples: { title: string; argumentString: string; description: string }[];
};
