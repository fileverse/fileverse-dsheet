import { Context, getSheetIndex } from '@sheet-engine/core';
import React, { useContext, useEffect, useState } from 'react';
import WorkbookContext from '../../context';
import ColorPicker from '../Toolbar/ColorPicker';
import './index.css';
import SVGIcon from '../SVGIcon';

type Props = {
  triggerParentUpdate: (state: boolean) => void;
};

export const ChangeColor: React.FC<Props> = ({ triggerParentUpdate }) => {
  const { context, setContext } = useContext(WorkbookContext);
  const [selectColor, setSelectColor] = useState<undefined | string>(
    context.luckysheetfile[
      getSheetIndex(context, context.currentSheetId) as number
    ].color,
  );
  // 把用户选择的颜色记录在ctx中
  useEffect(() => {
    setContext((ctx: Context) => {
      if (ctx.allowEdit === false) return;
      const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
      ctx.luckysheetfile[index].color = selectColor;
    });
  }, [selectColor, setContext]);

  return (
    <div id="fortune-change-color">
      <div
        className="color-reset"
        onClick={() => setSelectColor(undefined)}
        tabIndex={0}
      >
        <SVGIcon name="reset-color" width={16} height={16} />
        Reset
      </div>

      <ColorPicker
        onPick={(color) => {
          triggerParentUpdate(true);
          setSelectColor(color);
          triggerParentUpdate(false);
        }}
      />
    </div>
  );
};
