import React from "react";

const palette = [
  [
    "#000000",
    "#444444",
    "#666666",
    "#999999",
    "#B7B7B7",
    "#cccccc",
    "#D9D9D9",
    "#EFEFEF",
    "#f3f3f3",
    "#ffffff",
  ],
  [
    "#970007",
    "#FE0012",
    "#FE9728",
    "#FFFD40",
    "#27FD3C",
    "#21FFFF",
    "#4A89E4",
    "#0027F9",
    "#9726FA",
    "#FD23FA",
  ],
  [
    "#E6B8B0",
    "#f4cccc",
    "#FCE5CF",
    "#FFF1CF",
    "#DAEAD4",
    "#D0E0E3",
    "#C9DBF7",
    "#CFE3F2",
    "#D9D3E8",
    "#EAD1DC",
  ],
  [
    "#DC7D6D",
    "#E9999A",
    "#F9CAA0",
    "#FFE49F",
    "#B7D6AB",
    "#A3C4C9",
    "#A4C3F2",
    "#A0C6E6",
    "#B4A8D4",
    "#D5A7BC",
  ],
  [
    "#CB402B",
    "#DF6668",
    "#F6B171",
    "#FFD871",
    "#95C382",
    "#77A6AF",
    "#6DA0E8",
    "#70AADA",
    "#8E7EC0",
    "#C17C9F",
  ],
  [
    "#A51A0A",
    "#CB000C",
    "#E59043",
    "#F1C046",
    "#6CA756",
    "#46828D",
    "#3C7BD4",
    "#3E87C3",
    "#6651A4",
    "#A54E78",
  ],
  [
    "#841F11",
    "#980007",
    "#B35E19",
    "#BF8F22",
    "#3A7527",
    "#15505B",
    "#0E5AC8",
    "#0B5592",
    "#0B5592",
    "#731C46",
  ],
  [
    "#5B0E03",
    "#660003",
    "#783E0E",
    "#7F5F13",
    "#284E19",
    "#0D343D",
    "#1C4785",
    "#073961",
    "#1F154B",
    "#4C112F",
  ],
];

type Props = {
  onPick: (color: string) => void;
};

const ColorPicker: React.FC<Props> = ({ onPick }) => {
  return (
    <div className="fortune-toolbar-color-picker">
      {palette.map((rows, i) => (
        <div key={i} className="fortune-toolbar-color-picker-row">
          {rows.map((c) => (
            <div
              key={c}
              className="fortune-toolbar-color-picker-item"
              onClick={() => onPick(c)}
              tabIndex={0}
              style={{
                backgroundColor: c,
                border: c === "#ffffff" ? "1px solid #E8EBEC" : "none",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default ColorPicker;
