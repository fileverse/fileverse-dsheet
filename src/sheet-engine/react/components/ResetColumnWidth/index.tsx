/* eslint-disable jsx-a11y/control-has-associated-label */
import { getFlowdata, locale, api } from "@sheet-engine/core";
import {
  Button,
  RadioGroup,
  RadioGroupItem,
  Label,
  TextField,
} from "@fileverse/ui";
import _ from "lodash";
import React, { useContext, useState } from "react";
import WorkbookContext from "../../context";
import { useAlert } from "../../hooks/useAlert";
import { useDialog } from "../../hooks/useDialog";
//   import "./index.css";

export const ResetColumnWidth: React.FC<{}> = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showAlert } = useAlert();
  const { button } = locale(context);
  const { hideDialog } = useDialog();

  const [radioValue, setRadioValue] = useState("number");
  const [numberValue, setNumberValue] = useState(100);

  const getMaxCellWidth = (col: number) => {
    const data = getFlowdata(context);
    let maxWidth = 100;
    if (data) {
      for (let i = 0; i < data.length; i += 1) {
        // @ts-expect-error later
        const cellD: string | { v: string; m: string } = data[i][col];
        if (typeof cellD === "string") {
          if (cellD.length * 7 > maxWidth) {
            maxWidth = cellD.length * 7;
          }
        } else if (typeof cellD === "object" && cellD !== null) {
          const cellText = cellD.v || cellD.m;
          if (cellText && cellText.length * 7 > maxWidth) {
            maxWidth = cellText.length * 7;
          }
        }
      }
    }
    return maxWidth;
  };

  return (
    <div id="fortune-split-column">
      {/* <div className="splitDataPreview text-heading-xsm">
                Resize column
            </div> */}
      <div className="">
        <RadioGroup
          defaultValue={radioValue}
          onValueChange={(value) => {
            setRadioValue(value);
          }}
        >
          <div className="flex-col gap-4">
            <div className="flex items-center space-x-1">
              <RadioGroupItem id="r1" size="lg" value="number" />
              <Label className="text-heading-xsm" htmlFor="r1">
                Enter new column width in pixels. (Default: 80)
              </Label>
            </div>
            <TextField
              className="w-1/3 my-4"
              defaultValue={numberValue}
              isValid
              onChange={(e) => {
                setNumberValue(e.target.value as unknown as number);
              }}
              placeholder="Number"
            />
          </div>
          <div className="flex items-center space-x-1 mb-4">
            <RadioGroupItem id="r2" size="lg" value="fit" />
            <Label className="text-heading-xsm" htmlFor="r2">
              Fit to data
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            hideDialog();
          }}
          tabIndex={0}
        >
          {button.cancel}
        </Button>
        <Button
          onClick={() => {
            if (radioValue === "number") {
              const targetColWidth = numberValue;
              setContext((draftCtx) => {
                if (
                  _.isUndefined(targetColWidth) ||
                  targetColWidth === null ||
                  targetColWidth <= 0 ||
                  targetColWidth > 2038
                ) {
                  showAlert("The column width must be between 0 ~ 2038", "ok");
                  draftCtx.contextMenu = {};
                  return;
                }
                const numColWidth = targetColWidth;
                const colWidthList: Record<string, number> = {};
                _.forEach(draftCtx.luckysheet_select_save, (section) => {
                  for (
                    let colNum = section.column[0];
                    colNum <= section.column[1];
                    colNum += 1
                  ) {
                    getMaxCellWidth(colNum);
                    colWidthList[colNum] = numColWidth;
                  }
                });
                api.setColumnWidth(draftCtx, colWidthList, {}, true);
                draftCtx.contextMenu = {};
              });
            } else {
              const targetColWidth = numberValue;
              setContext((draftCtx) => {
                if (
                  _.isUndefined(targetColWidth) ||
                  targetColWidth === null ||
                  targetColWidth <= 0 ||
                  targetColWidth > 2038
                ) {
                  showAlert("The column width must be between 0 ~ 2038", "ok");
                  draftCtx.contextMenu = {};
                  return;
                }
                const colWidthList: Record<string, number> = {};
                _.forEach(draftCtx.luckysheet_select_save, (section) => {
                  for (
                    let colNum = section.column[0];
                    colNum <= section.column[1];
                    colNum += 1
                  ) {
                    colWidthList[colNum] = getMaxCellWidth(colNum);
                  }
                });
                api.setColumnWidth(draftCtx, colWidthList, {}, true);
                draftCtx.contextMenu = {};
              });
            }
            hideDialog();
          }}
          tabIndex={0}
        >
          Ok
          {/* {button.confirm} */}
        </Button>
      </div>
    </div>
  );
};
