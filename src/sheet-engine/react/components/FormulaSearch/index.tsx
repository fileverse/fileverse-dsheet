import _ from 'lodash';
import React, {
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { LucideIcon, Tooltip } from '@fileverse/ui';
import { UNFilter } from './constant';
import WorkbookContext from '../../context';
import './index.css';

const FormulaSearch: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { from?: string }
> = ({ from, ...divProps }) => {
  const {
    context,
    settings: { isAuthorized },
  } = useContext(WorkbookContext);
  const authedFunction = [
    'COINGECKO',
    'ETHERSCAN',
    'DEFILLAMA',
    'GNOSIS',
    'BASE',
    'EOA',
    'PNL',
    'SAFE',
    'BLOCKSCOUT',
    'LENS',
    'FARCASTER',
    'Ethereum',
    'SMARTCONTRACT',
    'DUNESIM',
  ];
  const filteredDefaultCandidates = context.defaultCandidates.filter(
    (item) => !authedFunction.includes(item.n),
  );
  const unfilteredDefaultCandidates = UNFilter.filter(
    (item) => item.n !== 'PNL',
  );
  const finalDefaultCandidates = !isAuthorized
    ? filteredDefaultCandidates
    : context.defaultCandidates.slice(0, 10);

  const finalFunctionCandidates = isAuthorized
    ? context.functionCandidates
    : context.functionCandidates.filter((item) => item.t !== 20);

  const firstSelection = context.luckysheet_select_save?.[0];
  const cellHeightPx =
    firstSelection?.height_move != null
      ? Number(firstSelection.height_move)
      : 24;
  /** Default below cell; 0 covered the active cell until layout ran. */
  const belowCellTop = cellHeightPx + 4;

  const hintRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(belowCellTop);

  const applyPlacement = useCallback(() => {
    if (firstSelection?.top == null || firstSelection.height_move == null) {
      setTop(belowCellTop);
      return;
    }

    const fromFx = from === 'fx';
    const cellH = Number(firstSelection.height_move) || cellHeightPx;

    if (fromFx) {
      setTop(25);
      return;
    }

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
    from,
  ]);

  useLayoutEffect(() => {
    applyPlacement();
    const id = requestAnimationFrame(applyPlacement);
    return () => {
      cancelAnimationFrame(id);
    };
  }, [
    applyPlacement,
    context.defaultCandidates?.length,
    context.functionCandidates?.length,
    context.functionHint,
  ]);

  if (
    _.isEmpty(context.functionCandidates) &&
    _.isEmpty(context.defaultCandidates)
  )
    return null;

  return (
    <div
      className={`flex color-border-default border flex-col luckysheet-formula-search-c-p custom-scroll ${
        from === 'fx' ? 'fx-search' : 'cell-search'
      }`}
      id="luckysheet-formula-search-c-p"
      style={{
        top,
      }}
    >
      <div
        {...divProps}
        ref={hintRef}
        id="luckysheet-formula-search-c"
        className="luckysheet-formula-search-c"
      >
        {context.defaultCandidates.length > 0 && (
          <>
            <div
              style={{ marginBottom: '4px' }}
              className="w-full flex flex-col p-2 gap-1"
            >
              <h4 className="text-helper-sm-bold color-text-secondary">
                Onchain functions
              </h4>
              <p className="text-helper-text-sm color-text-secondary">
                Every onchain function is a native data structure allowing
                dSheets to read and structure data from smart contracts and
                APIs.
              </p>
            </div>
            {!isAuthorized && (
              <div
                style={{ marginBottom: '8px', backgroundColor: '#F8F9FA' }}
                className="w-full flex flex-col p-2 gap-1"
              >
                <h4 className="font-semibold">dSheets account required</h4>
                <p className="text-helper-text-sm color-text-secondary">
                  Use more onchain functions by creating a dSheets account.{' '}
                  <span
                    className="sign-fortune"
                    style={{ color: '#5C0AFF', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      document.getElementById('triggerAuth')?.click();
                    }}
                  >
                    Signup/Login
                  </span>
                </p>
                <div className="flex gap-2 mt-2 mb-2">
                  {unfilteredDefaultCandidates.map((v, index) => {
                    return (
                      <img
                        key={index}
                        src={v.LOGO}
                        alt="Service Logo"
                        style={{ width: '16px', height: '16px' }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {context.defaultCandidates.length > 0 ? (
          <>
            {finalDefaultCandidates.map((v, index) => {
              return (
                <div
                  key={v.n}
                  data-func={v.n}
                  style={{
                    cursor: 'pointer',
                  }}
                  className={`luckysheet-formula-search-item ${
                    index === 0 ? 'luckysheet-formula-search-item-active' : ''
                  }`}
                >
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <div className="luckysheet-formula-search-func color-text-default text-body-sm">
                      {v.n}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'end',
                        minWidth: '68px',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {v.LOGO && (
                        <img
                          src={v.LOGO}
                          alt="Service Logo"
                          style={{ width: '16px' }}
                        />
                      )}
                      {v.SECONDARY_LOGO && (
                        <img
                          src={v.SECONDARY_LOGO}
                          alt="Service Logo"
                          style={{ width: '16px' }}
                        />
                      )}
                      {v.API_KEY && (
                        <Tooltip
                          text={
                            localStorage.getItem(v.API_KEY)
                              ? 'API Key added'
                              : 'API key required'
                          }
                        >
                          <div
                            style={{
                              borderRadius: '4px',
                              backgroundColor: `${
                                localStorage.getItem(v.API_KEY)
                                  ? '#177E23'
                                  : '#e8ebec'
                              }`,
                              width: '16px',
                              height: '16px',
                            }}
                            className="flex justify-center"
                          >
                            <LucideIcon
                              name="Key"
                              style={{
                                color: localStorage.getItem(v.API_KEY)
                                  ? 'white'
                                  : '#77818A',
                                width: '12px',
                                height: '12px',
                              }}
                            />
                          </div>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  <div className="luckysheet-formula-search-detail mt-1 text-helper-text-sm  color-text-default">
                    {v.d}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            {finalFunctionCandidates.length > 0 &&
              finalFunctionCandidates.map((v, index) => {
                return (
                  <div
                    key={v.n}
                    data-func={v.n}
                    className={`luckysheet-formula-search-item ${
                      index === 0 ? 'luckysheet-formula-search-item-active' : ''
                    }`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div className="luckysheet-formula-search-func color-text-default text-body-sm">
                        {v.n}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'end',
                          width: '68px',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {v.LOGO && (
                          <img
                            src={v.LOGO}
                            alt="Service Logo"
                            style={{ width: '16px' }}
                          />
                        )}
                        {v.SECONDARY_LOGO && (
                          <img
                            src={v.SECONDARY_LOGO}
                            alt="Service Logo"
                            style={{ width: '16px' }}
                          />
                        )}
                        {v.API_KEY && (
                          <Tooltip
                            text={
                              localStorage.getItem(v.API_KEY)
                                ? 'API Key added'
                                : 'API Key required'
                            }
                          >
                            <div
                              style={{
                                borderRadius: '4px',
                                backgroundColor: `${
                                  localStorage.getItem(v.API_KEY)
                                    ? '#177E23'
                                    : '#e8ebec'
                                }`,
                                width: '16px',
                                height: '16px',
                              }}
                              className="flex justify-center"
                            >
                              <LucideIcon
                                name="Key"
                                style={{
                                  color: localStorage.getItem(v.API_KEY)
                                    ? 'white'
                                    : '#77818A',
                                  width: '12px',
                                  height: '12px',
                                }}
                              />
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="luckysheet-formula-search-detail mt-1 text-helper-text-sm color-text-secondary">
                      {v.d}
                    </div>
                  </div>
                );
              })}
            {finalFunctionCandidates.length === 0 && (
              <span>
                {!isAuthorized && (
                  <div
                    style={{ marginBottom: '8px', backgroundColor: '#F8F9FA' }}
                    className="w-full flex flex-col p-2 gap-1"
                  >
                    <h4
                      className="text-helper-sm-bold"
                      style={{ fontWeight: 'bold' }}
                    >
                      dSheets account required
                    </h4>
                    <p className="text-helper-text-sm color-text-secondary">
                      Use more onchain functions by creating a dSheets account.{' '}
                      <span
                        className="sign-fortune"
                        style={{ color: '#5C0AFF', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          document.getElementById('triggerAuth')?.click();
                        }}
                      >
                        Signup/Login
                      </span>
                    </p>
                    <div className="flex gap-2 mt-2 mb-2">
                      {unfilteredDefaultCandidates.map((v, index) => {
                        return (
                          <img
                            key={index}
                            src={v.LOGO}
                            alt="Service Logo"
                            style={{ width: '16px', height: '16px' }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </span>
            )}
          </>
        )}
      </div>
      <div className="p-2 pt-0">
        <hr className="color-border-default mb-2" />
        <div
          style={{ paddingLeft: '10px', paddingRight: '10px' }}
          className="flex gap-1 items-center color-border-default text-helper-sm"
        >
          <div className="border p-1 color-text-default rounded">Tab</div>
          <p className="color-text-secondary">to insert</p>
        </div>
      </div>
    </div>
  );
};

export default FormulaSearch;
