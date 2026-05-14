import { getFormulaEditorOwner, locale } from '@sheet-engine/core';
import { Button, TextField, LucideIcon, Tooltip } from '@fileverse/ui';
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import WorkbookContext from '../../../context';
import './index.css';
import { DraggableDiv } from './dragable-div';

const FormulaHint = (props: any) => {
  const { showFormulaHint, handleShowFormulaHint, commaCount, functionName } =
    props;
  const dragHasMoved = useRef(false);
  const { context } = useContext(WorkbookContext);
  const isFxOwner = getFormulaEditorOwner(context) === 'fx';
  const firstSelection = context.luckysheet_select_save?.[0];
  const { formulaMore } = locale(context);
  // if (!context.functionHint) return null;
  // @ts-ignore
  // Use functionName prop if provided, otherwise fall back to context.functionHint
  const fn = functionName
    ? context.formulaCache.functionlistMap[functionName]
    : context.formulaCache.functionlistMap[context?.functionHint || ''];
  const [API_KEY, setAPI_KEY] = useState('');
  const [showAPInput, setShowAPInput] = useState(true);
  const [isKeyAdded, setApiKeyAdded] = useState(false);
  const formulaExpand = localStorage.getItem('formula-expand') === 'true';
  const [showFunctionBody, setShouldShowFunctionBody] = useState(formulaExpand);

  useEffect(() => {
    if (!fn) return;
    if (!fn.API_KEY) {
      setAPI_KEY('');
      setApiKeyAdded(false);
      setShowAPInput(false);
      return;
    }
    const stored = localStorage.getItem(fn.API_KEY);
    setAPI_KEY(stored ?? '');
    setApiKeyAdded(Boolean(stored));
    setShowAPInput(stored === null);
  }, [fn]);
  const apiKeyPlaceholder: Record<string, string> = {
    ETHERSCAN_API_KEY: 'Etherscan API key',
  };
  const hintRef = useRef<HTMLDivElement>(null);
  const cellHeightPx =
    firstSelection?.height_move != null
      ? Number(firstSelection.height_move)
      : 24;
  const belowCellTop = cellHeightPx + 4;
  const [top, setTop] = useState(belowCellTop);
  const [showDelayedHint, setShowDelayedHint] = useState(false);

  const measureFormulaHintPlacement = useCallback(() => {
    if (firstSelection?.top == null || firstSelection.height_move == null) {
      setTop(belowCellTop);
      return;
    }

    const inputBoxInnerEl = document.querySelector(
      '#luckysheet-input-box .luckysheet-input-box-inner',
    ) as HTMLDivElement | null;
    const cellH = isFxOwner
      ? Number(firstSelection.height_move) || cellHeightPx
      : (inputBoxInnerEl?.offsetHeight ??
        Number(firstSelection.height_move) ??
        cellHeightPx);
    const innerEl = hintRef.current;
    const popupHeight = Math.min(innerEl?.offsetHeight || 360, 360);
    const inputBox = document.getElementById('luckysheet-input-box');
    const rect = inputBox?.getBoundingClientRect();
    if (!rect) {
      setTop(cellH + 4);
      return;
    }

    const cellBottomViewport = rect.top + cellH;
    const availableBelow = window.innerHeight - cellBottomViewport - 12;
    const preferBelow = popupHeight <= availableBelow;

    let topV = preferBelow ? cellH + 4 : -(popupHeight + 8);

    const fxHint = document.getElementsByClassName('fx-hint')?.[0] as
      | HTMLElement
      | undefined;
    if (fxHint && fxHint.style.display !== 'none') {
      topV = 25;
    }
    setTop(topV);
  }, [
    belowCellTop,
    cellHeightPx,
    firstSelection?.height_move,
    firstSelection?.top,
    isFxOwner,
  ]);

  useEffect(() => {
    if (isFxOwner) return;
    const inputBoxInnerEl = document.querySelector(
      '#luckysheet-input-box .luckysheet-input-box-inner',
    ) as HTMLDivElement | null;
    if (!inputBoxInnerEl || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      measureFormulaHintPlacement();
    });
    observer.observe(inputBoxInnerEl);
    return () => {
      observer.disconnect();
    };
  }, [isFxOwner, measureFormulaHintPlacement]);

  useLayoutEffect(() => {
    if (!fn) {
      return undefined;
    }
    measureFormulaHintPlacement();
    const id = requestAnimationFrame(measureFormulaHintPlacement);
    return () => {
      cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fn` only used for guard; functionName/context.functionHint cover changes
  }, [
    functionName,
    context.functionHint,
    measureFormulaHintPlacement,
    showFormulaHint,
    commaCount,
    showFunctionBody,
  ]);

  const hexToRgbString = (hex: string) => {
    // Remove the '#' if present
    hex = hex.replace('#', '');

    // Extract RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Return the RGB as a string
    return `${r}, ${g}, ${b}`;
  };

  const bgColor = (BRAND_SECONDARY_COLOR: string) => {
    const bg = BRAND_SECONDARY_COLOR
      ? `rgb(${hexToRgbString(BRAND_SECONDARY_COLOR)}, 0.4)`
      : '#FFDF0A';

    return bg;
  };

  useEffect(() => {
    setShowDelayedHint(false);
    const t = setTimeout(() => setShowDelayedHint(true), 40);
    return () => clearTimeout(t);
  }, [top]);

  if (!fn) {
    return null;
  }

  const fnNameClass = fn.n
    ? String(fn.n)
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-+/g, '-')
    : '';

  return (
    <DraggableDiv
      initialTop={top}
      dragHasMoved={dragHasMoved}
      className={`bg-secondary text-secondary-foreground p-4 rounded-lg flex items-center justify-center ${
        showDelayedHint ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {showFormulaHint && (
        <div>
          <Tooltip
            text="Hide formula suggestions (F10)"
            position="top"
            style={{
              position: 'absolute',
              left: '210px',
              top: '-40px',
              width: '200px',
            }}
          >
            <button
              type="button"
              className="fortune-formula-hint__icon fortune-formula-hint__action flex items-center justify-center w-4 h-4 rounded-full"
              style={{
                backgroundColor: 'black',
                zIndex: 2000,
                position: 'absolute',
                left: '327px',
                top: '-8px',
                padding: '2.4px',
                color: 'white',
              }}
              onClick={handleShowFormulaHint}
              aria-label="Close formula hint"
              data-testid="formula-hint-icon-close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-x-icon lucide-x color-white"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </Tooltip>
          <div
            {...props}
            ref={hintRef}
            id="luckysheet-formula-help-c"
            className={`fortune-formula-hint fortune-formula-hint--${
              fnNameClass || 'unknown'
            } luckysheet-formula-help-c`}
            data-function-name={fn.n ?? undefined}
            data-testid={`formula-hint-${fn.n ?? 'unknown'}`}
            style={{
              top: '0px',
              left: '0px',
              borderWidth: '1px',
              borderColor: fn?.BRAND_SECONDARY_COLOR
                ? fn?.BRAND_SECONDARY_COLOR
                : 'rgba(0, 0, 0, 0.2)',
              backgroundColor: `${fn.BRAND_COLOR ? fn.BRAND_COLOR : '#F8F9FA'}`,
              width: '340px',
              padding: '0px',
            }}
          >
            <div
              className="fortune-formula-hint__icon fortune-formula-help-close"
              title="关闭"
              data-testid="formula-hint-icon-close-legacy"
            >
              <i className="fa fa-times" aria-hidden="true" />
            </div>
            <div
              className="fortune-formula-hint__icon fortune-formula-help-collapse"
              title="收起"
              data-testid="formula-hint-icon-collapse"
            >
              <i className="fa fa-angle-up" aria-hidden="true" />
            </div>
            <div
              onClick={() => {
                if (!dragHasMoved.current) {
                  localStorage.setItem(
                    'formula-expand',
                    `${!showFunctionBody}`,
                  );
                  setShouldShowFunctionBody(!showFunctionBody);
                  setTimeout(() => {
                    measureFormulaHintPlacement();
                  }, 50);
                }
                dragHasMoved.current = false;
              }}
              className="fortune-formula-hint__heading flex !cursor-grab active:cursor-grabbing items-start justify-between"
              id="luckysheet-formula-help-title"
              data-testid="formula-hint-heading"
              style={{
                backgroundColor: `${
                  fn.BRAND_COLOR ? fn.BRAND_COLOR : '#F8F9FA'
                }`,
                padding: '10px',
                borderRadius: '10px',
                cursor: 'grab',
                userSelect: 'none',
              }}
            >
              <div
                className="fortune-formula-hint__para flex-grow color-text-default"
                data-testid="formula-hint-para"
              >
                <code
                  style={{ fontWeight: 'bold' }}
                  className="luckysheet-arguments-help-function-name font-family-mono mb-1 mt-2 color-text-default font-family-mono"
                >
                  {fn.n}
                </code>
                <code
                  className="luckysheet-arguments-paren font-family-mono mb-1 mt-2 color-text-default"
                  style={{ fontWeight: 'bold' }}
                >
                  (
                </code>
                <code
                  className="luckysheet-arguments-parameter-holder font-family-mono mb-1 mt-2 color-text-default"
                  style={{ fontWeight: 'bold' }}
                >
                  {fn.p.map((param: any, i: number) => {
                    let { name } = param;
                    if (param.repeat === 'y') {
                      name += ', ...';
                    }
                    if (param.require === 'o') {
                      name = `[${name}]`;
                    }
                    return (
                      <>
                        <code
                          className="luckysheet-arguments-help-parameter font-family-mono mb-1 mt-2 color-text-default"
                          dir="auto"
                          key={name}
                          style={{
                            backgroundColor:
                              commaCount === i
                                ? bgColor(fn.BRAND_SECONDARY_COLOR)
                                : 'transparent',
                            fontWeight: 'bold',
                          }}
                        >
                          {name}
                        </code>
                        {i !== fn.p.length - 1 && ', '}
                      </>
                    );
                  })}
                </code>
                <code className="luckysheet-arguments-paren font-family-mono mb-1 mt-2 color-text-default">
                  )
                </code>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'end',
                  minWidth: '75px',
                  height: '20px',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                {fn.LOGO && (
                  <img
                    src={fn.LOGO}
                    alt="Service Logo"
                    style={{ width: '16px' }}
                  />
                )}
                {fn.SECONDARY_LOGO && (
                  <img
                    src={fn.SECONDARY_LOGO}
                    alt="Service Logo"
                    style={{ width: '16px' }}
                  />
                )}
                {fn.API_KEY && (
                  <div
                    style={{
                      borderRadius: '4px',
                      backgroundColor: `${isKeyAdded ? '#177E23' : '#e8ebec'}`,
                      width: '16px',
                      height: '16px',
                    }}
                    className="flex justify-center"
                  >
                    <LucideIcon
                      name="Key"
                      style={{
                        color: isKeyAdded ? 'white' : '#77818A',
                        width: '12px',
                        height: '12px',
                      }}
                    />
                  </div>
                )}
                <div>
                  <LucideIcon
                    name={showFunctionBody ? 'ChevronUp' : 'ChevronDown'}
                    width={16}
                    height={16}
                  />
                </div>
              </div>
            </div>
            {showFunctionBody && (
              <div
                className="luckysheet-formula-help-content"
                id="function-details"
                style={{
                  backgroundColor: `${
                    fn.BRAND_COLOR ? fn.BRAND_COLOR : '#F8F9FA'
                  }`,
                  maxHeight: '284px',
                  overflowY: 'scroll',
                  cursor: 'auto',
                }}
              >
                {fn.API_KEY && (
                  <div
                    className="luckysheet-formula-help-content-api"
                    style={{
                      borderLeft: `4px solid ${
                        isKeyAdded ? '#177E23' : '#e8ebec'
                      }`,
                      backgroundColor: 'white',
                      padding: '8px',
                      paddingBottom: '2px',
                      margin: '4px 4px 0px 4px',
                      borderRadius: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowAPInput(!showAPInput)}
                      data-testid="formula-hint-info-api"
                    >
                      <h3
                        style={{
                          margin: '0 0 8px 0',
                        }}
                        className="fortune-formula-hint__heading-sm text-heading-xsm color-text-default"
                        data-testid="formula-hint-info-heading"
                      >
                        {isKeyAdded
                          ? 'API key provided'
                          : 'API key (optional)'}
                      </h3>
                      <LucideIcon
                        name={showAPInput ? 'ChevronUp' : 'ChevronDown'}
                        width={24}
                        height={24}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    {showAPInput && (
                      <div
                        className="fortune-formula-hint__info-content"
                        data-testid="formula-hint-info-content"
                      >
                        <p
                          style={{
                            margin: '0 0 16px 0',
                          }}
                          className="fortune-formula-hint__para fortune-formula-hint__para--api text-body-sm color-text-default"
                          data-testid="formula-hint-para-api"
                        >
                          {`Some providers need an API key for higher limits. You can
                  paste one below or leave the field empty and press 'Ok' to continue without a key.`}
                        </p>
                        <div className="w-full">
                          <TextField
                            // @ts-ignore
                            value={API_KEY}
                            id="function-api-key"
                            type="text"
                            placeholder={apiKeyPlaceholder[fn.API_KEY]}
                            onChange={(e) => {
                              setAPI_KEY(e.target.value);
                              setApiKeyAdded(false);
                            }}
                          />
                          <div className="flex justify-end mt-2 mb-2">
                            <Button
                              onClick={() => {
                                // @ts-ignore
                                localStorage.setItem(fn.API_KEY, API_KEY);
                                setApiKeyAdded(Boolean(API_KEY));
                                setShowAPInput(false);
                              }}
                              className="fortune-formula-hint__cta min-w-[80px]"
                              data-testid="formula-hint-cta-ok"
                            >
                              Ok
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  id="luckysheet-formula-help-content-example"
                  style={{
                    backgroundColor: 'white',
                    padding: '6px',
                    margin: '4px 4px 0px 4px',
                    borderRadius: '4px',
                    marginTop: '-1px',
                  }}
                >
                  <div className="">
                    <div
                      style={{
                        lineHeight: '16px',
                        fontSize: '12px',
                        fontFamily: 'Helvetica Neue',
                      }}
                      className="font-family-mono mb-1 color-text-secondary"
                    >
                      {formulaMore.helpExample}
                    </div>
                    <div>
                      <code
                        style={{
                          overflowWrap: 'break-word',
                          fontWeight: 'bold',
                        }}
                        className="example-value-code"
                      >
                        <span className="luckysheet-arguments-help-function-name">
                          ={fn.n}
                        </span>
                        <span className="luckysheet-arguments-paren">(</span>
                        <span className="luckysheet-arguments-parameter-holder">
                          {fn.p.map((param: any, i: number) => (
                            <span
                              key={param.name}
                              className="luckysheet-arguments-help-parameter"
                              dir="auto"
                              style={{
                                color:
                                  param.type === 'string' ? '#177E23' : 'black',
                              }}
                            >
                              {param.example}
                              <span style={{ color: 'black' }}>
                                {i !== fn.p.length - 1 && ', '}
                              </span>
                            </span>
                          ))}
                        </span>
                        <span className="luckysheet-arguments-paren">)</span>
                      </code>
                    </div>
                  </div>
                  <div
                    className="luckysheet-formula-help-content-detail"
                    style={{ paddingBottom: '16px' }}
                  >
                    <div className="">
                      <div
                        style={{
                          lineHeight: '16px',
                          fontSize: '12px',
                          padding: '0px',
                          fontFamily: 'Helvetica Neue',
                        }}
                        className="font-family-mono mb-1 mt-2 color-text-secondary"
                      >
                        About
                      </div>
                      <span className="luckysheet-arguments-help-parameter-content text-helper-text-sm">
                        {fn.d}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{ paddingTop: '16px' }}
                    className="luckysheet-formula-help-content-param"
                  >
                    {fn.p.map((param: any, index: number) => (
                      <div className="" key={param.name}>
                        <div>
                          <code
                            className="font-family-mono mb-1 mt-2 color-text-default font-family-mono"
                            style={{
                              fontWeight: 600,
                              backgroundColor:
                                commaCount === index
                                  ? bgColor(fn.BRAND_SECONDARY_COLOR)
                                  : 'transparent',
                            }}
                          >
                            {param.name}
                            {param.repeat === 'y' && (
                              <span
                                className="luckysheet-arguments-help-argument-info example-value"
                                style={{ marginTop: '2px' }}
                              >
                                ...-{formulaMore.allowRepeatText}
                              </span>
                            )}
                            {param.require === 'o' && (
                              <span
                                className="luckysheet-arguments-help-argument-info example-value"
                                style={{ marginTop: '2px' }}
                              >
                                -[{formulaMore.allowOptionText}]
                              </span>
                            )}
                          </code>
                        </div>
                        <span
                          className="luckysheet-arguments-help-parameter-content text-helper-text-sm"
                          style={{ marginTop: '2px' }}
                        >
                          {param.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {showFunctionBody && (
              <div
                style={{
                  backgroundColor: `${
                    fn.BRAND_COLOR ? fn.BRAND_COLOR : '#F8F9FA'
                  }`,
                  padding: '8px',
                  borderBottomLeftRadius: '10px',
                  borderBottomRightRadius: '10px',
                }}
                className="w-full flex items-center gap-4"
              >
                <div
                  onClick={() => {
                    document.getElementById('function-button')?.click();
                  }}
                  className="color-text-link cursor-pointer text-helper-text-sm"
                >
                  Learn More
                </div>
                {(fn.n.includes('SMARTCONTRACT') ||
                  fn.n.includes('smartcontract')) && (
                  <div
                    className="flex justify-center items-center gap-1 color-text-link cursor-pointer text-helper-text-sm ml-2"
                    onClick={() => {
                      document.getElementById('smartcontract-button')?.click();
                    }}
                  >
                    <div className="">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-circle-question-mark-icon lucide-circle-question-mark"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                      </svg>
                    </div>
                    <span className="font-normal text-xs text-[#5c0aff]">
                      How to use imported contract?
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </DraggableDiv>
  );
};

export default FormulaHint;
