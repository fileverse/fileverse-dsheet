import React, { useContext, useMemo, useState } from 'react';
import _ from 'lodash';
import {
  getRangetxt,
  findDefinedNameForSelection,
  getDefinedNameDisplayRange,
  selectDefinedName,
  openNamedRangesSidebar,
} from '@sheet-engine/core';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  LucideIcon,
} from '@fileverse/ui';
import WorkbookContext from '../../context';
import './name-box.css';

const LocationBox: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const [open, setOpen] = useState(false);

  const matchingName = useMemo(
    () => findDefinedNameForSelection(context),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.currentSheetId, context.luckysheet_select_save, context.definedNames],
  );

  const rangeText = useMemo(() => {
    if (matchingName) return matchingName.name;

    const lastSelection = _.last(context.luckysheet_select_save);
    if (
      !(
        lastSelection &&
        lastSelection.row_focus != null &&
        lastSelection.column_focus != null
      )
    )
      return '';
    const rf = lastSelection.row_focus;
    const cf = lastSelection.column_focus;
    if (context.config.merge != null && `${rf}_${cf}` in context.config.merge) {
      return getRangetxt(context, context.currentSheetId, {
        column: [cf, cf],
        row: [rf, rf],
      });
    }
    return getRangetxt(context, context.currentSheetId, lastSelection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.currentSheetId,
    context.luckysheet_select_save,
    context.config.merge,
    matchingName,
  ]);

  const namedRanges = context.definedNames || [];

  return (
    <div className="fortune-name-box-container">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="fortune-name-box fortune-name-box--interactive"
            dir="ltr"
            aria-label="Named ranges"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <span className="fortune-name-box__text">{rangeText}</span>
            <LucideIcon
              name="ChevronDown"
              size="sm"
              className={`fortune-name-box__chevron ${open ? 'is-open' : ''}`}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          elevation={2}
          className="fortune-named-ranges-popover color-bg-default"
        >
          <div className="fortune-named-ranges-popover__body">
            {namedRanges.length > 0 ? (
              <ul className="fortune-named-ranges-popover__list">
                {namedRanges.map((dn) => (
                  <li key={dn.id}>
                    <button
                      type="button"
                      className="fortune-named-ranges-popover__item"
                      onClick={() => {
                        setContext((draft) => {
                          selectDefinedName(draft, dn.id);
                        });
                        setOpen(false);
                      }}
                    >
                      <span className="fortune-named-ranges-popover__item-left">
                        <LucideIcon
                          name="Grid2x2"
                          size="sm"
                          className="color-text-secondary"
                        />
                        <span className="fortune-named-ranges-popover__name">
                          {dn.name}
                        </span>
                      </span>
                      <span className="fortune-named-ranges-popover__range">
                        {getDefinedNameDisplayRange(context, dn)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="fortune-named-ranges-popover__empty color-text-secondary">
                No named ranges yet
              </div>
            )}

            <button
              type="button"
              className="fortune-named-ranges-popover__manage"
              onClick={() => {
                setOpen(false);
                openNamedRangesSidebar();
              }}
            >
              <div className="fortune-named-ranges-popover__manage-title">
                Manage named ranges
              </div>
              <div className="fortune-named-ranges-popover__manage-hint color-text-secondary">
                Create a named range by selecting cells and entering the desired
                name into the text box.
              </div>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default LocationBox;
