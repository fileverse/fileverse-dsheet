import React, { useCallback, useContext, useEffect, useRef } from "react";
import "./index.css";
import {
  locale,
  // updateItem
} from "@sheet-engine/core";
import _ from "lodash";
import WorkbookContext from "../../context";
import Select, { Option } from "../Toolbar/Select";
import SVGIcon from "../SVGIcon";
import { useDialog } from "../../hooks/useDialog";
import ConditionRules from "./ConditionRules";
import { MenuDivider } from "../Toolbar/Divider";

const ConditionalFormat: React.FC<{
  items: string[];
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ items, setOpen }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { showDialog } = useDialog();
  const { conditionformat } = locale(context);
  const activeSubMenuRef = useRef<HTMLDivElement | null>(null);

  const updateSubMenuPosition = useCallback(
    (subMenu: HTMLDivElement, menuItem: HTMLDivElement) => {
      const menuItemRect = menuItem.getBoundingClientRect();
      const workbookContainerRect =
        refs.workbookContainer.current!.getBoundingClientRect();
      const subMenuWidth = subMenu.offsetWidth;
      const availableSpace = workbookContainerRect.right - menuItemRect.right;

      if (availableSpace < subMenuWidth) {
        // Not enough space on the right, position to the left
        subMenu.style.right = "108%";
      } else {
        // Enough space on the right, position to the right
        subMenu.style.right = "-100%";
      }
    },
    [refs.workbookContainer]
  );

  // re-position the subMenu if it oveflows the window
  const showSubMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const target = e.target as HTMLDivElement;
      const menuItem =
        target.className === "fortune-toolbar-menu-line"
          ? target.parentElement!
          : target;
      const subMenu = menuItem.querySelector(
        ".condition-format-sub-menu"
      ) as HTMLDivElement;
      if (_.isNil(subMenu)) return;

      subMenu.style.display = "block";
      activeSubMenuRef.current = subMenu;
      updateSubMenuPosition(subMenu, menuItem as HTMLDivElement);
    },
    [updateSubMenuPosition]
  );

  const hideSubMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const target = e.target as HTMLDivElement;

      if (target.className === "condition-format-sub-menu") {
        target.style.display = "none";
        activeSubMenuRef.current = null;
        return;
      }

      const subMenu = (
        target.className === "condition-format-item"
          ? target.parentElement
          : target.querySelector(".condition-format-sub-menu")
      ) as HTMLDivElement;
      if (_.isNil(subMenu)) return;
      subMenu.style.display = "none";
      activeSubMenuRef.current = null;
    },
    []
  );

  useEffect(() => {
    const handleResize = () => {
      if (activeSubMenuRef.current) {
        const menuItem = activeSubMenuRef.current
          .parentElement as HTMLDivElement;
        if (menuItem) {
          updateSubMenuPosition(activeSubMenuRef.current, menuItem);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateSubMenuPosition]);

  // 获得条件格式
  const getConditionFormatItem = useCallback(
    (name: string) => {
      if (name === "-") {
        return <MenuDivider key={name} />;
      }
      if (name === "highlightCellRules") {
        return (
          <Option
            key={name}
            onMouseEnter={showSubMenu}
            onMouseLeave={hideSubMenu}
          >
            <div className="fortune-toolbar-menu-line" key={`div${name}`}>
              {conditionformat[name]}
              <SVGIcon name="rightArrow" width={18} />
              <div
                className="condition-format-sub-menu"
                style={{
                  display: "none",
                }}
              >
                {[
                  { text: "greaterThan", value: ">" },
                  { text: "greaterThanOrEqual", value: ">=" },
                  { text: "lessThan", value: "<" },
                  { text: "lessThanOrEqual", value: "<=" },
                  { text: "between", value: "[]" },
                  { text: "equal", value: "=" },
                  { text: "textContains", value: "()" },
                  { text: "empty", value: "" },
                  {
                    text: "occurrenceDate",
                    value: conditionformat.yesterday,
                  },
                  { text: "duplicateValue", value: "##" },
                ].map((v) => (
                  <div
                    className="condition-format-item text-body-sm color-text-default"
                    key={v.text}
                    onClick={() => {
                      setOpen?.(false);
                      showDialog(
                        <ConditionRules context={context} />,
                        undefined,
                        (conditionformat as any)[`conditionformat_${v.text}`]
                      );
                    }}
                    tabIndex={0}
                  >
                    {(conditionformat as any)[v.text]}
                    <span>{v.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Option>
        );
      }
      if (name === "itemSelectionRules") {
        return (
          <Option
            key={name}
            onMouseEnter={showSubMenu}
            onMouseLeave={hideSubMenu}
          >
            <div className="fortune-toolbar-menu-line">
              {conditionformat[name]}
              <SVGIcon name="rightArrow" width={18} />
              <div
                className="condition-format-sub-menu"
                style={{ display: "none" }}
              >
                {[
                  { text: "top10", value: conditionformat.top10 },
                  {
                    text: "top10_percent",
                    value: conditionformat.top10_percent,
                  },
                  { text: "last10", value: conditionformat.last10 },
                  {
                    text: "last10_percent",
                    value: conditionformat.last10_percent,
                  },
                  { text: "aboveAverage", value: conditionformat.above },
                  { text: "belowAverage", value: conditionformat.below },
                ].map((v) => (
                  <div
                    className="condition-format-item text-body-sm color-text-default"
                    key={v.text}
                    onClick={() => {
                      setOpen?.(false);
                      showDialog(
                        <ConditionRules context={context} />,
                        undefined,
                        (conditionformat as any)[`conditionformat_${v.text}`]
                      );
                    }}
                    tabIndex={0}
                  >
                    {(conditionformat as any)[v.text]}
                    <span>{v.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Option>
        );
      }
      if (name === "dataBar") {
        return (
          <div className="fortune-toolbar-menu-line" key={`div${name}`}>
            {conditionformat[name]}
            <SVGIcon name="rightArrow" width={18} />
          </div>
        );
      }
      if (name === "colorGradation") {
        return (
          <div className="fortune-toolbar-menu-line" key={`div${name}`}>
            {conditionformat[name]}
            <SVGIcon name="rightArrow" width={18} />
          </div>
        );
      }
      if (name === "icons") {
        return (
          <div className="fortune-toolbar-menu-line" key={`div${name}`}>
            {conditionformat[name]}
          </div>
        );
      }
      if (name === "newFormatRule") {
        return (
          <div className="fortune-toolbar-menu-line" key={`div${name}`}>
            {conditionformat[name]}
          </div>
        );
      }
      if (name === "deleteRule") {
        return (
          <Option
            key={name}
            onMouseEnter={showSubMenu}
            onMouseLeave={hideSubMenu}
          >
            <div className="fortune-toolbar-menu-line">
              {conditionformat[name]}
              <SVGIcon name="rightArrow" width={18} />
              <div
                className="condition-format-sub-menu"
                style={{ display: "none" }}
              >
                {["deleteSheetRule"].map((v) => (
                  <div
                    className="condition-format-item text-body-sm color-text-default"
                    key={v}
                    style={{ padding: "6px 10px" }}
                    onClick={() => {
                      // setContext((ctx) => {
                      //   // updateItem(ctx, "delSheet");
                      // });
                    }}
                    tabIndex={0}
                  >
                    {(conditionformat as any)[v]}
                  </div>
                ))}
              </div>
            </div>
          </Option>
        );
      }
      if (name === "manageRules") {
        return (
          <div className="fortune-toolbar-menu-line" key={`div${name}`}>
            {conditionformat[name]}
          </div>
        );
      }

      return <div />;
    },
    [conditionformat, hideSubMenu, setContext, setOpen, showDialog, showSubMenu]
  );

  return (
    <div className="condition-format">
      <Select style={{ overflow: "visible" }}>
        {items.map((v) => (
          <div key={`option${v}`}>{getConditionFormatItem(v)}</div>
        ))}
      </Select>
    </div>
  );
};

export default ConditionalFormat;
