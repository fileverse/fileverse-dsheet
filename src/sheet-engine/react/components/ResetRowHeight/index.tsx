/* eslint-disable jsx-a11y/control-has-associated-label */
import { getFlowdata, locale, api } from '@sheet-engine/core';
import {
  Button,
  RadioGroup,
  RadioGroupItem,
  Label,
  TextField,
} from '@fileverse/ui';
import _ from 'lodash';
import React, { useContext, useState } from 'react';
import WorkbookContext from '../../context';
import { useAlert } from '../../hooks/useAlert';
import { useDialog } from '../../hooks/useDialog';

export const ResetRowHeight: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { showAlert } = useAlert();
  const { button } = locale(context);
  const { hideDialog } = useDialog();

  const [radioValue, setRadioValue] = useState('number');
  const [numberValue, setNumberValue] = useState(19);

  const getMaxRowHeight = (row: number) => {
    const data = getFlowdata(context);
    const defaultHeight = context.defaultrowlen || 19;
    let maxHeight = defaultHeight;
    if (!data?.[row]) return maxHeight;

    for (let col = 0; col < data[row].length; col += 1) {
      const cell = data[row][col];
      if (!cell) continue;
      const raw = typeof cell === 'string' ? cell : cell.v || cell.m;
      if (_.isNil(raw)) continue;
      const text = String(raw);
      const lines = text.split('\n').length;
      const approxHeight = Math.max(defaultHeight, Math.ceil(lines * 19));
      if (approxHeight > maxHeight) {
        maxHeight = approxHeight;
      }
    }

    return maxHeight;
  };

  return (
    <div id="fortune-split-column">
      <div>
        <RadioGroup
          defaultValue={radioValue}
          onValueChange={(value) => {
            setRadioValue(value);
          }}
        >
          <div className="flex-col gap-4">
            <div className="flex items-center space-x-1">
              <RadioGroupItem id="row-h-1" size="lg" value="number" />
              <Label className="text-heading-xsm" htmlFor="row-h-1">
                Enter new row height in pixels. (Default: 19)
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
            <RadioGroupItem id="row-h-2" size="lg" value="fit" />
            <Label className="text-heading-xsm" htmlFor="row-h-2">
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
            if (radioValue === 'number') {
              const targetRowHeight = numberValue;
              setContext((draftCtx) => {
                if (
                  _.isUndefined(targetRowHeight) ||
                  targetRowHeight === null ||
                  targetRowHeight <= 0 ||
                  targetRowHeight > 545
                ) {
                  showAlert('The row height must be between 1 ~ 545', 'ok');
                  draftCtx.contextMenu = {};
                  return;
                }
                const rowHeightList: Record<string, number> = {};
                _.forEach(draftCtx.luckysheet_select_save, (section) => {
                  for (
                    let rowNum = section.row[0];
                    rowNum <= section.row[1];
                    rowNum += 1
                  ) {
                    rowHeightList[rowNum] = targetRowHeight;
                  }
                });
                api.setRowHeight(draftCtx, rowHeightList, {}, true);
                draftCtx.contextMenu = {};
              });
            } else {
              setContext((draftCtx) => {
                const rowHeightList: Record<string, number> = {};
                _.forEach(draftCtx.luckysheet_select_save, (section) => {
                  for (
                    let rowNum = section.row[0];
                    rowNum <= section.row[1];
                    rowNum += 1
                  ) {
                    rowHeightList[rowNum] = getMaxRowHeight(rowNum);
                  }
                });
                api.setRowHeight(draftCtx, rowHeightList, {}, true);
                draftCtx.contextMenu = {};
              });
            }
            hideDialog();
          }}
          tabIndex={0}
        >
          Ok
        </Button>
      </div>
    </div>
  );
};
