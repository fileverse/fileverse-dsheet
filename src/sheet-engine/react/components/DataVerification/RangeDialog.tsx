import { locale } from '@sheet-engine/core';
import { Button, cn, IconButton, TextField } from '@fileverse/ui';
import React, { useCallback, useContext, useEffect, useState } from 'react';
// import DataVerification from ".";
import WorkbookContext from '../../context';
// import ConditionRules from "../ConditionFormat/ConditionRules";
import './index.css';
import { getDisplayedRangeTxt } from './getDisplayedRangeTxt';

const RangeDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const {
    dataVerification,
    button,
    findAndReplace,
    // toolbar
  } = locale(context);
  const [rangeTxt2, setRangeTxt2] = useState<string>(
    getDisplayedRangeTxt(context),
  );

  const close = useCallback(() => {
    const rangeDialogType = context.rangeDialog?.type ?? '';
    setContext((ctx) => {
      if (ctx.rangeDialog) {
        ctx.rangeDialog.show = false;
        ctx.rangeDialog.singleSelect = false;
      }
    });

    // Find & replace opens this dialog with type `searchRange`; do not trigger
    // data verification / conditional-format synthetic button clicks.
    if (rangeDialogType === 'searchRange') {
      return;
    }

    document.getElementById('data-verification-button')?.click();
    if (rangeDialogType.indexOf('between') >= 0) {
      document.getElementById('conditional-format-button')?.click();
      return;
    }
    if (rangeDialogType.indexOf('conditionRules') >= 0) {
      document.getElementById('conditional-format-button')?.click();
    }
  }, [setContext, context.rangeDialog?.type]);

  useEffect(() => {
    setRangeTxt2(getDisplayedRangeTxt(context));
  }, [context, context.luckysheet_select_save]);

  return (
    <div
      id="range-dialog"
      className="fortune-dialog fortune-range-dialog"
      data-testid="range-dialog"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      tabIndex={0}
    >
      <div
        className={cn(
          'fortune-range-dialog__header flex items-center justify-between border-b color-border-default py-3 px-6',
        )}
        data-testid="range-dialog-header"
      >
        <div
          className="fortune-range-dialog__heading text-heading-sm"
          data-testid="range-dialog-heading"
        >
          {context.rangeDialog?.type === 'searchRange'
            ? findAndReplace.selectDataRangeTitle
            : dataVerification.selectCellRange}
        </div>
        <IconButton
          icon="X"
          variant="ghost"
          onClick={close}
          tabIndex={0}
          className="fortune-range-dialog__icon fortune-range-dialog__icon--close"
          data-testid="range-dialog-icon-close"
        />
      </div>
      <div
        className="fortune-range-dialog__para px-6 pb-6 pt-4 text-body-sm"
        data-testid="range-dialog-para"
      >
        <TextField
          className="w-full"
          readOnly
          placeholder={
            context.rangeDialog?.type === 'searchRange'
              ? findAndReplace.rangeInputPlaceholder
              : dataVerification.selectCellRange2
          }
          value={rangeTxt2}
        />
      </div>
      <div
        className="fortune-range-dialog__actions px-6 pb-6 flex flex-row gap-2 justify-end"
        data-testid="range-dialog-actions"
      >
        <Button
          variant="secondary"
          className="fortune-range-dialog__cta fortune-range-dialog__cta--close"
          style={{ minWidth: '80px' }}
          onClick={close}
          tabIndex={0}
          data-testid="range-dialog-cta-close"
        >
          {button.close}
        </Button>
        <Button
          variant="default"
          className="fortune-range-dialog__cta fortune-range-dialog__cta--confirm"
          style={{ minWidth: '80px' }}
          onClick={() => {
            setContext((ctx) => {
              ctx.rangeDialog!.rangeTxt = rangeTxt2;
            });
            close();
          }}
          tabIndex={0}
          data-testid="range-dialog-cta-confirm"
        >
          {button.confirm}
        </Button>
      </div>
    </div>
  );
};

export default RangeDialog;
