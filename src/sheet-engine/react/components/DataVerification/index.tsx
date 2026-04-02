import {
  getDropdownList,
  getFlowdata,
  getRangeByTxt,
  getRangetxt,
  locale,
  setCellValue,
  confirmMessage,
} from "@sheet-engine/core";
import {
  Button,
  Checkbox,
  Divider,
  LucideIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextField,
} from "@fileverse/ui";
import React, { useCallback, useContext, useEffect, useState } from "react";
import DynamicInputList from "./DropdownOption";
import WorkbookContext from "../../context";
import { useDialog } from "../../hooks/useDialog";
import { injectDatepickerStyles } from "../../utils/datepickerStyles";
import { findMatchingCells, cellsToRangeString } from "./helpers";
import "./index.css";

type Item = { id: string; value: string; color?: string | null };

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// Initialize datepicker styles
injectDatepickerStyles();

const DataVerification: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showDialog, hideDialog } = useDialog();
  const { dataVerification, button, generalDialog } = locale(context);

  const [dateCondition] = useState<string[]>([
    "between",
    "notBetween",
    "equal",
    "notEqualTo",
    "earlierThan",
    "noEarlierThan",
    "laterThan",
    "noLaterThan",
  ]);

  const getSheetIndex = useCallback(() => {
    for (let i = 0; i < context.luckysheetfile.length; i += 1) {
      if (context.luckysheetfile[i]?.id === context.currentSheetId) {
        return i;
      }
    }
    return null;
  }, [context.luckysheetfile, context.currentSheetId]);

  const [optionItems, setOptionItems] = useState<Item[]>([]);

  const valuesFromArray = optionItems.map((i) => i.value).join(",");
  const colors = optionItems.map((i) => i.color).join(",");

  useEffect(() => {
    setContext((ctx) => {
      // @ts-ignore
      ctx.dataVerification!.dataRegulation!.color = colors;
      ctx.dataVerification!.dataRegulation!.value1 = valuesFromArray;
    });
  }, [optionItems]);

  useEffect(() => {
    const selectRow = context.luckysheet_select_save?.[0]?.row?.[0];
    const selectCol = context.luckysheet_select_save?.[0]?.column?.[0];
    const sheetIndex = getSheetIndex();
    const dataVerificationInfo =
      context.luckysheetfile[sheetIndex as number]?.dataVerification ?? {};
    if (!dataVerificationInfo) return;
    let value = dataVerificationInfo?.[`${selectRow}_${selectCol}`]?.value1;
    const color = dataVerificationInfo?.[`${selectRow}_${selectCol}`]?.color;

    if (value && color) {
      // const color = context.dataVerification!.dataRegulation!.color.split(",")
      const colorValues = color?.split(",").map((v: string) => v.trim());
      // Group every 3 values into RGB arrays
      const rgbArray: string[] = [];
      for (let i = 0; i < colorValues.length; i += 3) {
        rgbArray.push(colorValues.slice(i, i + 3).join(", "));
      }
      value = value?.split(",");
      setOptionItems(
        value.map((v: string, i: number) => ({
          id: createId(),
          value: v,
          color: rgbArray[i],
        }))
      );
    }
  }, []);

  // 开启鼠标选区
  const dataSelectRange = useCallback(
    (type: string, value: string) => {
      hideDialog();
      setContext((ctx) => {
        ctx.rangeDialog!.show = true;
        ctx.rangeDialog!.type = type;
        ctx.rangeDialog!.rangeTxt = value;
      });
    },
    [hideDialog, setContext]
  );

  // Helper function to apply validation to a specific range
  const applyValidation = useCallback(
    (rangeString: string) => {
      setContext((ctx) => {
        const range = getRangeByTxt(ctx, rangeString);
        if (range.length === 0) {
          return;
        }
        const regulation = ctx.dataVerification!.dataRegulation!;
        const verifacationT = regulation?.type;
        const { value1 } = regulation;
        const item = {
          ...regulation,
          checked: false,
        };
        if (verifacationT === "dropdown") {
          const list = getDropdownList(ctx, value1);
          item.value1 = list.join(",");
        }
        const currentDataVerification =
          ctx.luckysheetfile[getSheetIndex() as number].dataVerification ?? {};

        const d = getFlowdata(ctx);
        if (!d) return;

        // Loop through ALL range segments (handles non-contiguous ranges like "A1:A4,A6:A10")
        for (let ri = 0; ri < range.length; ri += 1) {
          const str = range[ri].row[0];
          const edr = range[ri].row[1];
          const stc = range[ri].column[0];
          const edc = range[ri].column[1];
          for (let r = str; r <= edr; r += 1) {
            for (let c = stc; c <= edc; c += 1) {
              const key = `${r}_${c}`;
              currentDataVerification[key] = item;
              if (regulation.type === "checkbox") {
                setCellValue(ctx, r, c, d, item.value2);
              }
            }
          }
        }

        ctx.luckysheetfile[getSheetIndex() as number].dataVerification =
          currentDataVerification;

        // Clear context properties
        ctx.dataVerification!.updateScope = undefined;
        ctx.dataVerification!.sourceCell = undefined;
      });
    },
    [getSheetIndex, setContext]
  );

  // 确定和取消按钮
  const btn = useCallback(
    (type: string) => {
      if (type === "confirm") {
        // First validate the form
        const isValid = confirmMessage(
          context,
          generalDialog,
          dataVerification
        );

        if (!isValid) return;

        // Read values directly from context
        const sourceCell = context.dataVerification?.sourceCell;
        const modalRangeString = context.dataVerification?.dataRegulation
          ?.rangeTxt as string;

        if (sourceCell) {
          const matchingCells = findMatchingCells(
            context,
            sourceCell.row,
            sourceCell.col
          );

          if (matchingCells.length > 1) {
            // Show dialog to ask user about scope
            const allMatchingRange = cellsToRangeString(context, matchingCells);

            showDialog(
              `There are ${matchingCells.length} cells with the same validation. Do you want to make changes to all of them?`,
              "yesno",
              "Apply Changes",
              "All other cells",
              "Just this instance",
              () => {
                // User chose "All other cells"
                applyValidation(allMatchingRange);
                hideDialog();
              },
              () => {
                // User chose "Just this instance"
                applyValidation(modalRangeString);
                hideDialog();
              }
            );
            return; // Don't hide dialog yet, wait for user choice
          }
        }

        // No matching cells or only 1 cell - apply directly
        applyValidation(modalRangeString);
      } else if (type === "delete") {
        setContext((ctx) => {
          const range = getRangeByTxt(
            ctx,
            ctx.dataVerification?.dataRegulation?.rangeTxt as string
          );
          if (range.length === 0) {
            showDialog(generalDialog.noSelectionError, "ok");
            return;
          }
          const currentDataVerification =
            ctx.luckysheetfile[getSheetIndex() as number].dataVerification ??
            {};
          const str = range[range.length - 1].row[0];
          const edr = range[range.length - 1].row[1];
          const stc = range[range.length - 1].column[0];
          const edc = range[range.length - 1].column[1];
          for (let r = str; r <= edr; r += 1) {
            for (let c = stc; c <= edc; c += 1) {
              delete currentDataVerification[`${r}_${c}`];
            }
          }

          // Clear updateScope after deleting
          ctx.dataVerification!.updateScope = undefined;
        });
      }
      hideDialog();
    },
    [
      applyValidation,
      context,
      dataVerification,
      generalDialog,
      getSheetIndex,
      hideDialog,
      setContext,
      showDialog,
    ]
  );

  // 初始化
  useEffect(() => {
    setContext((ctx) => {
      let rangeT = "";
      const updateScope = ctx.dataVerification?.updateScope || "current";

      // 如果有选区得把选区转为字符形式然后进行显示
      if (ctx.luckysheet_select_save) {
        const range =
          ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];
        const rowIndex = range.row_focus;
        const colIndex = range.column_focus;

        // If updateScope is "all", find all matching cells and convert to range string
        if (updateScope === "all" && rowIndex != null && colIndex != null) {
          const matchingCells = findMatchingCells(ctx, rowIndex, colIndex);
          rangeT = cellsToRangeString(ctx, matchingCells);
        } else {
          // Use normal range for current cell(s)
          rangeT = getRangetxt(
            context,
            context.currentSheetId,
            range,
            context.currentSheetId
          );
        }
      }

      // 初始化值
      const index = getSheetIndex() as number;
      const ctxDataVerification = ctx.luckysheetfile[index].dataVerification;
      if (ctxDataVerification) {
        if (!ctx.luckysheet_select_save) return;
        const last =
          ctx.luckysheet_select_save[ctx.luckysheet_select_save.length - 1];
        const rowIndex = last.row_focus;
        const colIndex = last.column_focus;
        if (rowIndex == null || colIndex == null) return;

        // Store the source cell that triggered the modal
        ctx.dataVerification!.sourceCell = { row: rowIndex, col: colIndex };

        const item = ctxDataVerification[`${rowIndex}_${colIndex}`];
        const defaultItem = item ?? {};
        let rangValue = defaultItem.value1 ?? "";
        // 选区赋值相关
        if (
          ctx.rangeDialog?.type === "dropDown" &&
          ctx.dataVerification &&
          ctx.dataVerification.dataRegulation &&
          ctx.dataVerification.dataRegulation.rangeTxt
        ) {
          // 当是下拉列表选区的时候，则下拉选区赋值，范围保持不变
          rangeT = ctx.dataVerification.dataRegulation.rangeTxt;
          rangValue = ctx.rangeDialog.rangeTxt;
        } else if (
          ctx.rangeDialog?.type === "rangeTxt" &&
          ctx.dataVerification &&
          ctx.dataVerification.dataRegulation &&
          ctx.dataVerification.dataRegulation.value1
        ) {
          // 当是选区范围的时候，则范围赋值，下拉选区不变
          rangValue = ctx.dataVerification.dataRegulation.value1;
          rangeT = ctx.rangeDialog.rangeTxt;
        }
        ctx.rangeDialog!.type = "";

        if (item) {
          ctx.dataVerification!.dataRegulation = {
            ...item,
            value1: rangValue,
            rangeTxt: rangeT,
          };
        } else {
          ctx.dataVerification!.dataRegulation! = {
            type: "dropdown",
            type2: "",
            rangeTxt: rangeT,
            value1: rangValue,
            value2: "",
            validity: "",
            remote: false,
            prohibitInput: false,
            hintShow: false,
            hintValue: "",
          };
        }
      } else {
        ctx.dataVerification!.dataRegulation! = {
          type: "dropdown",
          type2: "",
          rangeTxt: rangeT,
          value1: "",
          value2: "",
          validity: "",
          remote: false,
          prohibitInput: false,
          hintShow: false,
          hintValue: "",
        };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeOnClick = () => {
    document.getElementById("data-verification-button")?.click();
    hideDialog();
    dataSelectRange(
      "rangeTxt",
      context.dataVerification!.dataRegulation!.value1
    );
  };

  const rangeOnChange = (e: any) => {
    const { value } = e.target;
    setContext((ctx) => {
      ctx.dataVerification!.dataRegulation!.rangeTxt = value;
    });
  };

  return (
    <div id="fortune-data-verification">
      <div
        className="flex flex-col gap-4 h-[calc(100vh-270px)] overflow-y-auto no-scrollbar"
        style={{ width: "345px", padding: "16px" }}
      >
        <div className="flex flex-col">
          <div className="text-heading-xsm mb-2">
            {dataVerification.cellRange}
          </div>
          <TextField
            rightIcon={
              <LucideIcon
                name="Grid2x2"
                size="sm"
                onClick={rangeOnClick}
                onChange={rangeOnChange}
                style={{ cursor: "pointer", color: "#363B3F" }}
              />
            }
            aria-hidden="true"
            readOnly
            value={context.dataVerification!.dataRegulation?.rangeTxt}
            onChange={rangeOnChange}
            onClick={rangeOnClick}
          />
        </div>

        <div className="flex flex-col">
          <div className="text-heading-xsm mb-2">
            {dataVerification.verificationCondition}
          </div>
          <Select
            value={context.dataVerification!.dataRegulation!.type}
            onValueChange={(value) => {
              setContext((ctx) => {
                ctx.dataVerification!.dataRegulation!.type = value;
                if (value === "dropdown" || value === "checkbox") {
                  ctx.dataVerification!.dataRegulation!.type2 = "";
                } else if (
                  value === "number" ||
                  value === "number_integer" ||
                  value === "number_decimal" ||
                  value === "text_length" ||
                  value === "date"
                ) {
                  ctx.dataVerification!.dataRegulation!.type2 = "between";
                } else if (value === "text_content") {
                  ctx.dataVerification!.dataRegulation!.type2 = "include";
                } else if (value === "validity") {
                  ctx.dataVerification!.dataRegulation!.type2 =
                    "identificationNumber";
                }
                ctx.dataVerification!.dataRegulation!.value1 = "";
                ctx.dataVerification!.dataRegulation!.value2 = "";
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "dropdown",
                "checkbox",
                // "number",
                // "number_integer",
                // "number_decimal",
                // "text_content",
                // "text_length",
                "date",
                // "validity",
              ].map((v) => (
                <SelectItem value={v} key={v}>
                  {(dataVerification as any)[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {context.dataVerification?.dataRegulation?.type === "dropdown" && (
            <div className="mt-4">
              <DynamicInputList
                optionItems={optionItems}
                setOptionItems={setOptionItems}
              />

              <div className="mt-4 flex items-center">
                <Checkbox
                  className="border-2"
                  checked={
                    context.dataVerification!.dataRegulation!.type2 === "true"
                  }
                  onCheckedChange={(e) => {
                    const { checked } = e.target;
                    setContext((ctx) => {
                      ctx.dataVerification!.dataRegulation!.type2 = `${checked}`;
                    });
                  }}
                />
                <span className="ml-2 text-body-sm">
                  {dataVerification.allowMultiSelect}
                </span>
              </div>
            </div>
          )}

          {context.dataVerification?.dataRegulation?.type === "checkbox" && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="data-verification-checkbox-label">
                  {dataVerification.selected}
                </span>
                <TextField
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    (e.target as HTMLInputElement).focus();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                  value={context.dataVerification?.dataRegulation?.value1}
                  placeholder={dataVerification.placeholder2}
                  onChange={(e) => {
                    e.stopPropagation();
                    const { value } = e.target;
                    setContext((ctx) => {
                      ctx.dataVerification!.dataRegulation!.value1 = value;
                    });
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="data-verification-checkbox-label">
                  {dataVerification.notSelected}
                </span>
                <TextField
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    (e.target as HTMLInputElement).focus();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                  value={context.dataVerification?.dataRegulation?.value2}
                  placeholder={dataVerification.placeholder2}
                  onChange={(e) => {
                    const { value } = e.target;
                    setContext((ctx) => {
                      ctx.dataVerification!.dataRegulation!.value2 = value;
                    });
                  }}
                />
              </div>
            </div>
          )}

          {/* {(context.dataVerification?.dataRegulation?.type === "number" ||
            context.dataVerification?.dataRegulation?.type ===
              "number_integer" ||
            context.dataVerification?.dataRegulation?.type ===
              "number_decimal" ||
            context.dataVerification?.dataRegulation?.type ===
              "text_length") && (
            <div className="mt-4">
              <Select
                value={context.dataVerification.dataRegulation.type2}
                onValueChange={(value) => {
                  setContext((ctx) => {
                    ctx.dataVerification!.dataRegulation!.type2 = value;
                    ctx.dataVerification!.dataRegulation!.value1 = "";
                    ctx.dataVerification!.dataRegulation!.value2 = "";
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {numberCondition.map((v) => (
                    <SelectItem value={v} key={v}>
                      {(dataVerification as any)[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {context.dataVerification.dataRegulation.type2 === "between" ||
              context.dataVerification.dataRegulation.type2 === "notBetween" ? (
                <div className="mt-4 flex gap-2 items-center">
                  <TextField
                    type="number"
                    placeholder="1"
                    value={context.dataVerification.dataRegulation.value1}
                    onChange={(e) => {
                      const { value } = e.target;
                      setContext((ctx) => {
                        ctx.dataVerification!.dataRegulation!.value1 = value;
                      });
                    }}
                  />
                  <span>-</span>
                  <TextField
                    type="number"
                    placeholder="100"
                    value={context.dataVerification.dataRegulation.value2}
                    onChange={(e) => {
                      const { value } = e.target;
                      setContext((ctx) => {
                        ctx.dataVerification!.dataRegulation!.value2 = value;
                      });
                    }}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <TextField
                    type="number"
                    placeholder={dataVerification.placeholder3}
                    value={context.dataVerification.dataRegulation.value1}
                    onChange={(e) => {
                      const { value } = e.target;
                      setContext((ctx) => {
                        ctx.dataVerification!.dataRegulation!.value1 = value;
                      });
                    }}
                  />
                </div>
              )}
            </div>
          )} */}

          {/* {context.dataVerification?.dataRegulation?.type ===
            "text_content" && (
            <div className="mt-4">
              <Select
                value={context.dataVerification.dataRegulation.type2}
                onValueChange={(value) => {
                  setContext((ctx) => {
                    ctx.dataVerification!.dataRegulation!.type2 = value;
                    ctx.dataVerification!.dataRegulation!.value1 = "";
                    ctx.dataVerification!.dataRegulation!.value2 = "";
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["include", "exclude", "equal"].map((v) => (
                    <SelectItem value={v} key={v}>
                      {(dataVerification as any)[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-4">
                <TextField
                  placeholder={dataVerification.placeholder4}
                  value={context.dataVerification.dataRegulation.value1}
                  onChange={(e) => {
                    const { value } = e.target;
                    setContext((ctx) => {
                      ctx.dataVerification!.dataRegulation!.value1 = value;
                    });
                  }}
                />
              </div>
            </div>
          )} */}

          {context.dataVerification?.dataRegulation?.type === "date" && (
            <div className="mt-4">
              <Select
                value={context.dataVerification.dataRegulation.type2}
                onValueChange={(value) => {
                  setContext((ctx) => {
                    ctx.dataVerification!.dataRegulation!.type2 = value;
                    ctx.dataVerification!.dataRegulation!.value1 = "";
                    ctx.dataVerification!.dataRegulation!.value2 = "";
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateCondition.map((v) => (
                    <SelectItem value={v} key={v}>
                      {(dataVerification as any)[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {context.dataVerification.dataRegulation.type2 === "between" ||
              context.dataVerification.dataRegulation.type2 === "notBetween" ? (
                <div className="mt-4 flex gap-2 items-center">
                  <div className="datepicker-toggle">
                    <input
                      type="date"
                      className="datepicker-input"
                      value={context.dataVerification.dataRegulation.value1}
                      onChange={(e) => {
                        const { value } = e.target;
                        setContext((ctx) => {
                          ctx.dataVerification!.dataRegulation!.value1 = value;
                        });
                      }}
                    />
                    <span className="datepicker-toggle-button" />
                  </div>
                  <span>-</span>
                  <div className="datepicker-toggle">
                    <input
                      type="date"
                      className="datepicker-input"
                      value={context.dataVerification.dataRegulation.value2}
                      onChange={(e) => {
                        const { value } = e.target;
                        setContext((ctx) => {
                          ctx.dataVerification!.dataRegulation!.value2 = value;
                        });
                      }}
                    />
                    <span className="datepicker-toggle-button" />
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="datepicker-toggle">
                    <input
                      type="date"
                      className="datepicker-input"
                      placeholder={dataVerification.placeholder3}
                      value={context.dataVerification.dataRegulation.value1}
                      onChange={(e) => {
                        const { value } = e.target;
                        setContext((ctx) => {
                          ctx.dataVerification!.dataRegulation!.value1 = value;
                        });
                      }}
                    />
                    <span className="datepicker-toggle-button" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* {context.dataVerification?.dataRegulation?.type === "validity" && (
            <div className="mt-4">
              <Select
                value={context.dataVerification.dataRegulation.type2}
                onValueChange={(value) => {
                  setContext((ctx) => {
                    ctx.dataVerification!.dataRegulation!.type2 = value;
                    ctx.dataVerification!.dataRegulation!.value1 = "";
                    ctx.dataVerification!.dataRegulation!.value2 = "";
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["identificationNumber", "phoneNumber"].map((v) => (
                    <SelectItem value={v} key={v}>
                      {(dataVerification as any)[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )} */}
        </div>

        <Divider className="w-full border-t-[1px]" />

        <div className="flex flex-col gap-2">
          {(["prohibitInput", "hintShow"] as const).map((v) => (
            <div key={v} className="flex items-center">
              <Checkbox
                className="border-2"
                checked={context.dataVerification!.dataRegulation![v]}
                onCheckedChange={(e) => {
                  const { checked } = e.target;
                  setContext((ctx) => {
                    const dataRegulation = ctx.dataVerification?.dataRegulation;
                    if (v === "prohibitInput") {
                      dataRegulation!.prohibitInput = checked;
                    } else if (v === "hintShow") {
                      dataRegulation!.hintShow = checked;
                    }
                  });
                }}
              />
              <span className="ml-2 text-body-sm">
                {(dataVerification as any)[v]}
              </span>
            </div>
          ))}
          {context.dataVerification?.dataRegulation?.hintShow && (
            <div>
              <TextField
                placeholder={dataVerification.placeholder5}
                value={context.dataVerification!.dataRegulation!.hintValue}
                onChange={(e) => {
                  const { value } = e.target;
                  setContext((ctx) => {
                    ctx.dataVerification!.dataRegulation!.hintValue = value;
                  });
                }}
              />
            </div>
          )}
        </div>
      </div>

      <Divider
        className="border-t-[1px]"
        style={{ width: "315px", margin: "0 16px 16px 16px" }}
      />
      <div
        className="flex gap-2 justify-between items-center"
        style={{
          width: "345px",
          paddingRight: "16px",
          justifyContent: "flex-end",
        }}
      >
        {/* <Button
          variant="secondary"
          style={{
            minWidth: "80px",
          }}
          onClick={() => {
            btn("close");
          }}
        >
          {button.cancel}
        </Button> */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            style={{
              minWidth: "80px",
            }}
            onClick={() => {
              btn("delete");
            }}
          >
            {dataVerification.deleteVerification}
          </Button>
          <Button
            variant="default"
            style={{
              minWidth: "80px",
            }}
            onClick={() => {
              btn("confirm");
              document.getElementById("data-verification-button")?.click();
            }}
          >
            {button.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DataVerification;
