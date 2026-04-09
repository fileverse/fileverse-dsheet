import {
  defaultContext,
  defaultSettings,
  Settings,
  Context,
  initSheetIndex,
  CellWithRowAndCol,
  GlobalCache,
  Sheet as SheetType,
  handleGlobalKeyDown,
  getSheetIndex,
  handlePaste,
  filterPatch,
  patchToOp,
  Op,
  inverseRowColOptions,
  ensureSheetIndex,
  CellMatrix,
  insertRowCol,
  deleteRowCol,
  // locale,
  // calcSelectionInfo,
  groupValuesRefresh,
  insertDuneChart,
  getFlowdata,
  api,
  handlePasteByClick,
  update, // formatting helper
  loadLocale,
} from '@sheet-engine/core';
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useImperativeHandle,
} from 'react';
import './index.css';
import produce, {
  applyPatches,
  enablePatches,
  Patch,
  produceWithPatches,
} from 'immer';
import _ from 'lodash';
import { getCryptoPrice } from '../../utils/cryptoApi';
import Sheet from '../Sheet';
import WorkbookContext, { RefValues, SetContextOptions } from '../../context';
import Toolbar from '../Toolbar';
import FxEditor from '../FxEditor';
import SheetTab from '../SheetTab';
import ContextMenu from '../ContextMenu';
import SVGDefines from '../SVGDefines';
import SheetTabContextMenu from '../ContextMenu/SheetTab';
import { generateAPIs } from './api';
import { ModalProvider } from '../../context/modal';
import FilterMenu from '../ContextMenu/FilterMenu';
import SheetList from '../SheetList';
import DunePreview from '../DunePreview/DunePreview';
// import ConditionRules from "../ConditionFormat/ConditionRules";

enablePatches();

export type WorkbookInstance = ReturnType<typeof generateAPIs>;

type AdditionalProps = {
  onChange?: (data: SheetType[]) => void;
  onOp?: (op: Op[]) => void;
};

const triggerGroupValuesRefresh = (ctx: Context) => {
  if (ctx.groupValuesRefreshData.length > 0) {
    groupValuesRefresh(ctx);
  }
};

const concatProducer = (...producers: ((ctx: Context) => void)[]) => {
  return (ctx: Context) => {
    producers.forEach((producer) => {
      producer(ctx);
    });
  };
};

