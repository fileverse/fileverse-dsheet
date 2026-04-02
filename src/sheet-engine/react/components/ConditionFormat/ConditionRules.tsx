import React, {
  useRef,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import "./index.css";
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
} from "@fileverse/ui";
import {
  locale,
  setConditionRules,
  getSheetIndex,
} from "@sheet-engine/core";
import produce from "immer";
import { numberToColumn } from "../SheetOverlay/helper";

import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { getDisplayedRangeTxt } from "../DataVerification/getDisplayedRangeTxt";
import { injectDatepickerStyles } from "../../utils/datepickerStyles";

import "./formating.css";

// Initialize datepicker styles
injectDatepickerStyles();

const ConditionRules: React.FC<{ context?: any }> = ({ context }) => {
  const [type, setType] = useState<string>("greaterThan");
  const [create, setCreate] = useState<boolean>(false);
  const buttonClickCreateRef = useRef<boolean>(false);
  const textColorInputRef = useRef<HTMLInputElement | null>(null);
  const cellColorInputRef = useRef<HTMLInputElement | null>(null);
  const [editConditionFormatKey, setEditConditionFormatKey] = useState<
    string | null
  >(null);
  const editKeyRef = useRef<string | null>(null);
  const firstRenderRef = useRef<boolean>(true);
  const [editConditionRange, setEditConditionRange] = useState<string | null>(
    ""
  );
  const [editConditionFormatValue, setEditConditionFormatValue] =
    useState<any>(null);
  const [matchedConditionFormatKey, setMatchedConditionFormatKey] = useState<
    string[]
  >([]);
  const [allConditionFormats, setAllConditionFormats] = useState<any>(null);
  const { setContext } = useContext(WorkbookContext);
  const { hideDialog } = useDialog();
  const { conditionformat, button, protection, generalDialog } =
    locale(context);
  const [colorRules, setColorRules] = useState<{
    textColor: string;
    cellColor: string;
  }>({ textColor: "#177E23", cellColor: "#DDFBDF" });
  const [bold, setBold] = useState<boolean>(false);
  const [italic, setItalic] = useState<boolean>(false);
  const [underline, setUnderline] = useState<boolean>(false);
  const [strikethrough, setStrikethrough] = useState<boolean>(false);

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
        const range = conditionFormat.cellrange?.[0];

        if (!range || !selectionColumn || !selectionRow) return;

        const rangeColumns = range.column;
        const rangeRows = range.row;

        const isColumnOverlap = !(
          selectionColumn[1] < rangeColumns[0] ||
          selectionColumn[0] > rangeColumns[1]
        );

        const isRowOverlap = !(
          selectionRow[1] < rangeRows[0] || selectionRow[0] > rangeRows[1]
        );

        if (isColumnOverlap && isRowOverlap) {
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

  const updateCacheRules = () => {
    setContext((ctx) => {
      const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
      ctx.luckysheetfile[index].conditionRules = {
        // Ensure all required properties are present
        editKey: editConditionFormatKey,
        rulesType: type || "",
        rulesValue: ctx.conditionRules.rulesValue || "",
        textColor: { check: true, color: colorRules.textColor },
        cellColor: { check: true, color: colorRules.cellColor },
        font: {
          bold,
          italic,
          underline,
          strikethrough,
        },
        betweenValue: ctx.conditionRules.betweenValue || {
          value1: "",
          value2: "",
        },
        dateValue: ctx.conditionRules.dateValue || "",
        repeatValue: ctx.conditionRules.repeatValue || "0",
        projectValue: ctx.conditionRules.projectValue || "10",
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
        ctx.rangeDialog!.rangeTxt = ctx.conditionRules.rulesValue;
        ctx.rangeDialog!.singleSelect = false;
      });
      updateCacheRules();
    },
    [colorRules.cellColor, colorRules.textColor, hideDialog, setContext]
  );

  useEffect(() => {
    updateCacheRules();
  }, [type, bold, italic, underline, strikethrough, colorRules]);

  const close = useCallback(
    (closeType: string) => {
      if (closeType === "confirm") {
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
          setConditionRules(
            ctx,
            protection,
            generalDialog,
            conditionformat,
            ctx.conditionRules
          );
        });
      } else if (closeType === "close") {
        buttonClickCreateRef.current = true;
        setCreate(false);
      } else if (closeType === "edit") {
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
          setConditionRules(
            ctx,
            protection,
            generalDialog,
            conditionformat,
            ctx.conditionRules,
            true,
            // @ts-ignore
            editConditionFormatKey
          );
        });
      }
      setContext((ctx) => {
        ctx.conditionRules = {
          rulesType: "greaterThan",
          rulesValue: "",
          textColor: { check: true, color: "#000000" },
          cellColor: { check: true, color: "#000000" },
          font: {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
          },
          betweenValue: { value1: "", value2: "" },
          dateValue: "",
          repeatValue: "0",
          projectValue: "10",
        };
      });
      setBold(false);
      setItalic(false);
      setUnderline(false);
      setStrikethrough(false);
      setColorRules({ textColor: "#177E23", cellColor: "#DDFBDF" });
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
    ]
  );

  // rulesValue初始化
  useEffect(() => {
    setContext((ctx) => {
      ctx.conditionRules.rulesType = type;

      if (!ctx.rangeDialog) return;
      const rangeDialogType = ctx.rangeDialog.type;
      const rangeT = ctx.rangeDialog!.rangeTxt;
      if (rangeDialogType === "conditionRulesbetween1") {
        ctx.conditionRules.betweenValue.value1 = rangeT;
      } else if (rangeDialogType === "conditionRulesbetween2") {
        ctx.conditionRules.betweenValue.value2 = rangeT;
      } else if (rangeDialogType.indexOf("conditionRules") >= 0) {
        ctx.conditionRules.rulesValue = rangeT;
      } else if (rangeDialogType === "") {
        ctx.conditionRules = {
          rulesType: type,
          rulesValue: context.conditionRules.rulesValue || "",
          textColor: { check: true, color: "#000000" },
          cellColor: { check: true, color: "#000000" },
          font: {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
          },
          betweenValue: { value1: "", value2: "" },
          dateValue: "",
          repeatValue: "0",
          projectValue: "10",
        };
      }
      ctx.rangeDialog.type = "";
      ctx.rangeDialog.rangeTxt = "";
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const cellHighlightConditionList = [
    { text: "greaterThan", value: ">", label: "Greater Than" },
    { text: "greaterThanOrEqual", value: ">=", label: "Greater Than or Equal" },
    { text: "lessThan", value: "<", label: "Less Than" },
    { text: "lessThanOrEqual", value: "<=", label: "Less Than or Equal" },
    { text: "between", value: "[]", label: "Between" },
    { text: "equal", value: "=", label: "Equal" },
    { text: "textContains", value: "()", label: "Text Contains" },
    { text: "empty", value: "", label: "Empty" },
    {
      text: "occurrenceDate",
      value: conditionformat.yesterday,
      label: "Occurrence Date",
    },
    { text: "duplicateValue", value: "##", label: "Duplicate Value" },
  ];

  const itemSelectionConditionList = [
    { text: "top10", value: conditionformat.top10 },
    {
      text: "top10_percent",
      value: conditionformat.top10_percent,
      label: "Top 10 Percent",
    },
    { text: "last10", value: conditionformat.last10, label: "Last 10" },
    {
      text: "last10_percent",
      value: conditionformat.last10_percent,
      label: "Last 10 Percent",
    },
    {
      text: "aboveAverage",
      value: conditionformat.above,
      label: "Above Average",
    },
    {
      text: "belowAverage",
      value: conditionformat.below,
      label: "Below Average",
    },
  ];

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
          <div style={{ marginBottom: "16px" }}>
            {matchedConditionFormatKey.map((key) => {
              return (
                <div
                  onClick={() => {
                    setEditConditionFormatKey(key);
                    setContext((ctx) => {
                      const index = getSheetIndex(
                        ctx,
                        ctx.currentSheetId
                      ) as number;

                      if (
                        ctx.luckysheetfile[index]?.conditionRules?.editKey ===
                        undefined
                      ) {
                        ctx.luckysheetfile[index]!.conditionRules!.editKey =
                          key;
                      }
                    });
                    editKeyRef.current = key;
                    setType(allConditionFormats[key].conditionName);

                    const rangeEdit = allConditionFormats[key].cellrange
                      ?.map((range: any) => {
                        const startCol = numberToColumn(range.column[0] + 1);
                        const endCol = numberToColumn(range.column[1] + 1);
                        const startRow = range.row[0] + 1;
                        const endRow = range.row[1] + 1;
                        return `${startCol}${startRow}:${endCol}${endRow}`;
                      })
                      .join(", ");
                    setEditConditionRange(rangeEdit);
                    setEditConditionFormatValue(
                      allConditionFormats[key].conditionValue
                    );
                  }}
                  className={`group flex items-center border-b border-gray-200 condition-list-parent fortune-condition-rules__item fortune-condition-rules__item--${String(
                    key
                  )
                    .replace(/[^a-zA-Z0-9-]/g, "-")
                    .replace(/-+/g, "-")}`}
                  data-condition-key={key}
                  key={key}
                  data-testid={`condition-rules-item-${key}`}
                >
                  <div
                    className="condition-list-pill"
                    style={{
                      backgroundColor:
                        allConditionFormats[key].format.cellColor || "",
                    }}
                  >
                    <span
                      className="condition-list-text"
                      style={{
                        color: allConditionFormats[key].format.textColor || "",
                      }}
                    >
                      123
                    </span>
                  </div>
                  <div
                    className="flex flex-col"
                    style={{
                      width: "200px",
                      padding: "8px 0px",
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
                      {allConditionFormats[key].conditionName !== "empty" &&
                        ` ${
                          allConditionFormats[key].conditionValue?.[0] ?? ""
                        }`}
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
                        .join(", ")}
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
                        border: "0px",
                        boxShadow: "none",
                        color: "hsl(var(--color-icon-secondary))",
                      }}
                      onClick={() => {
                        setContext((ctx) => {
                          const index = getSheetIndex(
                            ctx,
                            ctx.currentSheetId
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
            onClick={() => {
              setType("greaterThan");
              setCreate(true);
              setEditConditionFormatKey(null);
              setContext((ctx) => {
                const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
                if (
                  ctx.luckysheetfile[index]?.conditionRules?.editKey !==
                  undefined
                ) {
                  ctx.luckysheetfile[index]!.conditionRules!.editKey = null;
                }
              });
              editKeyRef.current = null;
              buttonClickCreateRef.current = true;
            }}
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
              rightIcon={
                <LucideIcon
                  name="Grid2x2"
                  size="sm"
                  onClick={() => {
                    dataSelectRange(`conditionRules${type}`);
                  }}
                />
              }
              aria-hidden="true"
              readOnly
              placeholder={conditionformat.selectRange}
              value={editConditionRange || getDisplayedRangeTxt(context)}
              onClick={() => {
                setEditConditionRange(null);
                dataSelectRange(`conditionRules${type}`);
              }}
            />
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
                if (value === "empty" || type === "empty") {
                  setContext((ctx) => {
                    ctx.conditionRules.rulesValue = "";
                  });
                  setEditConditionFormatValue(null);
                }
                setType(value);
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {/* <LucideIcon name={selectedOption.icon} size="sm" /> */}
                    <span>{(conditionformat as any)[type]}</span>
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
                <SelectGroup>
                  <SelectLabel>Cell highlight rules</SelectLabel>
                  {cellHighlightConditionList.map((option) => (
                    <SelectItem key={option.value} value={option.text}>
                      <div className="flex items-center gap-2">
                        {/* <LucideIcon name={option.icon} size="sm" /> */}
                        <span>{(conditionformat as any)[option.text]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Item selections rules</SelectLabel>
                  {itemSelectionConditionList.map((option) => (
                    <SelectItem key={option.value} value={option.text}>
                      <div className="flex items-center gap-2">
                        {/* <LucideIcon name={option.icon} size="sm" /> */}
                        <span>{(conditionformat as any)[option.text]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {!["aboveAverage", "belowAverage"].includes(type) && (
            <div className="flex flex-col">
              {/* <div className="condition-rules-value text-heading-xsm">
              {(conditionformat as any)[`conditionformat_${titleType}_title`]}
            </div> */}

              {(type === "greaterThan" ||
                type === "greaterThanOrEqual" ||
                type === "lessThan" ||
                type === "lessThanOrEqual" ||
                type === "equal" ||
                type === "textContains") && (
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

              {type === "between" && (
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
              {type === "occurrenceDate" && (
                <div className="datepicker-toggle">
                  <input
                    type="date"
                    className="datepicker-input"
                    value={context.conditionRules.dateValue}
                    onChange={(e) => {
                      const { value } = e.target;
                      setContext((ctx) => {
                        ctx.conditionRules.dateValue = value;
                      });
                    }}
                  />
                  <span className="datepicker-toggle-button" />
                </div>
              )}
              {type === "duplicateValue" && (
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

              {(type === "top10" ||
                type === "top10_percent" ||
                type === "last10" ||
                type === "last10_percent") && (
                <div className="condition-rules-project-box">
                  {type === "top10" || type === "top10_percent"
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
                            Math.max(current - 1, 1)
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
                      max={type === "top10" || type === "last10" ? 10 : 100}
                      value={context.conditionRules.projectValue}
                      onChange={(e) => {
                        const { value } = e.target;
                        setContext((ctx) => {
                          ctx.conditionRules.projectValue = value;
                        });
                      }}
                      rightIcon={
                        type === "top10" || type === "last10" ? (
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
                        (type === "top10" || type === "last10" ? 10 : 100)
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
                  textDecoration: underline ? "underline" : "",
                  textDecorationLine: strikethrough ? "line-through" : "",
                }}
              >
                <h2
                  className="toolbar-title"
                  style={{
                    fontWeight: bold ? "bold" : "",
                    fontStyle: italic ? "italic" : "",
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
                    "fortune-toolbar-combo-button !min-w-fit !px-0",
                    {}
                  )}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: bold
                      ? "hsl(var(--color-bg-default-active))"
                      : "",
                  }}
                >
                  <LucideIcon
                    name="Bold"
                    style={{ width: "16px", height: "16px" }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setItalic(!italic)}
                  className={cn(
                    "fortune-toolbar-combo-button !min-w-fit !px-0",
                    {}
                  )}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: italic
                      ? "hsl(var(--color-bg-default-active))"
                      : "",
                  }}
                >
                  <LucideIcon
                    name="Italic"
                    style={{ width: "16px", height: "16px" }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setUnderline(!underline)}
                  className={cn(
                    "fortune-toolbar-combo-button !min-w-fit !px-0",
                    {}
                  )}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: underline
                      ? "hsl(var(--color-bg-default-active))"
                      : "",
                  }}
                >
                  <LucideIcon
                    name="Underline"
                    style={{ width: "16px", height: "16px" }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStrikethrough(!strikethrough)}
                  className={cn(
                    "fortune-toolbar-combo-button !min-w-fit !px-0",
                    {}
                  )}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: strikethrough
                      ? "hsl(var(--color-bg-default-active))"
                      : "",
                  }}
                >
                  <LucideIcon
                    name="Strikethrough"
                    style={{ width: "16px", height: "16px" }}
                  />
                </Button>

                <div>
                  <Button
                    onClick={() => {
                      textColorInputRef.current?.click();
                    }}
                    variant="ghost"
                    className={cn(
                      "fortune-toolbar-combo-button !min-w-fit !px-0",
                      {}
                    )}
                    style={{
                      width: 30,
                      height: 30,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <svg
                        style={{ width: "19px", height: "19px" }}
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-spell-check2-icon lucide-spell-check-2"
                      >
                        <path d="m5 18 6-12 6 12" />
                        <path d="M7 14h8" />
                      </svg>
                      <input
                        ref={textColorInputRef}
                        style={{
                          marginBottom: "4px",
                        }}
                        type="color"
                        className="condition-rules-select-color"
                        value={colorRules.textColor}
                        onChange={(e) => {
                          const { value } = e.target;
                          setColorRules(
                            produce((draft) => {
                              draft.textColor = value;
                            })
                          );
                        }}
                      />
                    </div>
                  </Button>
                </div>

                <div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      cellColorInputRef.current?.click();
                    }}
                    className={cn(
                      "fortune-toolbar-combo-button !min-w-fit !px-0",
                      {}
                    )}
                    style={{
                      width: 30,
                      height: 30,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <LucideIcon
                        name="PaintBucket"
                        style={{ width: "16px", height: "16px" }}
                      />
                      <input
                        ref={cellColorInputRef}
                        type="color"
                        className="condition-rules-select-color"
                        value={colorRules.cellColor}
                        onChange={(e) => {
                          const { value } = e.target;
                          setColorRules(
                            produce((draft) => {
                              draft.cellColor = value;
                            })
                          );
                        }}
                      />
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end" style={{ marginTop: "8px" }}>
            <Button
              variant="secondary"
              style={{
                minWidth: "80px",
              }}
              onClick={() => {
                close("close");
              }}
              tabIndex={0}
            >
              {button.cancel}
            </Button>
            {editConditionFormatKey !== null ? (
              <Button
                disabled={
                  context.conditionRules.rulesValue === "" && type !== "empty"
                }
                variant="default"
                style={{
                  minWidth: "80px",
                }}
                onClick={() => {
                  close("edit");
                }}
                tabIndex={0}
              >
                Update rule
              </Button>
            ) : (
              <Button
                disabled={
                  context.conditionRules.rulesValue === "" && type !== "empty"
                }
                variant="default"
                style={{
                  minWidth: "80px",
                }}
                onClick={() => {
                  close("confirm");
                }}
                tabIndex={0}
              >
                Create rule
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ConditionRules;
