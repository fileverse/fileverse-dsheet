import React, { CSSProperties } from "react";
import SVGIcon from "../SVGIcon";

const Select: React.FC<{
  children?: React.ReactNode;
  style?: CSSProperties;
}> = ({ children, style }) => {
  return (
    <div className="fortune-toolbar-select" style={style}>
      {children}
    </div>
  );
};

type OptionProps = {
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  iconId?: string;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
};

const toCssId = (s: string) =>
  String(s)
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-");

const Option: React.FC<React.PropsWithChildren<OptionProps>> = ({
  iconId,
  onClick,
  children,
  onMouseLeave,
  onMouseEnter,
}) => {
  const iconIdClass = iconId ? toCssId(iconId) : "option";
  return (
    <div
      onClick={onClick}
      tabIndex={0}
      className={`fortune-toolbar-select-option fortune-toolbar-select-option--${iconIdClass}`}
      data-icon-id={iconId ?? undefined}
      data-testid={`toolbar-select-option-${iconId ?? "option"}`}
      onMouseLeave={(e) => onMouseLeave?.(e)}
      onMouseEnter={(e) => onMouseEnter?.(e)}
    >
      {iconId && <SVGIcon name={iconId} />}
      <div className="fortuen-toolbar-text color-text-default text-body-sm w-full">
        {children}
      </div>
    </div>
  );
};

export { Option };

export default Select;
