import React, {
  useContext,
  useState,
  useMemo,
  useCallback,
  useLayoutEffect,
  useRef,
  useEffect,
} from 'react';
import {
  locale,
  saveHyperlink,
  LinkCardProps,
  removeHyperlink,
  replaceHtml,
  goToLink,
  isLinkValid,
  jfrefreshgrid,
} from '@sheet-engine/core';
import {
  Button,
  TextField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  LucideIcon,
} from '@fileverse/ui';
import './index.css';
import _ from 'lodash';
import WorkbookContext from '../../context';
import SVGIcon from '../SVGIcon';

export const LinkEditCard: React.FC<LinkCardProps> = ({
  r,
  c,
  rc,
  originText,
  originType,
  originAddress,
  isEditing,
  position,
  applyToSelection,
}) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const cardRef = useRef<HTMLDivElement>(null);
  const linkAddressRef = useRef<HTMLInputElement>(null);
  const linkTextRef = useRef<HTMLInputElement>(null);
  const [cardTop, setCardTop] = useState<number>(position.cellBottom);
  const [linkText, setLinkText] = useState<string>(originText);
  const [linkAddress, setLinkAddress] = useState<string>(originAddress);
  const [linkType, setLinkType] = useState<string>(originType);
  const { insertLink, linkTypeList } = locale(context);
  const isLinkAddressValid = isLinkValid(context, linkType, linkAddress);

  const isButtonDisabled = useMemo(() => {
    if (!linkText.trim()) return true;
    if (linkType === 'webpage') {
      return !linkAddress.trim() || !isLinkAddressValid.isValid;
    }
    if (linkType === 'sheet') {
      return !linkAddress.trim();
    }
    return false;
  }, [linkText, linkAddress, linkType, isLinkAddressValid.isValid]);

  const hideLinkCard = useCallback(() => {
    _.set(refs.globalCache, 'linkCard.mouseEnter', false);
    setContext((draftCtx) => {
      draftCtx.linkCard = undefined;
    });
  }, [refs.globalCache, setContext]);

  const handleInsertLink = useCallback(() => {
    if (isButtonDisabled) return;
    _.set(refs.globalCache, 'linkCard.mouseEnter', false);
    setContext((draftCtx) => {
      saveHyperlink(draftCtx, r, c, linkText, linkType, linkAddress, {
        applyToSelection: applyToSelection || undefined,
        cellInput: refs.cellInput.current,
      });
      if (!applyToSelection) {
        draftCtx.luckysheetCellUpdate = [];
        jfrefreshgrid(draftCtx, null, undefined);
      }
    });
  }, [
    isButtonDisabled,
    refs.globalCache,
    refs.cellInput,
    setContext,
    r,
    c,
    linkText,
    linkType,
    linkAddress,
    applyToSelection,
  ]);

  const containerEvent = useMemo(
    () => ({
      onMouseEnter: () => _.set(refs.globalCache, 'linkCard.mouseEnter', true),
      onMouseLeave: () => _.set(refs.globalCache, 'linkCard.mouseEnter', false),
      onMouseDown: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        e.stopPropagation(),
      onMouseMove: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        e.stopPropagation(),
      onMouseUp: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        e.stopPropagation(),
      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          handleInsertLink();
        }
      },
      onDoubleClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        e.stopPropagation(),
    }),
    [handleInsertLink],
  );

  const renderToolbarButton = useCallback(
    (iconId: string, onClick: () => void) => {
      const iconIdClass = iconId
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-+/g, '-');
      return (
        <div
          className={`fortune-link-card__icon fortune-link-card__action fortune-link-card__action--${iconIdClass} fortune-toolbar-button`}
          data-icon-id={iconId}
          onClick={onClick}
          tabIndex={0}
          data-testid={`link-card-action-${iconId}`}
        >
          <SVGIcon name={iconId} style={{ width: 16, height: 16 }} />
        </div>
      );
    },
    [],
  );

  useLayoutEffect(() => {
    setLinkAddress(originAddress);
    setLinkText(originText);
    setLinkType(originType);
  }, [rc, originAddress, originText, originType]);

  // Position card above or below drag handle depending on viewport
  useEffect(() => {
    const dragHandle = document.querySelector(
      '.luckysheet-cs-draghandle-top.luckysheet-cs-draghandle',
    ) as HTMLElement;
    const card = cardRef.current;
    if (!dragHandle || !card) {
      setCardTop(position.cellBottom + 8);
      return;
    }
    const dragRect = dragHandle.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // place below, but if not enough space, place it above
    const spaceBelow = viewportHeight - dragRect.bottom;
    const spaceAbove = dragRect.top;
    let newTop;
    if (
      spaceBelow < cardRect.height + 16 &&
      spaceAbove > cardRect.height + 16
    ) {
      // Place above
      const cellTop = position.cellBottom - 30;
      newTop = cellTop - cardRect.height - 8;
    } else {
      // Place below
      newTop = position.cellBottom + 8;
    }
    setCardTop(newTop);
  }, [position.cellBottom, isEditing]);
  useEffect(() => {
    // for some reasons input auto focus affects the the card position, so we use refs to handle auto focus
    if (linkAddressRef.current && !linkAddress && isEditing) {
      linkAddressRef.current?.focus({ preventScroll: true });
    }
    if (linkTextRef.current && !linkText && isEditing) {
      linkTextRef.current?.focus({ preventScroll: true });
    }
  }, [linkAddressRef, isEditing, linkTextRef]);
  if (!isEditing) {
    return (
      <div
        {...containerEvent}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        className="fortune-link-card fortune-link-modify-modal link-toolbar"
        style={{ left: position.cellLeft + 20, top: position.cellBottom - 5 }}
        data-testid="link-card"
      >
        <div
          className="fortune-link-card__info link-content"
          onClick={() => {
            setContext((draftCtx) =>
              goToLink(
                draftCtx,
                r,
                c,
                linkType,
                linkAddress,
                refs.scrollbarX.current!,
                refs.scrollbarY.current!,
              ),
            );
          }}
          tabIndex={0}
          data-testid="link-card-info-open"
        >
          {linkType === 'webpage'
            ? insertLink.openLink
            : replaceHtml(insertLink.goTo, { linkAddress })}
        </div>
        {(context.allowEdit === true ||
          (context.isFlvReadOnly && linkType === 'webpage')) && (
          <div className="divider" />
        )}
        {(context.allowEdit === true || context.isFlvReadOnly) &&
          linkType === 'webpage' &&
          renderToolbarButton('copy', () => {
            navigator.clipboard.writeText(originAddress);
            hideLinkCard();
          })}
        {context.allowEdit === true &&
          !context.isFlvReadOnly &&
          renderToolbarButton('pencil', () =>
            setContext((draftCtx) => {
              if (draftCtx.linkCard != null && draftCtx.allowEdit) {
                draftCtx.linkCard.isEditing = true;
              }
            }),
          )}
        {context.allowEdit === true && !context.isFlvReadOnly && (
          <div className="divider" />
        )}
        {context.allowEdit === true &&
          !context.isFlvReadOnly &&
          renderToolbarButton('unlink', () =>
            setContext((draftCtx) => {
              _.set(refs.globalCache, 'linkCard.mouseEnter', false);
              removeHyperlink(draftCtx, r, c);
            }),
          )}
      </div>
    );
  }
  return (
    <div
      className="fortune-link-card fortune-link-card--editing"
      ref={cardRef}
      style={{
        left: position.cellLeft + 20,
        top: cardTop,
      }}
      {...containerEvent}
      data-testid="link-card-editing"
    >
      <Select
        value={linkType}
        onValueChange={(value) => {
          if (value === 'sheet') {
            if (!linkText) {
              setLinkText(context.luckysheetfile[0].name);
            }
            setLinkAddress(context.luckysheetfile[0].name);
          } else {
            setLinkAddress('');
          }
          setLinkType(value);
        }}
      >
        <SelectTrigger className="fortune-link-type-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="fortune-link-type-dropdown">
          {linkTypeList
            .filter((type: { text: string; value: string }) => type.value !== 'cellrange')
            .map((type: { text: string; value: string }) => (
              <SelectItem key={type.value} value={type.value}>
                {type.text}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <div
        className="fortune-link-card__para fortune-input-with-icon"
        data-testid="link-card-para-text"
      >
        <div className="fortune-link-card__icon input-icon">
          <LucideIcon name="ALargeSmall" />
        </div>
        <TextField
          ref={linkTextRef}
          placeholder="Display text"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleInsertLink();
            }
          }}
          className="fortune-link-input"
        />
      </div>

      {linkType === 'webpage' && (
        <div className="fortune-input-with-icon">
          <div className="input-icon">
            <SVGIcon name="link" width={16} height={16} />
          </div>
          <TextField
            ref={linkAddressRef}
            placeholder="Paste URL"
            value={linkAddress}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleInsertLink();
              }
            }}
            onChange={(e) => setLinkAddress(e.target.value)}
            className={`fortune-link-input ${
              !linkAddress || isLinkAddressValid.isValid ? '' : 'error-input'
            }`}
          />
        </div>
      )}

      {linkType === 'sheet' && (
        <div className="fortune-input-with-icon">
          <div className="input-icon">
            <SVGIcon name="link" width={16} height={16} />
          </div>
          <Select
            onValueChange={(value) => {
              if (!linkText) setLinkText(value);
              setLinkAddress(value);
            }}
            value={linkAddress}
          >
            <SelectTrigger className="fortune-sheet-select">
              <SelectValue placeholder="[Sheet name]" />
            </SelectTrigger>
            <SelectContent className="fortune-sheet-dropdown">
              {context.luckysheetfile.map((sheet) => (
                <SelectItem key={sheet.id} value={sheet.name}>
                  {sheet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        className="fortune-link-card__cta fortune-insert-button"
        disabled={isButtonDisabled}
        onClick={handleInsertLink}
        data-testid="link-card-cta-insert"
      >
        Insert link
      </Button>
    </div>
  );
};

export default LinkEditCard;
