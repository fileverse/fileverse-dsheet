import React from 'react';
import ColorPicker from '../Toolbar/ColorPicker';
import './index.css';
import SVGIcon from '../SVGIcon';

type Props = {
  onCustomPick: (color: string | undefined) => void;
  onColorPick: (color: string) => void;
};

export const CustomColor: React.FC<Props> = ({ onCustomPick, onColorPick }) => {
  return (
    <div id="fortune-custom-color">
      <div
        className="color-reset"
        onClick={() => onCustomPick(undefined)}
        tabIndex={0}
      >
        <SVGIcon name="reset-color" width={16} height={16} />
        Reset
      </div>

      <ColorPicker
        onPick={(color) => {
          onColorPick(color);
        }}
      />
    </div>
  );
};
