import React, { useContext, useState, useCallback, useMemo } from "react";
import {
  cancelNormalSelected,
  getSheetIndex,
  locale,
  update,
} from "@sheet-engine/core";
import {
  Button,
  Divider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextField,
} from "@fileverse/ui";
import _ from "lodash";
import WorkbookContext from "../../context";
import "./index.css";
import { useDialog } from "../../hooks/useDialog";

export const FormatSearch: React.FC<{
  type: "currency" | "date" | "number";
  onCancel: () => void;
}> = ({ type, onCancel: _onCancel }) => {
  const {
    context,
    setContext,
    refs: { cellInput },
  } = useContext(WorkbookContext);
  const [decimalPlace, setDecimalPlace] = useState(2);
  const [selectedFormatIndex, setSelectedFormatIndex] = useState(0);
  const { button, format, currencyDetail, dateFmtList } = locale(context);
  const { showDialog } = useDialog();
  const toolbarFormatAll = useMemo(
    () => ({
      currency: currencyDetail,
      date: dateFmtList,
      number: [], // has not been defined
    }),
    [currencyDetail, dateFmtList]
  );
  const toolbarFormat = useMemo(
    () => toolbarFormatAll[type],
    [toolbarFormatAll, type]
  );
  // const tips = _.get(format, type);

  const onConfirm = useCallback(() => {
    if (decimalPlace < 0 || decimalPlace > 9) {
      _onCancel();
      showDialog(format.tipDecimalPlaces, "ok");
      return;
    }
    setContext((ctx) => {
      const index = getSheetIndex(ctx, ctx.currentSheetId);
      if (_.isNil(index)) return;
      const selectedFormat = toolbarFormat[selectedFormatIndex].value;
      const formatString = `${selectedFormat} #,##0.${"0".repeat(
        decimalPlace
      )}`;
      _.forEach(ctx.luckysheet_select_save, (selection) => {
        for (let r = selection.row[0]; r <= selection.row[1]; r += 1) {
          for (let c = selection.column[0]; c <= selection.column[1]; c += 1) {
            if (
              ctx.luckysheetfile[index].data?.[r][c] &&
              ctx.luckysheetfile[index].data?.[r][c]?.ct?.t === "n"
            ) {
              ctx.luckysheetfile[index].data![r][c]!.ct!.fa = formatString;
              ctx.luckysheetfile[index].data![r][c]!.m = update(
                formatString,
                ctx.luckysheetfile[index].data![r][c]!.v
              );
            }
          }
        }
      });
      _onCancel();
    });
  }, [
    _onCancel,
    decimalPlace,
    format.tipDecimalPlaces,
    selectedFormatIndex,
    setContext,
    showDialog,
    toolbarFormat,
  ]);

  const onCancel = useCallback(() => {
    setContext((ctx) => {
      cancelNormalSelected(ctx);
      if (cellInput.current) {
        cellInput.current.innerHTML = "";
      }
    });
    _onCancel();
  }, [_onCancel, cellInput, setContext]);

  return (
    <div className="format-search">
      <div className="flex flex-col gap-4">
        {type === "currency" && (
          <div className="flex items-center gap-2">
            <span className="text-body-sm" style={{ width: "180px" }}>
              {format.decimalPlaces}：
            </span>
            <TextField
              className="w-full"
              type="number"
              min={0}
              max={9}
              defaultValue={2}
              onChange={(e) => {
                setDecimalPlace(parseInt(e.target.value, 10));
              }}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Select
            value={String(selectedFormatIndex)}
            onValueChange={(value) => {
              setSelectedFormatIndex(Number(value));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue className="flex items-center gap-2">
                <span>{toolbarFormat[selectedFormatIndex]?.name}</span>
                <span className="text-body-sm color-text-secondary ml-1">
                  ({toolbarFormat[selectedFormatIndex]?.value})
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {toolbarFormat.map((v: any, index: number) => (
                <SelectItem key={v.name} value={String(index)}>
                  <div className="flex justify-between w-full items-center gap-2">
                    <span>{v.name}</span>
                    <span className="text-body-sm color-text-secondary">
                      ({v.value})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Divider className="w-full border-t-[1px] my-4" />

      <div className="flex gap-2 justify-end">
        <Button
          variant="secondary"
          style={{
            minWidth: "80px",
          }}
          onClick={onCancel}
          tabIndex={0}
        >
          {button.cancel}
        </Button>
        <Button
          variant="default"
          style={{
            minWidth: "80px",
          }}
          onClick={onConfirm}
          tabIndex={0}
        >
          {button.confirm}
        </Button>
      </div>
    </div>
  );
};
