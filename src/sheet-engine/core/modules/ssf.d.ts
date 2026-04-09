declare const SSF: {
  format: (fmt: string, v: any) => string;
  is_date: (fmt: string, v?: any) => boolean;
  load: (fmt: string, idx: number) => void;
  load_table: (tbl: Record<number, string | undefined>) => void;
  init_table: (t?: any) => void;
  [key: string]: any;
};
export default SSF;
