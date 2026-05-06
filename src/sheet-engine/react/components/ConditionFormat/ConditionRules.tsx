import React, {
  useRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';
import './index.css';
import {
  cn,
  Button,
  IconButton,
  LucideIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  TextField,
} from '@fileverse/ui';
import {
  locale,
  setConditionRules,
  getSheetIndex,
  getRangeByTxt,
  isValidRangeText,
  parseCfDateConditionForUi,
  formatCfDatePresetSnapshot,
  CF_DATE_DEFAULT_FORMAT,
  parseDdMmYyyyToSerial,
  type Context,
} from '@sheet-engine/core';
import produce from 'immer';
import { numberToColumn } from '../SheetOverlay/helper';

import WorkbookContext from '../../context';
import { useDialog } from '../../hooks/useDialog';
import { getDisplayedRangeTxt } from '../DataVerification/getDisplayedRangeTxt';
import Combo from '../Toolbar/Combo';
import { CustomColor } from '../Toolbar/CustomColor';
import { injectDatepickerStyles } from '../../utils/datepickerStyles';

import './formating.css';

// Initialize datepicker styles
injectDatepickerStyles();

/** “Format cells if” dropdown: order and groups per product spec (legacy types remain in engine). */
const FORMAT_CELLS_IF_RULE_GROUPS: { labelKey: string; rules: string[] }[] = [
  {
    labelKey: 'formatCellsIfRulesGroup_presenceText',
    rules: [
      'empty',
      'notEmpty',
      'textContains',
      'textDoesNotContain',
      'textStartsWith',
      'textEndsWith',
      'textExactly',
    ],
  },
  {
    labelKey: 'formatCellsIfRulesGroup_dates',
    rules: ['dateIs', 'dateBefore', 'dateAfter'],
  },
  {
    labelKey: 'formatCellsIfRulesGroup_numbers',
    rules: [
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
      'equal',
      'notEqual',
      'between',
      'notBetween',
    ],
  },
];

const SINGLE_VALUE_CF_TYPES = new Set([
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'equal',
  'notEqual',
  'textContains',
  'textDoesNotContain',
  'textStartsWith',
  'textEndsWith',
  'textExactly',
]);

const NO_VALUE_CF_TYPES = new Set(['empty', 'notEmpty']);

const DATE_CF_TYPES = new Set([
  'dateIs',
  'dateBefore',
  'dateAfter',
  'occurrenceDate',
]);

/** Date rules that use preset dropdown + optional DD/MM/YYYY text (not the HTML date picker). */
const CF_PRESET_DATE_TYPES = new Set(['dateIs', 'dateBefore']);

const BETWEEN_CF_TYPES = new Set(['between', 'notBetween']);

/** Defaults for CF dialog formatting (reset in toolbar-style color picker). */
const CF_DIALOG_DEFAULT_TEXT_COLOR = '#177E23';
const CF_DIALOG_DEFAULT_CELL_COLOR = '#DDFBDF';

function formatStateFromSavedCfRule(rule: any) {
  const f = rule?.format ?? {};
  return {
    textColor: (f.textColor as string) || CF_DIALOG_DEFAULT_TEXT_COLOR,
    cellColor: (f.cellColor as string) || CF_DIALOG_DEFAULT_CELL_COLOR,
    bold: !!f.bold,
    italic: !!f.italic,
    underline: !!f.underline,
    strikethrough: !!f.strikethrough,
  };
}

function cfSavedDateRuleSuffix(
  conditionName: string,
  conditionValue: any[] | undefined,
  labels: Record<string, unknown>,
): string {
  if (
    (conditionName === 'dateIs' ||
      conditionName === 'dateBefore' ||
      conditionName === 'dateAfter') &&
    conditionValue?.length
  ) {
    const v0 = String(conditionValue[0]);
    if (v0.startsWith('preset:')) {
      const id = v0.slice(7);
      const label =
        (labels[`cfDatePreset_${id}`] as string | undefined) ?? id;
      if (id === 'exact') {
        const ex = String(conditionValue[1] || '').trim();
        return ex ? `${label} ${ex}` : label;
      }
      return label;
    }
  }
  return String(conditionValue?.[0] ?? '');
}

/** Presets shown for “Date is after” (subset of full date CF presets). */
const CF_DATE_AFTER_SELECT = new Set([
  'today',
  'tomorrow',
  'yesterday',
  'exact',
]);

function collectCfRuleApplyRanges(
  rule: any,
  ctx: Context,
): { row: number[]; column: number[] }[] {
  const cr = rule?.cellrange;
  if (typeof cr === 'string' && String(cr).trim()) {
    const parsed = getRangeByTxt(ctx, String(cr).trim());
    return parsed
      .filter(
        (x: any) =>
          Array.isArray(x?.row) &&
          x.row.length === 2 &&
          Array.isArray(x?.column) &&
          x.column.length === 2,
      )
      .map((x: any) => ({ row: [...x.row], column: [...x.column] }));
  }
  if (Array.isArray(cr) && cr.length > 0) {
    return cr
      .filter(
        (x: any) => x?.row?.length === 2 && x?.column?.length === 2,
      )
      .map((x: any) => ({ row: [...x.row], column: [...x.column] }));
  }
  return [];
}

const ConditionRules: React.FC<{ context?: any }> = ({ context }) => {
  const [type, setType] = useState<string>('notEmpty');
  const [create, setCreate] = useState<boolean>(false);
  const buttonClickCreateRef = useRef<boolean>(false);
  const skipNextSelectionSyncRef = useRef<boolean>(false);
  const [editConditionFormatKey, setEditConditionFormatKey] = useState<
    string | null
  >(null);
  const editKeyRef = useRef<string | null>(null);
  const firstRenderRef = useRef<boolean>(true);
  const rangeDialogWasOpenRef = useRef(false);
  const [editConditionRange, setEditConditionRange] = useState<string | null>(
    null,
  );
  const [editConditionFormatValue, setEditConditionFormatValue] =
    useState<any>(null);
  const [matchedConditionFormatKey, setMatchedConditionFormatKey] = useState<
    string[]
  >([]);
  const [allConditionFormats, setAllConditionFormats] = useState<any>(null);
  const [dragHandleKey, setDragHandleKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const { setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { conditionformat, button, protection, generalDialog, toolbar } =
    locale(context);
  const [colorRules, setColorRules] = useState<{
    textColor: string;
    cellColor: string;
  }>({
    textColor: CF_DIALOG_DEFAULT_TEXT_COLOR,
    cellColor: CF_DIALOG_DEFAULT_CELL_COLOR,
  });
  const [bold, setBold] = useState<boolean>(false);
  const [italic, setItalic] = useState<boolean>(false);
  const [underline, setUnderline] = useState<boolean>(false);
  const [strikethrough, setStrikethrough] = useState<boolean>(false);
  const selectionRangeTxt = useMemo(() => getDisplayedRangeTxt(context), [context]);

  useEffect(() => {
    if (create) return;
    const index = getSheetIndex(context, context?.currentSheetId!) || 0;
    const allCondition =
      context.luckysheetfile[index].luckysheet_conditionformat_save;
    setAllConditionFormats(allCondition);
    const selectionColumn = context.luckysheet_select_save?.[0].column;
    const selectionRow = context.luckysheet_select_save?.[0].row;
    const matchedCondition: string[] = [];

    if (allCondition) {
      Object.keys(allCondition).forEach((key) => {
        const conditionFormat = allCondition[key];
        const ranges = conditionFormat.cellrange || [];

        if (!ranges.length || !selectionColumn || !selectionRow) return;

        const hasOverlap = ranges.some((range: any) => {
          const rangeColumns = range.column;
          const rangeRows = range.row;

          const isColumnOverlap = !(
            selectionColumn[1] < rangeColumns[0] ||
            selectionColumn[0] > rangeColumns[1]
          );

          const isRowOverlap = !(
            selectionRow[1] < rangeRows[0] || selectionRow[0] > rangeRows[1]
          );

          return isColumnOverlap && isRowOverlap;
        });

        if (hasOverlap) {
          matchedCondition.push(key);
        }
      });

      setMatchedConditionFormatKey(matchedCondition);
    }

    if (buttonClickCreateRef.current) return;

    if (matchedCondition.length >= 0) {
      setCreate(false);
    }

    if (firstRenderRef.current && matchedCondition.length <= 0) {
      setCreate(true);
      firstRenderRef.current = false;
    }
  }, [context]);

  useEffect(() => {
    if (editConditionRange !== null) return;
    if (context.rangeDialog?.show) return;
    setEditConditionRange(selectionRangeTxt || '');
  }, [context.rangeDialog?.show, editConditionRange, selectionRangeTxt]);

  /** When range picker closes, apply combined range to Apply-to-range (not rulesValue). */
  useEffect(() => {
    const show = !!context.rangeDialog?.show;
    if (show) {
      rangeDialogWasOpenRef.current = true;
      return;
    }
    if (!rangeDialogWasOpenRef.current) return;
    rangeDialogWasOpenRef.current = false;

    const rdType = context.rangeDialog?.type ?? '';
    const rangeT = (context.rangeDialog?.rangeTxt ?? '').trim();

    if (rdType === 'conditionRulesbetween1' || rdType === 'conditionRulesbetween2') {
      setContext((ctx) => {
        if (!ctx.rangeDialog) return;
        const rt = ctx.rangeDialog.rangeTxt;
        if (rdType === 'conditionRulesbetween1') {
          ctx.conditionRules.betweenValue.value1 = rt;
        } else {
          ctx.conditionRules.betweenValue.value2 = rt;
        }
        ctx.rangeDialog.type = '';
        ctx.rangeDialog.rangeTxt = '';
      });
      return;
    }

    if (
      rdType.startsWith('conditionRules') &&
      rdType !== 'conditionRulesbetween1' &&
      rdType !== 'conditionRulesbetween2'
    ) {
      if (rangeT) {
        setEditConditionRange(rangeT);
      }
      setContext((ctx) => {
        if (ctx.rangeDialog) {
          ctx.rangeDialog.type = '';
          ctx.rangeDialog.rangeTxt = '';
        }
      });
    }
  }, [
    context.rangeDialog?.show,
    context.rangeDialog?.type,
    context.rangeDialog?.rangeTxt,
    setContext,
  ]);

  const updateCacheRules = () => {
    setContext((ctx) => {
      const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
      ctx.luckysheetfile[index].conditionRules = {
        // Ensure all required properties are present
        editKey: editConditionFormatKey,
        rulesType: type || '',
        rulesValue: ctx.conditionRules.rulesValue || '',
        textColor: { check: true, color: colorRules.textColor },
        cellColor: { check: true, color: colorRules.cellColor },
        font: {
          bold,
          italic,
          underline,
          strikethrough,
        },
        betweenValue: ctx.conditionRules.betweenValue || {
          value1: '',
          value2: '',
        },
        datePreset: ctx.conditionRules.datePreset || 'today',
        dateFormat: ctx.conditionRules.dateFormat || CF_DATE_DEFAULT_FORMAT,
        dateValue: ctx.conditionRules.dateValue || '',
        repeatValue: ctx.conditionRules.repeatValue || '0',
        projectValue: ctx.conditionRules.projectValue || '10',
      };
    });
  };

  // 开启鼠标选区
  const dataSelectRange = useCallback(
    (selectType: string) => {
      hideDialog();
      setContext((ctx) => {
        ctx.conditionRules.textColor.color = colorRules.textColor;
        ctx.conditionRules.cellColor.color = colorRules.cellColor;

        ctx.rangeDialog!.show = true;
        ctx.rangeDialog!.type = selectType;
        ctx.rangeDialog!.rangeTxt =
          editConditionRange ?? getDisplayedRangeTxt(ctx);
        ctx.rangeDialog!.singleSelect = false;
      });
      updateCacheRules();
    },
    [
      colorRules.cellColor,
      colorRules.textColor,
      editConditionRange,
      hideDialog,
      setContext,
    ],
  );

  const onConditionRangeInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setEditConditionRange(value);
      setContext((ctx) => {
        const parsedRange = getRangeByTxt(ctx, value);
        if (parsedRange.length > 0) {
          ctx.luckysheet_select_save = parsedRange;
        }
      });
    },
    [setContext],
  );

  useEffect(() => {
    updateCacheRules();
  }, [
    type,
    bold,
    italic,
    underline,
    strikethrough,
    colorRules,
    editConditionFormatKey,
  ]);

  useEffect(() => {
    setContext((draft) => {
      draft.conditionFormatDraftActive = create;
    });
  }, [create, setContext]);

  useEffect(
    () => () => {
      setContext((draft) => {
        draft.conditionFormatDraftActive = false;
      });
    },
    [setContext],
  );

  /** Keep grid selection in sync with Apply-to range so CF live preview can resolve cellrange. */
  useEffect(() => {
    if (!create) return;
    if (skipNextSelectionSyncRef.current) {
      skipNextSelectionSyncRef.current = false;
      return;
    }
    const t = (editConditionRange ?? '').trim();
    if (!t) return;
    setContext((ctx) => {
      const parsed = getRangeByTxt(ctx, t);
      if (parsed.length > 0) {
        ctx.luckysheet_select_save = parsed;
      }
    });
  }, [create, editConditionRange, setContext]);

  const close = useCallback(
    (closeType: string) => {
      const applyConditionRulesByRange = (ctx: any, shouldEdit = false) => {
        const typedRanges = (editConditionRange ?? '').trim();
        const parsedRanges = typedRanges ? getRangeByTxt(ctx, typedRanges) : [];
        const previousSelection = ctx.luckysheet_select_save;
        if (parsedRanges.length > 0) {
          ctx.luckysheet_select_save = parsedRanges;
        }

        setConditionRules(
          ctx,
          protection,
          generalDialog,
          conditionformat,
          ctx.conditionRules,
          shouldEdit,
          shouldEdit ? (editConditionFormatKey as string) : undefined,
        );

        ctx.luckysheet_select_save = previousSelection;
      };

      if (closeType === 'confirm') {
        buttonClickCreateRef.current = false;
        setCreate(false);
        setContext((ctx) => {
          ctx.conditionRules.textColor.color = colorRules.textColor;
          ctx.conditionRules.cellColor.color = colorRules.cellColor;
          ctx.conditionRules.font = {
            bold,
            italic,
            underline,
            strikethrough,
          };
          applyConditionRulesByRange(ctx, false);
        });
      } else if (closeType === 'close') {
        buttonClickCreateRef.current = true;
        setCreate(false);
      } else if (closeType === 'edit') {
        buttonClickCreateRef.current = false;
        setCreate(false);
        setContext((ctx) => {
          ctx.conditionRules.rulesType = type;
          ctx.conditionRules.textColor.color = colorRules.textColor;
          ctx.conditionRules.cellColor.color = colorRules.cellColor;
          ctx.conditionRules.font = {
            bold,
            italic,
            underline,
            strikethrough,
          };
          applyConditionRulesByRange(ctx, true);
        });
      }
      setContext((ctx) => {
        ctx.conditionFormatDraftActive = false;
        ctx.conditionRules = {
          rulesType: 'greaterThan',
          rulesValue: '',
          textColor: { check: true, color: '#000000' },
          cellColor: { check: true, color: '#000000' },
          font: {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
          },
          betweenValue: { value1: '', value2: '' },
          datePreset: 'today',
          dateFormat: CF_DATE_DEFAULT_FORMAT,
          dateValue: '',
          repeatValue: '0',
          projectValue: '10',
        };
      });
      setBold(false);
      setItalic(false);
      setUnderline(false);
      setStrikethrough(false);
      setColorRules({
        textColor: CF_DIALOG_DEFAULT_TEXT_COLOR,
        cellColor: CF_DIALOG_DEFAULT_CELL_COLOR,
      });
      updateCacheRules();
      setEditConditionFormatKey(null);
      setContext((ctx) => {
        const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
        if (ctx.luckysheetfile[index]?.conditionRules?.editKey !== undefined) {
          ctx.luckysheetfile[index]!.conditionRules!.editKey = null;
        }
      });
      hideDialog();
    },
    [
      colorRules,
      conditionformat,
      generalDialog,
      hideDialog,
      protection,
      setContext,
      bold,
      italic,
      underline,
      strikethrough,
      type,
      editConditionFormatKey,
      editConditionFormatValue,
      editConditionRange,
    ],
  );

  // rulesValue初始化 (range picker results are handled when dialog closes — see rangeDialogWasOpenRef effect)
  useEffect(() => {
    setContext((ctx) => {
      ctx.conditionRules.rulesType = type;

      if (!ctx.rangeDialog) return;
      const rangeDialogType = ctx.rangeDialog.type;
      if (rangeDialogType === '') {
        ctx.conditionRules = {
          rulesType: type,
          rulesValue: context.conditionRules.rulesValue || '',
          textColor: { check: true, color: '#000000' },
          cellColor: { check: true, color: '#000000' },
          font: {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
          },
          betweenValue: { value1: '', value2: '' },
          datePreset: 'today',
          dateFormat: CF_DATE_DEFAULT_FORMAT,
          dateValue: '',
          repeatValue: '0',
          projectValue: '10',
        };
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  /*
  const cellHighlightConditionList = [
    { text: 'greaterThan', value: '>', label: 'Greater Than' },
    { text: 'greaterThanOrEqual', value: '>=', label: 'Greater Than or Equal' },
    { text: 'lessThan', value: '<', label: 'Less Than' },
    { text: 'lessThanOrEqual', value: '<=', label: 'Less Than or Equal' },
    { text: 'between', value: '[]', label: 'Between' },
    { text: 'equal', value: '=', label: 'Equal' },
    { text: 'textContains', value: '()', label: 'Text Contains' },
    { text: 'empty', value: '', label: 'Empty' },
    {
      text: 'occurrenceDate',
      value: conditionformat.yesterday,
      label: 'Occurrence Date',
    },
    { text: 'duplicateValue', value: '##', label: 'Duplicate Value' },
  ];

  const itemSelectionConditionList = [
    { text: 'top10', value: conditionformat.top10 },
    {
      text: 'top10_percent',
      value: conditionformat.top10_percent,
      label: 'Top 10 Percent',
    },
    { text: 'last10', value: conditionformat.last10, label: 'Last 10' },
    {
      text: 'last10_percent',
      value: conditionformat.last10_percent,
      label: 'Last 10 Percent',
    },
    {
      text: 'aboveAverage',
      value: conditionformat.above,
      label: 'Above Average',
    },
    {
      text: 'belowAverage',
      value: conditionformat.below,
      label: 'Below Average',
    },
  ];
  */

  const formatCellsIfTypeLabel = (rulesType: string) => {
    if (rulesType === 'occurrenceDate') {
      return (conditionformat as any).dateIs ?? rulesType;
    }
    return (conditionformat as any)[rulesType] ?? rulesType;
  };

  const showApplyToRangeError = useMemo(() => {
    const t = (editConditionRange ?? '').trim();
    if (t === '') return false;
    return !isValidRangeText(context, t);
  }, [editConditionRange, context]);

  const isSubmitValueMissing = (): boolean => {
    const rangeT = (editConditionRange ?? '').trim();
    if (rangeT === '' || !isValidRangeText(context, rangeT)) {
      return true;
    }
    if (NO_VALUE_CF_TYPES.has(type)) return false;
    if (BETWEEN_CF_TYPES.has(type)) {
      return (
        !String(context.conditionRules.betweenValue.value1 ?? '').trim() ||
        !String(context.conditionRules.betweenValue.value2 ?? '').trim()
      );
    }
    if (DATE_CF_TYPES.has(type)) {
      if (CF_PRESET_DATE_TYPES.has(type) || type === 'dateAfter') {
        if (context.conditionRules.datePreset === 'exact') {
          return (
            parseDdMmYyyyToSerial(
              String(context.conditionRules.dateValue ?? '').trim(),
            ) == null
          );
        }
        return !String(context.conditionRules.datePreset ?? '').trim();
      }
      return !String(context.conditionRules.dateValue ?? '').trim();
    }
    const effectiveSingleValue = Array.isArray(editConditionFormatValue)
      ? String(editConditionFormatValue[0] ?? '')
      : String(
          editConditionFormatValue ?? context.conditionRules.rulesValue ?? '',
        );
    return !effectiveSingleValue.trim();
  };

  const allFormatCellsIfRuleTypes = FORMAT_CELLS_IF_RULE_GROUPS.flatMap(
    (g) => g.rules,
  );

  const remapRuleIndex = useCallback(
    (indexRaw: string | null, from: number, to: number): string | null => {
      if (indexRaw == null) return indexRaw;
      const index = Number(indexRaw);
      if (!Number.isFinite(index)) return indexRaw;
      if (index === from) return String(to);
      if (from < to && index > from && index <= to) return String(index - 1);
      if (from > to && index >= to && index < from) return String(index + 1);
      return indexRaw;
    },
    [],
  );

  const reorderConditionRule = useCallback(
    (fromKey: string, toKey: string) => {
      if (fromKey === toKey) return;
      const from = Number(fromKey);
      const to = Number(toKey);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return;

      setContext((ctx) => {
        const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
        const ruleArr =
          ctx.luckysheetfile[index].luckysheet_conditionformat_save || [];
        if (
          from < 0 ||
          to < 0 ||
          from >= ruleArr.length ||
          to >= ruleArr.length
        ) {
          return;
        }
        const moved = ruleArr.splice(from, 1)[0];
        ruleArr.splice(to, 0, moved);
        ctx.luckysheetfile[index].luckysheet_conditionformat_save = ruleArr;

        if (ctx.luckysheetfile[index].conditionRules?.editKey !== undefined) {
          const currentEditKey =
            ctx.luckysheetfile[index].conditionRules?.editKey ?? null;
          ctx.luckysheetfile[index].conditionRules!.editKey = remapRuleIndex(
            currentEditKey,
            from,
            to,
          );
        }
      });

      setEditConditionFormatKey((prev) => remapRuleIndex(prev, from, to));
      setMatchedConditionFormatKey((prev) => {
        if (!prev.includes(fromKey) || !prev.includes(toKey)) return prev;
        const fromIndex = prev.indexOf(fromKey);
        const toIndex = prev.indexOf(toKey);
        if (fromIndex < 0 || toIndex < 0) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [remapRuleIndex, setContext],
  );

  const clearCfRuleHoverRanges = useCallback(() => {
    setContext((draftCtx) => {
      draftCtx.conditionalFormatRuleHoverRanges = null;
    });
  }, [setContext]);

  const showCfRuleHoverRangesForRule = useCallback(
    (rule: any) => {
      setContext((draftCtx) => {
        const ranges = collectCfRuleApplyRanges(rule, draftCtx);
        draftCtx.conditionalFormatRuleHoverRanges =
          ranges.length > 0 ? ranges : null;
      });
    },
    [setContext],
  );

  useEffect(() => {
    clearCfRuleHoverRanges();
  }, [context?.currentSheetId, clearCfRuleHoverRanges]);

  useEffect(
    () => () => {
      clearCfRuleHoverRanges();
    },
    [clearCfRuleHoverRanges],
  );

  useEffect(() => {
    if (!create) return;
    setContext((draftCtx) => {
      draftCtx.conditionalFormatRuleHoverRanges = null;
    });
  }, [create, setContext]);

  const handleAddAnotherRule = useCallback(() => {
    setType('notEmpty');
    skipNextSelectionSyncRef.current = true;
    setEditConditionRange(selectionRangeTxt || '');
    setCreate(true);
    setEditConditionFormatKey(null);
    setContext((ctx) => {
      const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
      if (
        ctx.luckysheetfile[index]?.conditionRules?.editKey !== undefined
      ) {
        ctx.luckysheetfile[index]!.conditionRules!.editKey = null;
      }
    });
    editKeyRef.current = null;
    buttonClickCreateRef.current = true;
  }, [selectionRangeTxt, setContext]);

  // const titleType =
  //   // eslint-disable-next-line no-nested-ternary
  //   type === "top10_percent"
  //     ? "top10"
  //     : type === "last10_percent"
  //     ? "last10"
  //     : type;

  return (
    <div className="condition-rules">
      {!create ? (
        <div>
          <div
            style={{ marginBottom: '16px' }}
            onMouseLeave={clearCfRuleHoverRanges}
          >
            {matchedConditionFormatKey.map((key) => {
              return (
                <div
                  onMouseEnter={() => {
                    const rule = allConditionFormats?.[key];
                    if (rule) showCfRuleHoverRangesForRule(rule);
                  }}
                  onClick={() => {
                    setEditConditionFormatKey(key);
                    const fmtRule = allConditionFormats[key];
                    setContext((ctx) => {
                      const index = getSheetIndex(
                        ctx,
                        ctx.currentSheetId,
                      ) as number;

                      if (
                        ctx.luckysheetfile[index]?.conditionRules?.editKey ===
                        undefined
                      ) {
                        ctx.luckysheetfile[index]!.conditionRules!.editKey =
                          key;
                      }
                      const cn = fmtRule.conditionName;
                      const sheetRules =
                        ctx.luckysheetfile[index]?.conditionRules;
                      if (
                        cn === 'dateIs' ||
                        cn === 'dateBefore' ||
                        cn === 'dateAfter'
                      ) {
                        const p = parseCfDateConditionForUi(
                          fmtRule.conditionValue,
                        );
                        ctx.conditionRules.datePreset = p.preset;
                        ctx.conditionRules.dateValue = p.snapshotOrExact;
                        ctx.conditionRules.dateFormat = p.format;
                        if (sheetRules) {
                          sheetRules.datePreset = p.preset;
                          sheetRules.dateValue = p.snapshotOrExact;
                          sheetRules.dateFormat = p.format;
                        }
                      } else if (cn === 'occurrenceDate') {
                        const dv = fmtRule.conditionValue?.[0]
                          ? String(fmtRule.conditionValue[0])
                          : '';
                        ctx.conditionRules.dateValue = dv;
                        if (sheetRules) sheetRules.dateValue = dv;
                      }

                      const fs = formatStateFromSavedCfRule(fmtRule);
                      ctx.conditionRules.textColor = {
                        check: true,
                        color: fs.textColor,
                      };
                      ctx.conditionRules.cellColor = {
                        check: true,
                        color: fs.cellColor,
                      };
                      ctx.conditionRules.font = {
                        bold: fs.bold,
                        italic: fs.italic,
                        underline: fs.underline,
                        strikethrough: fs.strikethrough,
                      };
                      if (sheetRules) {
                        sheetRules.textColor = ctx.conditionRules.textColor;
                        sheetRules.cellColor = ctx.conditionRules.cellColor;
                        sheetRules.font = { ...ctx.conditionRules.font };
                      }
                    });
                    editKeyRef.current = key;
                    setType(allConditionFormats[key].conditionName);

                    const fs = formatStateFromSavedCfRule(fmtRule);
                    setColorRules({
                      textColor: fs.textColor,
                      cellColor: fs.cellColor,
                    });
                    setBold(fs.bold);
                    setItalic(fs.italic);
                    setUnderline(fs.underline);
                    setStrikethrough(fs.strikethrough);

                    const rangeEdit = allConditionFormats[key].cellrange
                      ?.map((range: any) => {
                        const startCol = numberToColumn(range.column[0] + 1);
                        const endCol = numberToColumn(range.column[1] + 1);
                        const startRow = range.row[0] + 1;
                        const endRow = range.row[1] + 1;
                        return `${startCol}${startRow}:${endCol}${endRow}`;
                      })
                      .join(', ');
                    setEditConditionRange(rangeEdit);
                    setEditConditionFormatValue(
                      allConditionFormats[key].conditionValue,
                    );
                  }}
                  className={`group flex items-center border-b border-gray-200 condition-list-parent fortune-condition-rules__item fortune-condition-rules__item--${String(
                    key,
                  )
                    .replace(/[^a-zA-Z0-9-]/g, '-')
                    .replace(/-+/g, '-')}`}
                  data-condition-key={key}
                  key={key}
                  data-testid={`condition-rules-item-${key}`}
                  draggable={dragHandleKey === key}
                  onDragStart={(e) => {
                    if (dragHandleKey !== key) {
                      e.preventDefault();
                      return;
                    }
                    setDraggingKey(key);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', key);
                  }}
                  onDragOver={(e) => {
                    if (!draggingKey || draggingKey === key) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromKey =
                      draggingKey || e.dataTransfer.getData('text/plain');
                    if (!fromKey || fromKey === key) return;
                    reorderConditionRule(fromKey, key);
                  }}
                  onDragEnd={() => {
                    setDraggingKey(null);
                    setDragHandleKey(null);
                  }}
                >
                  <div
                    className="fortune-condition-rules__icon fortune-condition-rules__action opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`condition-rules-action-drag-${key}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginRight: '-12px' }}
                  >
                    <LucideIcon
                      name="EllipsisVertical"
                      size="sm"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragHandleKey(key);
                      }}
                      style={{
                        cursor: 'grab',
                        color: 'hsl(var(--color-icon-secondary))',
                      }}
                    />
                  </div>
                  <div
                    className="condition-list-pill"
                    style={{
                      backgroundColor:
                        allConditionFormats[key].format.cellColor || '',
                    }}
                  >
                    <span
                      className="condition-list-text"
                      style={{
                        color: allConditionFormats[key].format.textColor || '',
                      }}
                    >
                      123
                    </span>
                  </div>
                  <div
                    className="flex flex-col"
                    style={{
                      width: '200px',
                      padding: '8px 0px',
                    }}
                    onClick={() => {
                      setCreate(true);
                      buttonClickCreateRef.current = true;
                    }}
                  >
                    <h3
                      className="fortune-condition-rules__heading condition-list-type"
                      data-testid={`condition-rules-heading-${key}`}
                    >
                      {
                        (conditionformat as any)[
                          allConditionFormats[key].conditionName
                        ]
                      }
                      {allConditionFormats[key].conditionName !== 'empty' &&
                        ` ${cfSavedDateRuleSuffix(
                          allConditionFormats[key].conditionName,
                          allConditionFormats[key].conditionValue,
                          conditionformat as Record<string, unknown>,
                        )}`}
                    </h3>
                    <p
                      className="fortune-condition-rules__para condition-list-range"
                      data-testid={`condition-rules-para-${key}`}
                    >
                      {allConditionFormats[key].cellrange
                        ?.map((range: any) => {
                          const startCol = numberToColumn(range.column[0] + 1);
                          const endCol = numberToColumn(range.column[1] + 1);
                          const startRow = range.row[0] + 1;
                          const endRow = range.row[1] + 1;
                          return `${startCol}${startRow}:${endCol}${endRow}`;
                        })
                        .join(', ')}
                    </p>
                  </div>
                  <div
                    className="fortune-condition-rules__icon fortune-condition-rules__action opacity-0 group-hover:opacity-100 transition-opacity"
                    data-condition-key={key}
                    data-testid={`condition-rules-action-delete-${key}`}
                  >
                    <IconButton
                      elevation={1}
                      icon="Trash2"
                      size="md"
                      variant="secondary"
                      className="fortune-condition-rules__icon--trash"
                      style={{
                        border: '0px',
                        boxShadow: 'none',
                        color: 'hsl(var(--color-icon-secondary))',
                      }}
                      onClick={() => {
                        setContext((ctx) => {
                          const index = getSheetIndex(
                            ctx,
                            ctx.currentSheetId,
                          ) as number;
                          const ruleArr =
                            ctx.luckysheetfile[index]
                              .luckysheet_conditionformat_save || [];
                          ruleArr.splice(Number(key), 1);
                          ctx.luckysheetfile[
                            index
                          ].luckysheet_conditionformat_save = ruleArr;
                          return ctx;
                        });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            toggleLeftIcon
            leftIcon="Plus"
            size="md"
            variant="secondary"
            className="fortune-condition-rules__cta fortune-condition-rules__cta--add"
            onClick={handleAddAnotherRule}
            data-testid="condition-rules-cta-add"
          >
            Add another rule
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col fortune-condition-rules__form">
            <div
              className="fortune-condition-rules__info condition-rules-value text-heading-xsm"
              data-testid="condition-rules-info-range"
            >
              {conditionformat.applyRange} range
            </div>
            <TextField
              className={cn(
                showApplyToRangeError &&
                  'ring-1 ring-[hsl(var(--color-border-negative))] rounded-md',
              )}
              rightIcon={
                <LucideIcon
                  name="Grid2x2"
                  size="sm"
                  onClick={() => {
                    dataSelectRange(`conditionRules${type}`);
                  }}
                  style={{ cursor: 'pointer' }}
                />
              }
              aria-hidden="true"
              placeholder={conditionformat.selectRange}
              value={editConditionRange ?? ''}
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
              onChange={onConditionRangeInputChange}
            />
            {showApplyToRangeError ? (
              <p
                className="text-body-xs text-[hsl(var(--color-text-negative))] mt-1"
                role="alert"
              >
                {(conditionformat as { invalidRangeText?: string })
                  .invalidRangeText ?? 'Enter a valid range'}
              </p>
            ) : null}
          </div>
          <div>
            <div
              className="fortune-condition-rules__heading-sm condition-rules-value text-heading-xsm"
              data-testid="condition-rules-heading-format"
            >
              Format cells if
            </div>
            <Select
              value={type}
              onValueChange={(value) => {
                if (
                  NO_VALUE_CF_TYPES.has(value) ||
                  NO_VALUE_CF_TYPES.has(type)
                ) {
                  setContext((ctx) => {
                    ctx.conditionRules.rulesValue = '';
                  });
                  setEditConditionFormatValue(null);
                }
                if (
                  value === 'dateIs' ||
                  value === 'dateBefore' ||
                  value === 'dateAfter'
                ) {
                  setContext((ctx) => {
                    ctx.conditionRules.datePreset = 'today';
                    ctx.conditionRules.dateFormat = CF_DATE_DEFAULT_FORMAT;
                    ctx.conditionRules.dateValue =
                      formatCfDatePresetSnapshot('today');
                  });
                }
                setType(value);
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <span>{formatCellsIfTypeLabel(type)}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                sideOffset={4}
                className="z-[100]"
                data-dropdown-content="true"
              >
                {FORMAT_CELLS_IF_RULE_GROUPS.map((group) => (
                  <SelectGroup key={group.labelKey}>
                    <SelectLabel>
                      {(conditionformat as any)[group.labelKey]}
                    </SelectLabel>
                    {group.rules.map((rule) => (
                      <SelectItem key={rule} value={rule}>
                        <div className="flex items-center gap-2">
                          <span>{formatCellsIfTypeLabel(rule)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                {editConditionFormatKey !== null &&
                  !allFormatCellsIfRuleTypes.includes(type) && (
                    <SelectGroup>
                      <SelectLabel>Saved rule type</SelectLabel>
                      <SelectItem value={type}>
                        <span>{formatCellsIfTypeLabel(type)}</span>
                      </SelectItem>
                    </SelectGroup>
                  )}
              </SelectContent>
            </Select>
          </div>

          {!['aboveAverage', 'belowAverage'].includes(type) && (
            <div className="flex flex-col">
              {/* <div className="condition-rules-value text-heading-xsm">
              {(conditionformat as any)[`conditionformat_${titleType}_title`]}
            </div> */}

              {SINGLE_VALUE_CF_TYPES.has(type) && (
                <div className="w-full">
                  <TextField
                    label="Value for condition"
                    required
                    placeholder="Value is required"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                    value={
                      editConditionFormatValue ||
                      context.conditionRules.rulesValue
                    }
                    onChange={(e) => {
                      setEditConditionFormatValue(null);
                      const { value } = e.target;
                      setContext((ctx) => {
                        ctx.conditionRules.rulesValue = value;
                      });
                      updateCacheRules();
                    }}
                  />
                </div>
              )}

              {BETWEEN_CF_TYPES.has(type) && (
                <div className="w-full flex gap-2 items-center">
                  <div className="w-full">
                    <TextField
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      placeholder="From"
                      value={context.conditionRules.betweenValue.value1}
                      onChange={(e) => {
                        const { value } = e.target;
                        setContext((ctx) => {
                          ctx.conditionRules.betweenValue.value1 = value;
                        });
                      }}
                    />
                  </div>
                  <div className="w-full">
                    <TextField
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      placeholder="To"
                      value={context.conditionRules.betweenValue.value2}
                      onChange={(e) => {
                        const { value } = e.target;
                        setContext((ctx) => {
                          ctx.conditionRules.betweenValue.value2 = value;
                        });
                      }}
                    />
                  </div>
                </div>
              )}
              {CF_PRESET_DATE_TYPES.has(type) && (
                <div className="flex flex-col gap-2 w-full">
                  <Select
                    value={context.conditionRules.datePreset || 'today'}
                    onValueChange={(preset) => {
                      setContext((ctx) => {
                        ctx.conditionRules.datePreset = preset;
                        ctx.conditionRules.dateFormat = CF_DATE_DEFAULT_FORMAT;
                        if (preset === 'exact') {
                          ctx.conditionRules.dateValue = '';
                        } else {
                          ctx.conditionRules.dateValue =
                            formatCfDatePresetSnapshot(preset);
                        }
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={conditionformat.occurrenceDate} />
                    </SelectTrigger>
                    <SelectContent className="condition-rules-select">
                      <SelectItem value="today">
                        {conditionformat.cfDatePreset_today}
                      </SelectItem>
                      <SelectItem value="tomorrow">
                        {conditionformat.cfDatePreset_tomorrow}
                      </SelectItem>
                      <SelectItem value="yesterday">
                        {conditionformat.cfDatePreset_yesterday}
                      </SelectItem>
                      <SelectItem value="pastWeek">
                        {conditionformat.cfDatePreset_pastWeek}
                      </SelectItem>
                      <SelectItem value="pastMonth">
                        {conditionformat.cfDatePreset_pastMonth}
                      </SelectItem>
                      <SelectItem value="pastYear">
                        {conditionformat.cfDatePreset_pastYear}
                      </SelectItem>
                      <SelectItem value="exact">
                        {conditionformat.cfDatePreset_exact}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {(context.conditionRules.datePreset || 'today') ===
                    'exact' && (
                    <TextField
                      label={conditionformat.occurrenceDate}
                      required
                      placeholder="Date DD/MM/YYYY"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      value={context.conditionRules.dateValue}
                      onChange={(e) => {
                        const { value: v } = e.target;
                        setContext((ctx) => {
                          ctx.conditionRules.dateValue = v;
                        });
                      }}
                    />
                  )}
                </div>
              )}
              {type === 'dateAfter' && (
                <div className="flex flex-col gap-2 w-full">
                  <Select
                    value={
                      CF_DATE_AFTER_SELECT.has(
                        context.conditionRules.datePreset || '',
                      )
                        ? context.conditionRules.datePreset || 'today'
                        : 'today'
                    }
                    onValueChange={(preset) => {
                      setContext((ctx) => {
                        ctx.conditionRules.datePreset = preset;
                        ctx.conditionRules.dateFormat = CF_DATE_DEFAULT_FORMAT;
                        if (preset === 'exact') {
                          ctx.conditionRules.dateValue = '';
                        } else {
                          ctx.conditionRules.dateValue =
                            formatCfDatePresetSnapshot(preset);
                        }
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={conditionformat.occurrenceDate} />
                    </SelectTrigger>
                    <SelectContent className="condition-rules-select">
                      <SelectItem value="today">
                        {conditionformat.cfDatePreset_today}
                      </SelectItem>
                      <SelectItem value="tomorrow">
                        {conditionformat.cfDatePreset_tomorrow}
                      </SelectItem>
                      <SelectItem value="yesterday">
                        {conditionformat.cfDatePreset_yesterday}
                      </SelectItem>
                      <SelectItem
                        value="exact"
                        className="border-t border-gray-200 mt-1"
                      >
                        {conditionformat.cfDatePreset_exact}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {(CF_DATE_AFTER_SELECT.has(
                    context.conditionRules.datePreset || '',
                  )
                    ? context.conditionRules.datePreset
                    : 'today') === 'exact' && (
                    <TextField
                      label={conditionformat.occurrenceDate}
                      required
                      placeholder="Date DD/MM/YYYY"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      value={context.conditionRules.dateValue}
                      onChange={(e) => {
                        const { value: v } = e.target;
                        setContext((ctx) => {
                          ctx.conditionRules.dateValue = v;
                        });
                      }}
                    />
                  )}
                </div>
              )}
              {DATE_CF_TYPES.has(type) &&
                !CF_PRESET_DATE_TYPES.has(type) &&
                type !== 'dateAfter' && (
                <div className="datepicker-toggle">
                  <input
                    type="date"
                    className="datepicker-input"
                    value={context.conditionRules.dateValue}
                    onChange={(e) => {
                      const { value: v } = e.target;
                      setContext((ctx) => {
                        ctx.conditionRules.dateValue = v;
                      });
                    }}
                  />
                  <span className="datepicker-toggle-button" />
                </div>
              )}
              {type === 'duplicateValue' && (
                <Select
                  value={context.conditionRules.repeatValue}
                  onValueChange={(value) => {
                    setContext((ctx) => {
                      ctx.conditionRules.repeatValue = value;
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="condition-rules-select">
                    <SelectItem value="0">
                      {conditionformat.duplicateValue}
                    </SelectItem>
                    <SelectItem value="1">
                      {conditionformat.uniqueValue}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

              {(type === 'top10' ||
                type === 'top10_percent' ||
                type === 'last10' ||
                type === 'last10_percent') && (
                <div className="condition-rules-project-box">
                  {type === 'top10' || type === 'top10_percent'
                    ? conditionformat.top
                    : conditionformat.last}

                  <div className="flex items-center">
                    <IconButton
                      icon="Minus"
                      variant="ghost"
                      className="!bg-transparent"
                      disabled={
                        Number(context.conditionRules.projectValue) <= 1
                      }
                      onClick={() => {
                        setContext((ctx) => {
                          const current =
                            Number(ctx.conditionRules.projectValue) || 0;
                          ctx.conditionRules.projectValue = String(
                            Math.max(current - 1, 1),
                          ); // Prevent going below 1 if needed
                        });
                      }}
                    />
                    <TextField
                      placeholder="Value"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="condition-rules-project-input pr-0"
                      type="number"
                      min={1}
                      max={type === 'top10' || type === 'last10' ? 10 : 100}
                      value={context.conditionRules.projectValue}
                      onChange={(e) => {
                        const { value } = e.target;
                        setContext((ctx) => {
                          ctx.conditionRules.projectValue = value;
                        });
                      }}
                      rightIcon={
                        type === 'top10' || type === 'last10' ? (
                          <span className="color-icon-secondary">
                            {conditionformat.oneself}
                          </span>
                        ) : (
                          <span className="color-icon-secondary">%</span>
                        )
                      }
                    />
                    <IconButton
                      icon="Plus"
                      variant="ghost"
                      className="!bg-transparent"
                      disabled={
                        Number(context.conditionRules.projectValue) >=
                        (type === 'top10' || type === 'last10' ? 10 : 100)
                      }
                      onClick={() => {
                        setContext((ctx) => {
                          const current =
                            Number(ctx.conditionRules.projectValue) || 0;
                          ctx.conditionRules.projectValue = String(current + 1);
                        });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col">
            <div className="condition-rules-set-title text-heading-xsm">
              {/* {`${conditionformat.setAs}：`} */}
              Formatting styles
            </div>

            <div className="toolbar-container">
              <div
                className="toolbar-header"
                style={{
                  backgroundColor: colorRules.cellColor,
                  color: colorRules.textColor,
                  textDecoration: underline ? 'underline' : '',
                  textDecorationLine: strikethrough ? 'line-through' : '',
                }}
              >
                <h2
                  className="toolbar-title"
                  style={{
                    fontWeight: bold ? 'bold' : '',
                    fontStyle: italic ? 'italic' : '',
                  }}
                >
                  Formatting styles preview
                </h2>
              </div>
              <div className="toolbar-content">
                <Button
                  variant="ghost"
                  onClick={() => setBold(!bold)}
                  className={cn(
                    'fortune-toolbar-combo-button !min-w-fit !px-0',
                    {},
                  )}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: bold
                      ? 'hsl(var(--color-bg-default-active))'
                      : '',
                  }}
                >
                  <LucideIcon
                    name="Bold"
                    style={{ width: '16px', height: '16px' }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setItalic(!italic)}
                  className={cn(
                    'fortune-toolbar-combo-button !min-w-fit !px-0',
                    {},
                  )}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: italic
                      ? 'hsl(var(--color-bg-default-active))'
                      : '',
                  }}
                >
                  <LucideIcon
                    name="Italic"
                    style={{ width: '16px', height: '16px' }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setUnderline(!underline)}
                  className={cn(
                    'fortune-toolbar-combo-button !min-w-fit !px-0',
                    {},
                  )}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: underline
                      ? 'hsl(var(--color-bg-default-active))'
                      : '',
                  }}
                >
                  <LucideIcon
                    name="Underline"
                    style={{ width: '16px', height: '16px' }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStrikethrough(!strikethrough)}
                  className={cn(
                    'fortune-toolbar-combo-button !min-w-fit !px-0',
                    {},
                  )}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: strikethrough
                      ? 'hsl(var(--color-bg-default-active))'
                      : '',
                  }}
                >
                  <LucideIcon
                    name="Strikethrough"
                    style={{ width: '16px', height: '16px' }}
                  />
                </Button>

                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: 24,
                      height: 4,
                      backgroundColor: colorRules.textColor,
                      position: 'absolute',
                      bottom: 2,
                      left: 3,
                      zIndex: 100,
                    }}
                  />
                  <Combo
                    iconId="font-color"
                    tooltip={toolbar?.['font-color'] ?? 'Font color'}
                    showArrow={false}
                    fillColor={colorRules.textColor}
                  >
                    {(setOpen) => (
                      <CustomColor
                        onCustomPick={(color) => {
                          setColorRules(
                            produce((draft) => {
                              draft.textColor =
                                color ?? CF_DIALOG_DEFAULT_TEXT_COLOR;
                            }),
                          );
                          setOpen(false);
                        }}
                        onColorPick={(color) => {
                          setColorRules(
                            produce((draft) => {
                              draft.textColor = color;
                            }),
                          );
                          setOpen(false);
                        }}
                      />
                    )}
                  </Combo>
                </div>

                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: 24,
                      height: 4,
                      backgroundColor: colorRules.cellColor,
                      position: 'absolute',
                      bottom: 2,
                      left: 3,
                      zIndex: 100,
                    }}
                  />
                  <Combo
                    iconId="background"
                    tooltip={toolbar?.background ?? 'Fill color'}
                    showArrow={false}
                  >
                    {(setOpen) => (
                      <CustomColor
                        onCustomPick={(color) => {
                          setColorRules(
                            produce((draft) => {
                              draft.cellColor =
                                color ?? CF_DIALOG_DEFAULT_CELL_COLOR;
                            }),
                          );
                          setOpen(false);
                        }}
                        onColorPick={(color) => {
                          setColorRules(
                            produce((draft) => {
                              draft.cellColor = color;
                            }),
                          );
                          setOpen(false);
                        }}
                      />
                    )}
                  </Combo>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end" style={{ marginTop: '8px' }}>
            <Button
              variant="secondary"
              style={{
                minWidth: '80px',
              }}
              onClick={() => {
                close('close');
              }}
              tabIndex={0}
            >
              {button.cancel}
            </Button>
            {editConditionFormatKey !== null ? (
              <Button
                disabled={isSubmitValueMissing()}
                variant="default"
                style={{
                  minWidth: '80px',
                }}
                onClick={() => {
                  close('edit');
                }}
                tabIndex={0}
              >
                Update rule
              </Button>
            ) : (
              <Button
                disabled={isSubmitValueMissing()}
                variant="default"
                style={{
                  minWidth: '80px',
                }}
                onClick={() => {
                  close('confirm');
                }}
                tabIndex={0}
              >
                Create rule
              </Button>
            )}
          </div>
          <hr className="color-border-default my-4 w-full border-0 border-t" />
          <Button
            toggleLeftIcon
            leftIcon="Plus"
            size="md"
            variant="secondary"
            className="fortune-condition-rules__cta fortune-condition-rules__cta--add"
            onClick={handleAddAnotherRule}
            data-testid="condition-rules-cta-add-from-form"
          >
            Add another rule
          </Button>
        </>
      )}
    </div>
  );
};

export default ConditionRules;
