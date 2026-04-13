import React, {
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  Context,
  MAX_ZOOM_RATIO,
  MIN_ZOOM_RATIO,
  getSheetIndex,
} from '@sheet-engine/core';
import { useMediaQuery } from 'usehooks-ts';
import { IconButton } from '@fileverse/ui';
import WorkbookContext from '../../context';
// import SVGIcon from "../SVGIcon";
import { useOutsideClick } from '../../hooks/useOutsideClick';
import './index.css';

const presets = [
  {
    text: '10%',
    value: 0.1,
  },
  {
    text: '30%',
    value: 0.3,
  },
  {
    text: '50%',
    value: 0.5,
  },
  {
    text: '70%',
    value: 0.7,
  },
  {
    text: '100%',
    value: 1,
  },
  {
    text: '150%',
    value: 1.5,
  },
  {
    text: '200%',
    value: 2,
  },
  {
    text: '300%',
    value: 3,
  },
  {
    text: '400%',
    value: 4,
  },
];

const ZoomControl: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const menuRef = useRef<HTMLDivElement>(null);
  const [radioMenuOpen, setRadioMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 780px)', { defaultValue: true });

  useOutsideClick(menuRef, () => {
    setRadioMenuOpen(false);
  }, []);

  const zoomTo = useCallback(
    (val: number) => {
      val = parseFloat(val.toFixed(1));
      if (val > MAX_ZOOM_RATIO || val < MIN_ZOOM_RATIO) {
        return;
      }
      setContext(
        (ctx: Context) => {
          const index = getSheetIndex(ctx, ctx.currentSheetId);
          if (index == null) {
            return;
          }
          ctx.luckysheetfile[index].zoomRatio = val;
          ctx.zoomRatio = val;
        },
        { noHistory: true },
      );
    },
    [setContext],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Keep zoom shortcuts on Cmd/Ctrl only.
      if (e.altKey) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'Equal') {
        zoomTo(context.zoomRatio + 0.1);
        e.preventDefault();
        e.stopPropagation();
      } else if ((e.metaKey || e.ctrlKey) && !e.altKey && e.code === 'Minus') {
        zoomTo(context.zoomRatio - 0.1);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [context.zoomRatio, zoomTo]);

  return (
    <div className="fortune-zoom-container">
      {!isMobile && (
        <IconButton
          className="fortune-sheettab-button border-none shadow-none"
          onClick={(e: React.MouseEvent) => {
            zoomTo(context.zoomRatio - 0.1);
            e.stopPropagation();
          }}
          elevation={1}
          icon="Minus"
          size="sm"
          variant="secondary"
        />
      )}
      <div className="fortune-zoom-ratio">
        <div
          className="fortune-zoom-ratio-current fortune-zoom-button"
          onClick={() => setRadioMenuOpen(true)}
          tabIndex={0}
          style={{ fontWeight: '500' }}
        >
          {(context.zoomRatio * 100).toFixed(0)}%
        </div>
        {radioMenuOpen && (
          <div className="fortune-zoom-ratio-menu" ref={menuRef}>
            {presets.map((v) => (
              <div
                className="fortune-zoom-ratio-item"
                key={v.text}
                onClick={(e) => {
                  zoomTo(v.value);
                  e.preventDefault();
                }}
                tabIndex={0}
              >
                <div className="fortune-zoom-ratio-text">{v.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {!isMobile && (
        <IconButton
          className="fortune-sheettab-button border-none shadow-none"
          onClick={(e: React.MouseEvent) => {
            zoomTo(context.zoomRatio + 0.1);
            e.stopPropagation();
          }}
          elevation={1}
          icon="Plus"
          size="sm"
          variant="secondary"
        />
      )}
    </div>
  );
};

export default ZoomControl;
