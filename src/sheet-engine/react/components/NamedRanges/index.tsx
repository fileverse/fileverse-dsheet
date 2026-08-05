import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import _ from 'lodash';
import {
  addDefinedName,
  updateDefinedName,
  deleteDefinedName,
  selectDefinedName,
  getDefinedNameDisplayRange,
  getRangetxt,
  getRangeByTxt,
  refreshFormulasUsingDefinedNames,
} from '@sheet-engine/core';
import type { DefinedName } from '@sheet-engine/core';
import { Button, IconButton, TextField } from '@fileverse/ui';
import WorkbookContext from '../../context';
import './index.css';

function selectionToRangeTxt(context: Parameters<typeof getRangetxt>[0]): string {
  const last = _.last(context.luckysheet_select_save);
  if (!last?.row?.length || !last?.column?.length) return '';
  return (
    getRangetxt(
      context,
      context.currentSheetId,
      {
        row: [last.row[0], last.row[1]],
        column: [last.column[0], last.column[1]],
      },
      '__named_range_form__',
    ) || ''
  );
}

const NamedRanges: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const [name, setName] = useState('');
  const [rangeTxt, setRangeTxt] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Create mode follows selection by default; edit mode locks until grid pick.
  const [rangeFollowsSelection, setRangeFollowsSelection] = useState(true);

  const namedRanges = context.definedNames || [];

  useEffect(() => {
    if (!rangeFollowsSelection) return;
    setRangeTxt(selectionToRangeTxt(context));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.luckysheet_select_save,
    context.currentSheetId,
    rangeFollowsSelection,
  ]);

  const resetForm = useCallback(() => {
    setName('');
    setEditingId(null);
    setError(null);
    setRangeFollowsSelection(true);
    setRangeTxt(selectionToRangeTxt(context));
  }, [context]);

  const parseRangeInput = useCallback(
    (txt: string) => {
      const trimmed = txt.trim();
      if (!trimmed) return null;
      const parsed = getRangeByTxt(context, trimmed);
      const first = parsed?.[0];
      if (!first?.row?.length || !first?.column?.length) return null;

      const sheetId =
        (first as { sheetId?: string }).sheetId || context.currentSheetId;

      return {
        sheetId,
        range: {
          row: [first.row[0], first.row[1]] as [number, number],
          column: [first.column[0], first.column[1]] as [number, number],
        },
      };
    },
    [context],
  );

  const onDone = useCallback(() => {
    setError(null);
    const parsed = parseRangeInput(rangeTxt);
    if (!parsed) {
      setError('Enter a valid range (e.g. Sheet1!A1:B2).');
      return;
    }

    let formError: string | null = null;
    const refreshName = name.trim();
    setContext((draft) => {
      const result = editingId
        ? updateDefinedName(draft, editingId, {
            name,
            sheetId: parsed.sheetId,
            range: parsed.range,
          })
        : addDefinedName(draft, {
            name,
            sheetId: parsed.sheetId,
            range: parsed.range,
          });

      if (!result.ok) {
        formError = result.error;
      }
    });

    if (formError) {
      setError(formError);
      return;
    }

    if (editingId && refreshName) {
      // Re-eval formulas that use this name after the range was repointed.
      setContext((draft) => {
        refreshFormulasUsingDefinedNames(draft, [refreshName]);
      });
    }

    setName('');
    setEditingId(null);
    setError(null);
    setRangeFollowsSelection(true);
  }, [editingId, name, parseRangeInput, rangeTxt, setContext]);

  const onEdit = useCallback(
    (dn: DefinedName) => {
      setEditingId(dn.id);
      setName(dn.name);
      setRangeTxt(getDefinedNameDisplayRange(context, dn));
      setError(null);
      // Keep the existing definition until the user re-picks via the grid icon.
      setRangeFollowsSelection(false);
      setContext((draft) => {
        selectDefinedName(draft, dn.id);
      });
    },
    [context, setContext],
  );

  const onPickFromSelection = useCallback(() => {
    setRangeTxt(selectionToRangeTxt(context));
    setRangeFollowsSelection(true);
    setError(null);
  }, [context]);

  const onDelete = useCallback(
    (id: string) => {
      let deletedName: string | null = null;
      setContext((draft) => {
        deletedName =
          draft.definedNames?.find((d) => d.id === id)?.name ?? null;
        deleteDefinedName(draft, id);
        if (deletedName) {
          refreshFormulasUsingDefinedNames(draft, [deletedName]);
        }
      });
      if (editingId === id) resetForm();
    },
    [editingId, resetForm, setContext],
  );

  const sheetNameById = useMemo(() => {
    const map: Record<string, string> = {};
    context.luckysheetfile.forEach((s) => {
      if (s.id) map[s.id] = s.name;
    });
    return map;
  }, [context.luckysheetfile]);

  const stopSheetKeyCapture = useCallback(
    (e: React.SyntheticEvent) => {
      // Portaled into the sidebar but still React-parented under Workbook —
      // without this, the first keystroke triggers type-to-edit and steals focus.
      e.stopPropagation();
    },
    [],
  );

  return (
    <div
      className="fortune-named-ranges"
      onKeyDown={stopSheetKeyCapture}
      onKeyUp={stopSheetKeyCapture}
      onMouseDown={stopSheetKeyCapture}
    >
      <div className="fortune-named-ranges__form">
        <label className="fortune-named-ranges__label" htmlFor="named-range-name">
          Name
        </label>
        <TextField
          id="named-range-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onMouseDown={(e) => {
            e.stopPropagation();
            (e.target as HTMLInputElement).focus();
          }}
          onKeyDown={stopSheetKeyCapture}
          placeholder="NamedRange1"
          className="w-full"
        />

        <label
          className="fortune-named-ranges__label fortune-named-ranges__label--spaced"
          htmlFor="named-range-range"
        >
          Range
        </label>
        <div className="fortune-named-ranges__range-row">
          <TextField
            id="named-range-range"
            value={rangeTxt}
            onChange={(e) => {
              setRangeFollowsSelection(false);
              setRangeTxt(e.target.value);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              (e.target as HTMLInputElement).focus();
            }}
            onKeyDown={stopSheetKeyCapture}
            placeholder="Sheet1!A1:B2"
            className="w-full"
          />
          <IconButton
            type="button"
            variant="ghost"
            className={`fortune-named-ranges__pick-btn${
              rangeFollowsSelection ? ' is-active' : ''
            }`}
            title="Use current selection (live)"
            icon="Grid2x2"
            onClick={onPickFromSelection}
          />
        </div>

        {error && <div className="fortune-named-ranges__error">{error}</div>}

        <div className="fortune-named-ranges__actions">
          <Button type="button" variant="secondary" onClick={resetForm}>
            Cancel
          </Button>
          <Button type="button" onClick={onDone} disabled={!name.trim()}>
            Done
          </Button>
        </div>
      </div>

      <div className="fortune-named-ranges__list-wrap">
        {namedRanges.length === 0 ? (
          <div className="fortune-named-ranges__empty color-text-secondary">
            No named ranges yet. Select cells, enter a name, and click Done.
          </div>
        ) : (
          <ul className="fortune-named-ranges__list">
            {namedRanges.map((dn) => (
              <li
                key={dn.id}
                className={`fortune-named-ranges__item ${
                  editingId === dn.id ? 'is-editing' : ''
                }`}
              >
                <button
                  type="button"
                  className="fortune-named-ranges__item-main"
                  onClick={() => {
                    setContext((draft) => {
                      selectDefinedName(draft, dn.id);
                    });
                  }}
                >
                  <span className="fortune-named-ranges__item-name">{dn.name}</span>
                  <span className="fortune-named-ranges__item-range color-text-secondary">
                    {getDefinedNameDisplayRange(context, dn) ||
                      `${sheetNameById[dn.sheetId] || 'Sheet'}!…`}
                  </span>
                </button>
                <div className="fortune-named-ranges__item-actions">
                  <IconButton
                    type="button"
                    variant="ghost"
                    title="Edit"
                    icon="Pencil"
                    onClick={() => onEdit(dn)}
                  />
                  <IconButton
                    type="button"
                    variant="ghost"
                    title="Delete"
                    icon="Trash2"
                    onClick={() => onDelete(dn.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NamedRanges;