const Workbook = React.forwardRef<WorkbookInstance, Settings & AdditionalProps>(
  ({ onChange, onOp, data: originalData, isFlvReadOnly, ...props }, ref) => {
    const globalCache = useRef<GlobalCache>({ undoList: [], redoList: [] });
    const cellInput = useRef<HTMLDivElement>(null);
    const fxInput = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const scrollbarX = useRef<HTMLDivElement>(null);
    const scrollbarY = useRef<HTMLDivElement>(null);
    const cellArea = useRef<HTMLDivElement>(null);
    const workbookContainer = useRef<HTMLDivElement>(null);

    const refs: RefValues = useMemo(
      () => ({
        globalCache: globalCache.current,
        cellInput,
        fxInput,
        canvas,
        scrollbarX,
        scrollbarY,
        cellArea,
        workbookContainer,
      }),
      [],
    );

    const [context, setContext] = useState(defaultContext(refs));
    // const { formula } = locale(context);

    const [moreToolbarItems, setMoreToolbarItems] =
      useState<React.ReactNode>(null);

    // const [calInfo, setCalInfo] = useState<{
    //   numberC: number;
    //   count: number;
    //   sum: number;
    //   max: number;
    //   min: number;
    //   average: string;
    // }>({
    //   numberC: 0,
    //   count: 0,
    //   sum: 0,
    //   max: 0,
    //   min: 0,
    //   average: "",
    // });

    const mergedSettings = useMemo(
      () => _.assign(_.cloneDeep(defaultSettings), props) as Required<Settings>,
      // props expect data, onChage, onOp
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [..._.values(props)],
    );

    // 计算选区的信息
    // useEffect(() => {
    //   const selection = context.luckysheet_select_save;
    //   const { lang } = props;
    //   if (selection) {
    //     const re = calcSelectionInfo(context, lang);
    //     setCalInfo(re);
    //   }
    //   // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [context.luckysheet_select_save]);

    const initSheetData = useCallback(
      (
        draftCtx: Context,
        newData: SheetType,
        index: number,
      ): CellMatrix | null => {
        const { celldata, row, column } = newData;
        const lastRow = _.maxBy<CellWithRowAndCol>(celldata, 'r');
        const lastCol = _.maxBy(celldata, 'c');
        let lastRowNum = (lastRow?.r ?? 0) + 1;
        let lastColNum = (lastCol?.c ?? 0) + 1;
        if (row != null && column != null && row > 0 && column > 0) {
          lastRowNum = Math.max(lastRowNum, row);
          lastColNum = Math.max(lastColNum, column);
        } else {
          lastRowNum = Math.max(lastRowNum, draftCtx.defaultrowNum);
          lastColNum = Math.max(lastColNum, draftCtx.defaultcolumnNum);
        }
        if (lastRowNum && lastColNum) {
          const expandedData: SheetType['data'] = _.times(lastRowNum, () =>
            _.times(lastColNum, () => null),
          );
          celldata?.forEach((d) => {
            // TODO setCellValue(draftCtx, d.r, d.c, expandedData, d.v);
            expandedData[d.r][d.c] = d.v;
            // if a date cell doesn't already have a formatted string, generate one
            const cell = d.v as any;
            if (
              cell &&
              cell.ct &&
              cell.ct.t === 'd' &&
              (cell.m === undefined || cell.m === null)
            ) {
              try {
                cell.m = update(cell.ct.fa || 'General', cell.v);
              } catch (e) {
                // fallback silently
              }
            }
          });
          draftCtx.luckysheetfile = produce(draftCtx.luckysheetfile, (d) => {
            d[index!].data = expandedData;
            delete d[index!].celldata;
            return d;
          });
          return expandedData;
        }
        return null;
      },
      [],
    );

    const emitOp = useCallback(
      (
        ctx: Context,
        patches: Patch[],
        options?: SetContextOptions,
        undo: boolean = false,
      ) => {
        if (onOp) {
          onOp(patchToOp(ctx, patches, options, undo));
        }
      },
      [onOp],
    );

    const emitYjsFromPatches = useCallback(
      (ctxBefore: Context, ctxAfter: Context, patches: Patch[]) => {
        const { updateCellYdoc, updateAllCell } = ctxBefore.hooks ?? {};
        if (!updateCellYdoc) return;

        const mapFields = new Set([
          'celldata',
          'calcChain',
          'dataBlockCalcFunction',
          'liveQueryList',
          'dataVerification',
          'hyperlink',
          'conditionRules',
        ]);

        // De-dupe: last patch wins for the same (sheetId + path[0] + key).
        const changeMap = new Map<string, any>();

        const upsert = (change: any) => {
          const k = `${change.sheetId}:${change.path?.[0] ?? ''}:${change.key ?? ''
            }`;
          changeMap.set(k, change);
        };

        const upsertCell = (sheetId: string, r: number, c: number) => {
          const cell =
            (getFlowdata(ctxAfter, sheetId) as any)?.[r]?.[c] ?? null;
          const key = `${r}_${c}`;
          upsert({
            sheetId,
            path: ['celldata'],
            key,
            value: { r, c, v: cell },
            type: cell == null ? 'delete' : 'update',
          });
        };

        // Best-effort: translate patches that touch sheet.data or any "map-like" objects keyed by "r_c".
        patches.forEach((p) => {
          const path = p.path as any[];
          if (path?.[0] !== 'luckysheetfile') return;
          const sheetIndex = path[1];
          if (!_.isNumber(sheetIndex)) return;

          const sheetBefore = ctxBefore.luckysheetfile?.[sheetIndex];
          const sheetAfter = ctxAfter.luckysheetfile?.[sheetIndex];
          const sheetId = (sheetAfter?.id || sheetBefore?.id) as
            | string
            | undefined;
          if (!sheetId) return;

          const root = path[2];

          if (root === 'data') {
            // Any patch under ["data", r, c, ...] -> update whole cell in Yjs.
            if (_.isNumber(path[3]) && _.isNumber(path[4])) {
              upsertCell(sheetId, path[3], path[4]);
              return;
            }

            // Row replacement ["data", r]
            if (_.isNumber(path[3]) && path.length === 4) {
              const r = path[3] as number;
              const beforeRow = (sheetBefore as any)?.data?.[r] ?? [];
              const afterRow = (sheetAfter as any)?.data?.[r] ?? [];
              const max = Math.max(beforeRow.length ?? 0, afterRow.length ?? 0);
              for (let c = 0; c < max; c += 1) {
                if (!_.isEqual(beforeRow[c] ?? null, afterRow[c] ?? null)) {
                  upsertCell(sheetId, r, c);
                }
              }
              return;
            }

            // Whole-matrix replacement ["data"] (rare). If huge, fall back to updateAllCell when available.
            if (path.length === 3) {
              const dataAfter = (sheetAfter as any)?.data as
                | any[][]
                | undefined;
              const rows = dataAfter?.length ?? 0;
              const cols = rows > 0 ? (dataAfter?.[0]?.length ?? 0) : 0;
              const size = rows * cols;
              if (size > 50000 && updateAllCell) {
                updateAllCell(sheetId);
                return;
              }
              for (let r = 0; r < rows; r += 1) {
                const beforeRow = (sheetBefore as any)?.data?.[r] ?? [];
                const afterRow = (sheetAfter as any)?.data?.[r] ?? [];
                const max = Math.max(
                  beforeRow.length ?? 0,
                  afterRow.length ?? 0,
                );
                for (let c = 0; c < max; c += 1) {
                  if (!_.isEqual(beforeRow[c] ?? null, afterRow[c] ?? null)) {
                    upsertCell(sheetId, r, c);
                  }
                }
              }
            }
            return;
          }

          // Map-like objects on sheet keyed by "r_c": ["hyperlink", "0_1"], etc.
          if (typeof root === 'string' && mapFields.has(root)) {
            const key = path[3];
            if (typeof key === 'string') {
              upsert({
                sheetId,
                path: [root],
                key,
                value: p.value,
                type:
                  p.op === 'remove' || p.value == null ? 'delete' : 'update',
              });
            }
          }
        });

        const changes = Array.from(changeMap.values());
        if (changes.length > 0) updateCellYdoc(changes);
      },
      [],
    );

    function reduceUndoList(ctx: Context, ctxBefore: Context) {
      const sheetsId = ctx.luckysheetfile.map((sheet) => sheet.id);
      const sheetDeletedByMe = globalCache.current.undoList
        .filter((undo) => undo.options?.deleteSheetOp)
        .map((item) => item.options?.deleteSheetOp?.id);
      globalCache.current.undoList = globalCache.current.undoList.filter(
        (undo) =>
          undo.options?.deleteSheetOp ||
          undo.options?.id === undefined ||
          _.indexOf(sheetsId, undo.options?.id) !== -1 ||
          _.indexOf(sheetDeletedByMe, undo.options?.id) !== -1,
      );
      if (ctxBefore.luckysheetfile.length > ctx.luckysheetfile.length) {
        const sheetDeleted = ctxBefore.luckysheetfile
          .filter(
            (oneSheet) =>
              _.indexOf(
                ctx.luckysheetfile.map((item) => item.id),
                oneSheet.id,
              ) === -1,
          )
          .map((item) => getSheetIndex(ctxBefore, item.id as string));
        const deletedIndex = sheetDeleted[0];
        globalCache.current.undoList = globalCache.current.undoList.map(
          (oneStep) => {
            oneStep.patches = oneStep.patches.map((onePatch) => {
              if (
                typeof onePatch.path[1] === 'number' &&
                onePatch.path[1] > (deletedIndex as number)
              ) {
                onePatch.path[1] -= 1;
              }
              return onePatch;
            });
            oneStep.inversePatches = oneStep.inversePatches.map((onePatch) => {
              if (
                typeof onePatch.path[1] === 'number' &&
                onePatch.path[1] > (deletedIndex as number)
              ) {
                onePatch.path[1] -= 1;
              }
              return onePatch;
            });
            return oneStep;
          },
        );
      }
    }

    function dataToCelldata(data: CellMatrix) {
      const cellData: CellWithRowAndCol[] = [];
      for (let row = 0; row < data?.length; row += 1) {
        for (let col = 0; col < data[row]?.length; col += 1) {
          if (data[row][col] !== null) {
            cellData.push({
              r: row,
              c: col,
              v: data[row][col],
            });
          }
        }
      }
      return cellData;
    }

    const setContextWithProduce = useCallback(
      (recipe: (ctx: Context) => void, options: SetContextOptions = {}) => {
        setContext((ctx_) => {
          const [result, patches, inversePatches] = produceWithPatches(
            ctx_,
            concatProducer(recipe, triggerGroupValuesRefresh),
          );
          if (patches.length > 0 && !options.noHistory) {
            if (options.logPatch) {
              console.info('patch', patches);
            }
            const filteredPatches = filterPatch(patches);
            let filteredInversePatches = filterPatch(inversePatches);
            if (filteredInversePatches.length > 0) {
              options.id = ctx_.currentSheetId;
              if (options.deleteSheetOp) {
                const target = ctx_.luckysheetfile.filter(
                  (sheet) => sheet.id === options.deleteSheetOp?.id,
                );
                if (target) {
                  const index = getSheetIndex(
                    ctx_,
                    options.deleteSheetOp.id as string,
                  ) as number;
                  options.deletedSheet = {
                    id: options.deleteSheetOp.id as string,
                    index: index as number,
                    value: _.cloneDeep(ctx_.luckysheetfile[index]),
                  };
                  options.deletedSheet!.value!.celldata = dataToCelldata(
                    options.deletedSheet!.value!.data as CellMatrix,
                  );
                  delete options.deletedSheet!.value!.data;
                  options.deletedSheet.value!.status = 0;
                  filteredInversePatches = [
                    {
                      op: 'add',
                      path: ['luckysheetfile', 0],
                      value: options.deletedSheet.value,
                    },
                  ];
                }
              } else if (options.addSheetOp) {
                options.addSheet = {};
                options.addSheet!.id =
                  result.luckysheetfile[result.luckysheetfile.length - 1].id;
              }
              globalCache.current.undoList.push({
                patches: filteredPatches,
                inversePatches: filteredInversePatches,
                options,
              });
              globalCache.current.redoList = [];
              emitOp(result, filteredPatches, options);
            }
          } else {
            if (patches?.[0]?.value?.length < ctx_?.luckysheetfile?.length) {
              reduceUndoList(result, ctx_);
            }
          }
          return result;
        });
      },
      [emitOp],
    );

    const handleUndo = useCallback(() => {
      const history = globalCache.current.undoList.pop();
      if (history) {
        setContext((ctx_) => {
          const isBorderUndo = history.patches.some(
            (onePatch) => onePatch.value?.borderInfo,
          );

          if (history.options?.deleteSheetOp) {
            history.inversePatches[0].path[1] = ctx_.luckysheetfile.length;
            const order = history.options.deletedSheet?.value?.order as number;
            const sheetsRight = ctx_.luckysheetfile.filter(
              (sheet) =>
                (sheet?.order as number) >= (order as number) &&
                sheet.id !== history?.options?.deleteSheetOp?.id,
            );
            _.forEach(sheetsRight, (sheet) => {
              history.inversePatches.push({
                op: 'replace',
                path: [
                  'luckysheetfile',
                  getSheetIndex(ctx_, sheet.id as string) as number,
                  'order',
                ],
                value: (sheet?.order as number) + 1,
              } as Patch);
            });
          }
          const newContext = applyPatches(ctx_, history.inversePatches);
          globalCache.current.redoList.push(history);
          const inversedOptions = inverseRowColOptions(history.options);
          if (inversedOptions?.insertRowColOp) {
            inversedOptions.restoreDeletedCells = true;
          }
          if (history.options?.addSheetOp) {
            const index = getSheetIndex(
              ctx_,
              history.options.addSheet!.id as string,
            ) as number;
            inversedOptions!.addSheet = {
              id: history.options.addSheet!.id as string,
              index: index as number,
              value: _.cloneDeep(ctx_.luckysheetfile[index]),
            };
            inversedOptions!.addSheet!.value!.celldata = dataToCelldata(
              inversedOptions!.addSheet!.value?.data as CellMatrix,
            );
            delete inversedOptions!.addSheet!.value!.data;
          }
          emitOp(newContext, history.inversePatches, inversedOptions, true);
          emitYjsFromPatches(ctx_, newContext, history.inversePatches);
          // Sync ctx.config from current sheet after applying inverse patches.
          // This ensures components watching context.config (e.g. Sheet.tsx which
          // recalculates visibledatacolumn) react correctly to config changes.
          const sheetIdxAfterUndo = getSheetIndex(
            newContext,
            newContext.currentSheetId,
          );
          let nw = {
            ...newContext,
            ...(sheetIdxAfterUndo != null &&
              newContext.luckysheetfile[sheetIdxAfterUndo]?.config != null
              ? {
                config: newContext.luckysheetfile[sheetIdxAfterUndo].config,
              }
              : {}),
          };
          if (isBorderUndo) {
            const nwborderlist = nw?.config?.borderInfo?.slice(0, -1);
            nw = {
              ...nw,
              config: {
                ...nw.config,
                borderInfo: nwborderlist,
              },
            };
          }
          return nw;
        });
      }
    }, [emitOp, globalCache]);

    const handleRedo = useCallback(() => {
      const history = globalCache.current.redoList.pop();
      if (history) {
        setContext((ctx_) => {
          const newContext = applyPatches(ctx_, history.patches);
          const isBorderUndo = history.patches.some(
            (onePatch) => onePatch.value?.borderInfo,
          );

          globalCache.current.undoList.push(history);
          emitOp(newContext, history.patches, history.options);
          emitYjsFromPatches(ctx_, newContext, history.patches);
          // Sync ctx.config from current sheet after applying patches.
          const sheetIdxAfterRedo = getSheetIndex(
            newContext,
            newContext.currentSheetId,
          );
          let nw = {
            ...newContext,
            ...(sheetIdxAfterRedo != null &&
              newContext.luckysheetfile[sheetIdxAfterRedo]?.config != null
              ? {
                config: newContext.luckysheetfile[sheetIdxAfterRedo].config,
              }
              : {}),
          };
          if (isBorderUndo) {
            const nwborderlist = (nw?.config?.borderInfo ?? []).concat(
              history.patches[0].value?.borderInfo[0],
            );
            nw = {
              ...nw,
              config: {
                ...nw.config,
                borderInfo: nwborderlist,
              },
            };
          }
          return nw;
        });
      }
    }, [emitOp, globalCache]);

    useEffect(() => {
      mergedSettings.hooks?.afterActivateSheet?.(context.currentSheetId);
    }, [context.currentSheetId]);

    useEffect(() => {
      getCryptoPrice('bitcoin', 'usd');
    }, []);

    useEffect(() => {
      setContext((ctx: any) => {
        const gridData = getFlowdata(ctx);
        const cellData = api.dataToCelldata(gridData as any);
        const denominatedUsed = (cellData ?? []).some((cell: any) => {
          const value = cell?.v?.m?.toString();
          return (
            value?.includes('BTC') ||
            value?.includes('ETH') ||
            value?.includes('SOL')
          );
        });
        const denoWarn = document.getElementById('denomination-warning');
        const scrollBar = document.getElementsByClassName(
          'luckysheet-scrollbar-x',
        )[0] as HTMLElement;
        if (denominatedUsed && denoWarn) {
          denoWarn.style.display = 'block';
          denoWarn.style.left = '0px';
          if (scrollBar) {
            scrollBar.setAttribute(
              'style',
              'bottom: 36px !important; width: calc(100% - 60px);',
            );
          }
        } else if (!denominatedUsed && denoWarn) {
          denoWarn.style.display = 'none';
          denoWarn.style.left = '-9999px';
          if (scrollBar) {
            scrollBar.setAttribute(
              'style',
              'bottom: 10px !important; width: calc(100% - 60px);',
            );
          }
        }
        return ctx;
      });

      if (context.luckysheet_select_save != null) {
        mergedSettings.hooks?.afterSelectionChange?.(
          context.currentSheetId,
          context.luckysheet_select_save[0],
        );
      }
    }, [
      context.currentSheetId,
      context.luckysheet_select_save,
      mergedSettings.hooks,
    ]);

    const providerValue = useMemo(
      () => ({
        context,
        setContext: setContextWithProduce,
        settings: mergedSettings,
        handleUndo,
        handleRedo,
        refs,
      }),
      [
        context,
        handleRedo,
        handleUndo,
        mergedSettings,
        refs,
        setContextWithProduce,
      ],
    );

    useEffect(() => {
      if (context?.hooks?.sheetLengthChange) {
        context.hooks.sheetLengthChange();
      }
    }, [context.luckysheetfile.length]);

    const currentSheet = useMemo(() => {
      return context?.luckysheetfile?.find(
        (sheet) => sheet.id === context?.currentSheetId,
      );
    }, [context?.luckysheetfile, context?.currentSheetId]);

    useEffect(() => {
      if (context?.hooks?.calcChainChange) {
        context.hooks.calcChainChange();
      }
    }, [currentSheet?.calcChain]);

    useEffect(() => {
      if (context?.hooks?.afterImagesChange) {
        context.hooks.afterImagesChange();
      }
    }, [currentSheet?.images]);

    useEffect(() => {
      if (context?.hooks?.afterIframesChange) {
        context.hooks.afterIframesChange();
      }
    }, [currentSheet?.iframes]);

    useEffect(() => {
      if (context?.hooks?.afterFrozenChange) {
        context.hooks.afterFrozenChange();
      }
    }, [currentSheet?.frozen]);

    useEffect(() => {
      if (context?.hooks?.afterOrderChanges) {
        context.hooks.afterOrderChanges();
      }
    }, [currentSheet?.order]);

    const sheetColorSig = useMemo(() => {
      return (context?.luckysheetfile ?? [])
        .map((s) => `${s.id}:${s.color ?? ''}`)
        .join('|');
    }, [context?.luckysheetfile]);

    useEffect(() => {
      if (context?.hooks?.afterColorChanges) {
        context.hooks.afterColorChanges();
      }
    }, [sheetColorSig]);

    const sheetHideSig = useMemo(() => {
      return (context?.luckysheetfile ?? [])
        .map((s) => `${s.id}:${s.hide ?? 0}`)
        .join('|');
    }, [context?.luckysheetfile]);

    useEffect(() => {
      if (context?.hooks?.afterHideChanges) {
        context.hooks.afterHideChanges();
      }
    }, [sheetHideSig]);

    useEffect(() => {
      if (context?.hooks?.afterConfigChanges) {
        context.hooks.afterConfigChanges();
      }
    }, [currentSheet?.config]);

    useEffect(() => {
      if (context?.hooks?.afterColRowChanges) {
        context.hooks.afterColRowChanges();
      }
    }, [currentSheet?.row, currentSheet?.column]);

    useEffect(() => {
      if (context?.hooks?.afterShowGridLinesChange) {
        context.hooks.afterShowGridLinesChange();
      }
    }, [currentSheet?.showGridLines]);

    useEffect(() => {
      if (context?.hooks?.afterNameChanges) {
        context.hooks.afterNameChanges();
      }
    }, [currentSheet?.name]);

    useEffect(() => {
      if (context?.hooks?.afterStatusChanges) {
        context.hooks.afterStatusChanges();
      }
    }, [currentSheet?.status]);

    useEffect(() => {
      if (context?.hooks?.dataVerificationChange) {
        context.hooks.dataVerificationChange();
      }
    }, [currentSheet?.dataVerification]);

    useEffect(() => {
      if (context?.hooks?.liveQueryChange) {
        context.hooks.liveQueryChange();
      }
    }, [currentSheet?.liveQueryList]);

    useEffect(() => {
      if (context?.hooks?.imageListChange) {
        context.hooks.imageListChange();
      }
    }, [currentSheet?.images]);

    useEffect(() => {
      if (context?.hooks?.iframeListChange) {
        context.hooks.iframeListChange();
      }
    }, [currentSheet?.iframes]);

    useEffect(() => {
      if (context?.hooks?.conditionRulesChange) {
        context.hooks.conditionRulesChange();
      }
    }, [currentSheet?.conditionRules]);

    useEffect(() => {
      if (context?.hooks?.conditionFormatChange) {
        context.hooks.conditionFormatChange();
      }
    }, [currentSheet?.luckysheet_conditionformat_save]);

    useEffect(() => {
      if (context?.hooks?.filterSelectChange) {
        context.hooks.filterSelectChange();
      }
    }, [currentSheet?.filter_select]);

    useEffect(() => {
      if (context?.hooks?.filterChange) {
        context.hooks.filterChange();
      }
    }, [currentSheet?.filter]);

    useEffect(() => {
      if (context?.hooks?.hyperlinkChange) {
        context.hooks.hyperlinkChange();
      }
    }, [currentSheet?.hyperlink]);

    useEffect(() => {
      if (!_.isEmpty(context.luckysheetfile)) {
        onChange?.(context.luckysheetfile);
      }
    }, [context.luckysheetfile, onChange]);

    useEffect(() => {
      const init = async () => {
        const resolvedLang: string =
          mergedSettings.lang ??
          ((navigator.languages && navigator.languages[0]) ||
            navigator.language ||
            // @ts-ignore
            navigator.userLanguage ||
            'en');
        await loadLocale(resolvedLang);
        setContextWithProduce(
          (draftCtx) => {
            draftCtx.defaultcolumnNum = mergedSettings.column;
            draftCtx.defaultrowNum = mergedSettings.row;
            draftCtx.defaultFontSize = mergedSettings.defaultFontSize;
            if (_.isEmpty(draftCtx.luckysheetfile)) {
              const newData = produce(originalData, (draftData) => {
                ensureSheetIndex(draftData, mergedSettings.generateSheetId);
              });
              draftCtx.luckysheetfile = newData;
              newData.forEach((newDatum) => {
                const index = getSheetIndex(draftCtx, newDatum.id!) as number;
                const sheet = draftCtx.luckysheetfile?.[index];
                initSheetData(draftCtx, sheet, index);
              });
            }
            if (mergedSettings.devicePixelRatio > 0) {
              draftCtx.devicePixelRatio = mergedSettings.devicePixelRatio;
            }
            draftCtx.lang = resolvedLang;
            draftCtx.allowEdit = mergedSettings.allowEdit;
            draftCtx.isFlvReadOnly = isFlvReadOnly ?? false;
            draftCtx.hooks = mergedSettings.hooks;
            // draftCtx.fontList = mergedSettings.fontList;
            if (_.isEmpty(draftCtx.currentSheetId)) {
              initSheetIndex(draftCtx);
            }
            let sheetIdx = getSheetIndex(draftCtx, draftCtx.currentSheetId);
            if (sheetIdx == null) {
              if ((draftCtx.luckysheetfile?.length ?? 0) > 0) {
                sheetIdx = 0;
                draftCtx.currentSheetId = draftCtx.luckysheetfile[0].id!;
              }
            }
            if (sheetIdx == null) return;

            const sheet = draftCtx.luckysheetfile?.[sheetIdx];
            if (!sheet) return;

            let { data } = sheet;
            // expand cell data
            if (_.isEmpty(data)) {
              const temp = initSheetData(draftCtx, sheet, sheetIdx);
              if (!_.isNull(temp)) {
                data = temp;
              }
            }

            if (
              _.isEmpty(draftCtx.luckysheet_select_save) &&
              !_.isEmpty(sheet.luckysheet_select_save)
            ) {
              draftCtx.luckysheet_select_save = sheet.luckysheet_select_save;
            }
            if (draftCtx.luckysheet_select_save?.length === 0) {
              if (
                data?.[0]?.[0]?.mc &&
                !_.isNil(data?.[0]?.[0]?.mc?.rs) &&
                !_.isNil(data?.[0]?.[0]?.mc?.cs)
              ) {
                draftCtx.luckysheet_select_save = [
                  {
                    row: [0, data[0][0].mc.rs - 1],
                    column: [0, data[0][0].mc.cs - 1],
                  },
                ];
              } else {
                draftCtx.luckysheet_select_save = [
                  {
                    row: [0, 0],
                    column: [0, 0],
                  },
                ];
              }
            }

            draftCtx.config = _.isNil(sheet.config) ? {} : sheet.config;
            draftCtx.insertedImgs = sheet.images;
            draftCtx.insertedIframes = sheet.iframes;
            draftCtx.currency = mergedSettings.currency || '¥';

            draftCtx.zoomRatio = _.isNil(sheet.zoomRatio) ? 1 : sheet.zoomRatio;
            draftCtx.rowHeaderWidth =
              mergedSettings.rowHeaderWidth * draftCtx.zoomRatio;
            draftCtx.columnHeaderHeight =
              mergedSettings.columnHeaderHeight * draftCtx.zoomRatio;

            if (!_.isNil(sheet.defaultRowHeight)) {
              draftCtx.defaultrowlen = Number(sheet.defaultRowHeight);
            } else {
              draftCtx.defaultrowlen = mergedSettings.defaultRowHeight;
            }

            if (!_.isNil(sheet.addRows)) {
              draftCtx.addDefaultRows = Number(sheet.addRows);
            } else {
              draftCtx.addDefaultRows = mergedSettings.addRows;
            }

            if (!_.isNil(sheet.defaultColWidth)) {
              draftCtx.defaultcollen = Number(sheet.defaultColWidth);
            } else {
              draftCtx.defaultcollen = mergedSettings.defaultColWidth;
            }

            if (!_.isNil(sheet.showGridLines)) {
              const { showGridLines } = sheet;
              if (showGridLines === 0 || showGridLines === false) {
                draftCtx.showGridLines = false;
              } else {
                draftCtx.showGridLines = true;
              }
            } else {
              draftCtx.showGridLines = true;
            }
          },
          { noHistory: true },
        );
      };
      init();
    }, [
      context.currentSheetId,
      context.luckysheetfile.length,
      originalData,
      mergedSettings.defaultRowHeight,
      mergedSettings.defaultColWidth,
      mergedSettings.column,
      mergedSettings.row,
      mergedSettings.defaultFontSize,
      mergedSettings.devicePixelRatio,
      mergedSettings.lang,
      mergedSettings.allowEdit,
      mergedSettings.hooks,
      mergedSettings.generateSheetId,
      setContextWithProduce,
      initSheetData,
      mergedSettings.rowHeaderWidth,
      mergedSettings.columnHeaderHeight,
      mergedSettings.addRows,
      mergedSettings.currency,
    ]);

    const isMac = navigator.platform.toUpperCase().includes('MAC');

    let waitingForRInsertRow = false;
    let resetInsertRowTimer: any;

    let waitingForDelRow = false;
    let resetDeleteRowTimer: any;

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        // @ts-expect-error later
        const { getSelection, getSheet, setSelection } = ref.current;
        const currentSelection = getSelection()?.[0];

        // Mac: Cmd + Option + =/+ inserts based on full row/column selection.
        const isMacQuickInsert =
          isMac &&
          e.metaKey &&
          e.altKey &&
          (e.code === 'Equal' || e.code === 'NumpadAdd');
        if (isMacQuickInsert && currentSelection) {
          let insertRowColOp: SetContextOptions['insertRowColOp'] | undefined;
          if (currentSelection.column_select) {
            insertRowColOp = {
              type: 'column',
              index: currentSelection.column[0],
              count: 1,
              direction: 'lefttop',
              id: context.currentSheetId,
            };
          } else if (currentSelection.row_select) {
            insertRowColOp = {
              type: 'row',
              index: currentSelection.row[1],
              count: 1,
              direction: 'rightbottom',
              id: context.currentSheetId,
            };
          }

          if (insertRowColOp) {
            const range = context.luckysheet_select_save;
            setContextWithProduce(
              (draftCtx) => {
                insertRowCol(draftCtx, insertRowColOp!);
                draftCtx.luckysheet_select_save = range;
              },
              { insertRowColOp },
            );
            e.preventDefault();
            return;
          }
        }

        // -------Insert-row-col--------
        // Step 1: Detect the initial shortcut combo (Alt + I on Win, Ctrl + Option + I on Mac)
        const isMacShortcutInsertRow = isMac && e.ctrlKey && e.altKey;
        const isWindowsShortcutInsertRow = !isMac && e.altKey;
        if (
          (isMacShortcutInsertRow || isWindowsShortcutInsertRow) &&
          e.code === 'KeyI'
        ) {
          waitingForRInsertRow = true;
          clearTimeout(resetInsertRowTimer);
          resetInsertRowTimer = setTimeout(() => {
            waitingForRInsertRow = false;
          }, 3000); // 3 seconds to press R
          e.preventDefault();
          return;
        }
        if (waitingForRInsertRow && (e.code === 'KeyR' || e.code === 'KeyC')) {
          const direction = 'rightbottom';
          let position;
          let insertRowColOp: SetContextOptions['insertRowColOp'];
          if (e.code === 'KeyR') {
            position = getSelection()[0].row[1];
            insertRowColOp = {
              type: 'row',
              index: position,
              count: 1,
              direction,
              id: context.currentSheetId,
            };
          } else {
            position = getSelection()[0].column[1];
            insertRowColOp = {
              type: 'column',
              index: position,
              count: 1,
              direction,
              id: context.currentSheetId,
            };
          }
          if (!position) return;
          const range = context.luckysheet_select_save;
          setContextWithProduce(
            (draftCtx) => {
              if (insertRowColOp) insertRowCol(draftCtx, insertRowColOp);
              draftCtx.luckysheet_select_save = range;
            },
            {
              insertRowColOp,
            },
          );

          waitingForRInsertRow = false;
          clearTimeout(resetInsertRowTimer);
          e.preventDefault();
        }

        // -------Delete-row-col--------

        const isDashKey = e.key === '-' || e.code === 'Minus';
        const isSecondShortcut = isMac
          ? e.ctrlKey && e.altKey && isDashKey // Ctrl + Option + -
          : e.ctrlKey && e.altKey && isDashKey; // Ctrl + Alt + -

        if (isSecondShortcut) {
          waitingForDelRow = true;

          // Set a timeout to cancel if R or C isn’t pressed in time
          clearTimeout(resetDeleteRowTimer);
          resetDeleteRowTimer = setTimeout(() => {
            waitingForDelRow = false;
            console.log('Timeout: No second key (R or C) pressed in time.');
          }, 3000); // 3 seconds to press R or C

          e.preventDefault();
          return;
        }

        if (waitingForDelRow && (e.code === 'KeyR' || e.code === 'KeyC')) {
          let st_index: number;
          let ed_index: number;
          if (e.code === 'KeyR') {
            [st_index, ed_index] = getSelection()[0].row;
            const range = context.luckysheet_select_save;
            setContextWithProduce((draftCtx) => {
              deleteRowCol(draftCtx, {
                type: 'row',
                start: st_index,
                end: ed_index,
                id: context.currentSheetId,
              });
              draftCtx.luckysheet_select_save = range;
            });
          } else {
            [st_index, ed_index] = getSelection()[0].column;
            const range = context.luckysheet_select_save;
            setContextWithProduce((draftCtx) => {
              deleteRowCol(draftCtx, {
                type: 'column',
                start: st_index,
                end: ed_index,
                id: context.currentSheetId,
              });
              draftCtx.luckysheet_select_save = range;
            });
          }

          waitingForDelRow = false; // Reset the waiting state
          clearTimeout(resetDeleteRowTimer);
          e.preventDefault();
          return;
        }

        // -------Select-row-col----------

        if (e.ctrlKey && e.code === 'Space') {
          e.stopPropagation();
          e.preventDefault();
          const selection = getSelection();
          const selectedCol = selection?.[0].column;
          const totalRow = getSheet().data.length;
          setSelection([{ row: [0, totalRow - 1], column: selectedCol }]);
        }
        if (e.shiftKey && e.code === 'Space') {
          e.stopPropagation();
          e.preventDefault();
          const selection = getSelection();
          const selectedRow = selection?.[0].row;
          const totalCol = getSheet().data[0].length;
          setSelection([{ row: selectedRow, column: [0, totalCol - 1] }]);
        }

        // -----------

        /** past without format */
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyV') {
          navigator.clipboard.readText().then((clipboardText) => {
            setContextWithProduce((safeCtx: any) => {
              handlePasteByClick(safeCtx, clipboardText);
            });
          });
        }

        const { nativeEvent } = e;
        // handling undo and redo ahead because handleUndo and handleRedo
        // themselves are calling setContext, and should not be nested
        // in setContextWithProduce.
        if (
          (e.ctrlKey || e.metaKey) &&
          e.code === 'KeyZ' &&
          context.luckysheetCellUpdate.length === 0
        ) {
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          e.stopPropagation();
          return;
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          e.code === 'KeyY' &&
          context.luckysheetCellUpdate.length === 0
        ) {
          handleRedo();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        setContextWithProduce((draftCtx) => {
          handleGlobalKeyDown(
            draftCtx,
            cellInput.current!,
            fxInput.current!,
            nativeEvent,
            globalCache.current!,
            handleUndo, // still passing handleUndo and handleRedo here to satisfy API
            handleRedo,
            canvas.current!.getContext('2d')!,
          );
        });
      },
      [handleRedo, handleUndo, setContextWithProduce],
    );

    const onPaste = useCallback(
      (e: ClipboardEvent) => {
        let startPaste = true;
        // deal with multi instance case, only the focused sheet handles the paste
        if (
          cellInput.current === document.activeElement ||
          document.activeElement?.className === 'fortune-sheet-overlay'
        ) {
          if (!startPaste) return;
          let { clipboardData } = e;
          if (!clipboardData) {
            // @ts-ignore
            // for IE
            clipboardData = window.clipboardData;
          }
          const txtdata =
            clipboardData!.getData('text/html') ||
            clipboardData!.getData('text/plain');
          const ele = document.createElement('div');
          ele.innerHTML = txtdata;

          const trList = ele.querySelectorAll('table tr');
          const maxRow =
            trList.length + context.luckysheet_select_save![0].row[0];
          const rowToBeAdded =
            maxRow -
            context.luckysheetfile[
              getSheetIndex(
                context,
                context!.currentSheetId! as string,
              ) as number
            ].data!.length;
          const range = context.luckysheet_select_save;
          if (rowToBeAdded > 0) {
            const insertRowColOp: SetContextOptions['insertRowColOp'] = {
              type: 'row',
              index:
                context.luckysheetfile[
                  getSheetIndex(
                    context,
                    context!.currentSheetId! as string,
                  ) as number
                ].data!.length - 1,
              count: rowToBeAdded,
              direction: 'rightbottom',
              id: context.currentSheetId,
            };
            setContextWithProduce(
              (draftCtx) => {
                insertRowCol(draftCtx, insertRowColOp);
                draftCtx.luckysheet_select_save = range;
              },
              {
                insertRowColOp,
              },
            );
          }
          setContextWithProduce((draftCtx) => {
            try {
              if (startPaste) {
                startPaste = false;
                handlePaste(draftCtx, e);
              }
            } catch (err: any) {
              console.error(err);
            }
          });
        }
        setContextWithProduce((ctx: any) => {
          if (ctx.luckysheet_selection_range) {
            ctx.luckysheet_selection_range = [];
          }
        });
      },
      [context, setContextWithProduce],
    );

    const onMoreToolbarItemsClose = useCallback(() => {
      setMoreToolbarItems(null);
    }, []);

    useEffect(() => {
      document.addEventListener('paste', onPaste);
      return () => {
        document.removeEventListener('paste', onPaste);
      };
    }, [onPaste]);

    // expose APIs
    useImperativeHandle(
      ref,
      () =>
        generateAPIs(
          context,
          setContextWithProduce,
          handleUndo,
          handleRedo,
          mergedSettings,
          cellInput.current,
          scrollbarX.current,
          scrollbarY.current,
          globalCache.current,
          refs,
        ),
      [
        context,
        setContextWithProduce,
        handleUndo,
        handleRedo,
        mergedSettings,
        globalCache,
      ],
    );

    const i = getSheetIndex(context, context.currentSheetId);
    if (i == null) {
      return null;
    }
    const sheet = context.luckysheetfile?.[i];
    if (!sheet) {
      return null;
    }

    return (
      <WorkbookContext.Provider value={providerValue}>
        {/* <button onClick={()=>{
          setShow(!show)
          id="placeholder-data-verification placeholder-conditional-format"
        }}>Click</button> */}
        {/* <div
          id="placeholder-conditional-format"
          style={{
            width: "500px",
            height: "500px",
            position: "fixed",
            zIndex: "1000",
            backgroundColor: "white",
            padding: "12px",
            top: "100px",
          }}
        /> */}
        <ModalProvider>
          <div
            className="fortune-container"
            ref={workbookContainer}
            onKeyDown={onKeyDown}
            tabIndex={-1}
          >
            <SVGDefines currency={mergedSettings.currency} />
            <div className="fortune-workarea">
              {mergedSettings.showToolbar && (
                <Toolbar
                  moreItemsOpen={moreToolbarItems !== null}
                  setMoreItems={setMoreToolbarItems}
                  onMoreToolbarItemsClose={onMoreToolbarItemsClose}
                  moreToolbarItems={moreToolbarItems}
                />
              )}
              {mergedSettings.showFormulaBar && <FxEditor />}
            </div>
            <Sheet sheet={sheet} />
            {mergedSettings.showSheetTabs && <SheetTab />}
            <ContextMenu />
            <FilterMenu />
            <SheetTabContextMenu />
            {context.showSheetList && <SheetList />}
            {!_.isEmpty(context.contextMenu) && (
              <div
                onMouseDown={() => {
                  setContextWithProduce((draftCtx) => {
                    draftCtx.contextMenu = {};
                    draftCtx.filterContextMenu = undefined;
                    draftCtx.showSheetList = undefined;
                  });
                }}
                onMouseMove={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="fortune-popover-backdrop"
              />
            )}
            <div className="fortune-stat-area">
              <div className="luckysheet-sheet-selection-calInfo">
                {/* {!!calInfo.count && (
                  <div style={{ width: "60px" }}>
                    {formula.count}: {calInfo.count}
                  </div>
                )}
                {!!calInfo.numberC && !!calInfo.sum && (
                  <div>
                    {formula.sum}: {calInfo.sum}
                  </div>
                )}
                {!!calInfo.numberC && !!calInfo.average && (
                  <div>
                    {formula.average}: {calInfo.average}
                  </div>
                )}
                {!!calInfo.numberC && !!calInfo.max && (
                  <div>
                    {formula.max}: {calInfo.max}
                  </div>
                )}
                {!!calInfo.numberC && !!calInfo.min && (
                  <div>
                    {formula.min}: {calInfo.min}
                  </div>
                )} */}
              </div>
            </div>
            {context.showDunePreview && (
              <DunePreview
                url={context.showDunePreview.url}
                position={context.showDunePreview.position}
                onKeepAsLink={() => {
                  setContextWithProduce(
                    (draftCtx) => {
                      draftCtx.showDunePreview = undefined;
                    },
                    { noHistory: true },
                  );
                }}
                onEmbed={() => {
                  setContextWithProduce(
                    (draftCtx) => {
                      insertDuneChart(draftCtx, context.showDunePreview!.url);
                      draftCtx.showDunePreview = undefined;
                    },
                    { noHistory: true },
                  );
                  mergedSettings.onDuneChartEmbed?.();
                }}
              />
            )}
          </div>
        </ModalProvider>
      </WorkbookContext.Provider>
    );
  },
);

export default Workbook;
