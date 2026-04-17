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
  removeHyperlinkForLink,
  updateHyperlinkForLink,
  getHyperlinkDisplayTextInCell,
  getFlowdata,
  goToLink,
  isLinkValid,
  jfrefreshgrid,
  normalizeSelection,
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

function normalizeInlineTextForEditor(text?: string): string {
  return (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function getSelectionOffsetsForInlineLink(
  cell: any,
  target: { linkType: string; linkAddress: string },
  occurrenceIndex = 0,
): { start: number; end: number } | undefined {
  if (cell?.ct?.t !== 'inlineStr' || !Array.isArray(cell.ct.s)) return undefined;
  let cursor = 0;
  const ranges: Array<{ start: number; end: number }> = [];
  let openStart: number | undefined;
  for (const seg of cell.ct.s as Array<{ v?: string; link?: { linkType?: string; linkAddress?: string } }>) {
    const text = normalizeInlineTextForEditor(seg?.v);
    const len = text.length;
    const isMatch =
      seg?.link?.linkType === target.linkType &&
      seg?.link?.linkAddress === target.linkAddress;
    if (isMatch) {
      if (openStart == null) openStart = cursor;
    } else {
      if (openStart != null) {
        ranges.push({ start: openStart, end: cursor });
        openStart = undefined;
      }
    }
    cursor += len;
  }
  if (openStart != null) {
    ranges.push({ start: openStart, end: cursor });
  }
  if (ranges.length === 0) return undefined;
  const idx = Math.max(0, Math.min(occurrenceIndex, ranges.length - 1));
  const picked = ranges[idx];
  if (picked.end <= picked.start) return undefined;
  return picked;
}

function getFallbackCellText(cell: any): string {
  if (
    cell?.ct?.t === 'inlineStr' &&
    Array.isArray((cell as { ct?: { s?: Array<{ v?: string }> } }).ct?.s)
  ) {
    return ((cell as { ct?: { s?: Array<{ v?: string }> } }).ct?.s || [])
      .map((s) => s?.v ?? '')
      .join('')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }
  if (cell?.v == null || Array.isArray(cell?.v)) return '';
  return `${cell.v}`;
}

function getTextByOffsets(
  text: string,
  offsets?: { start: number; end: number },
): string {
  if (!offsets) return '';
  const start = Math.max(0, Math.min(text.length, offsets.start));
  const end = Math.max(start, Math.min(text.length, offsets.end));
  return text.slice(start, end);
}

function emailFromAddress(address: string): string {
  return String(address ?? '').trim().replace(/^mailto:/i, '');
}

function isEmailLikeAddress(address: string): boolean {
  const email = emailFromAddress(address);
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getViewLabel(linkType: string, linkAddress: string, fallbackText: string): string {
  if (linkType === 'webpage' && isEmailLikeAddress(linkAddress)) {
    return `Send to: ${emailFromAddress(linkAddress)}`;
  }
  return linkAddress.trim() || fallbackText;
}

type LinkPreviewData = {
  title: string;
  urlText: string;
  faviconUrl?: string;
  imageUrl?: string;
  description?: string;
};

function toPreviewableUrl(address: string): string | null {
  const raw = String(address ?? '').trim();
  if (!raw) return null;
  if (/^mailto:/i.test(raw)) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function fallbackPreview(address: string): LinkPreviewData {
  const typedUrl = String(address ?? '').trim();
  const previewable = toPreviewableUrl(address);
  if (!previewable) {
    const email = emailFromAddress(address);
    return {
      title: `Send to: ${email}`,
      urlText: '',
    };
  }
  try {
    const u = new URL(previewable);
    return {
      title: typedUrl || u.hostname,
      urlText: typedUrl || u.hostname + u.pathname.replace(/\/$/, ''),
      faviconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
        u.hostname,
      )}&sz=64`,
    };
  } catch {
    return {
      title: typedUrl || getViewLabel('webpage', address, address),
      urlText: typedUrl || address,
    };
  }
}

async function fetchLinkPreview(address: string): Promise<LinkPreviewData> {
  const previewable = toPreviewableUrl(address);
  if (!previewable) {
    return fallbackPreview(address);
  }
  const fallback = fallbackPreview(address);
  try {
    const typedUrl = String(address ?? '').trim();
    const resp = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(previewable)}&palette=false&screenshot=false`,
    );
    let body: { status?: string; data?: Record<string, unknown> };
    try {
      body = await resp.json();
    } catch {
      return fallback;
    }
    // Microlink often returns HTTP 200 with { status: "fail", code: "ERATE", ... } when rate-limited.
    if (!resp.ok || body?.status !== 'success') {
      return fallback;
    }
    const data = body?.data ?? {};
    const logo = data.logo as { url?: string } | undefined;
    const image = data.image as { url?: string } | undefined;
    const pageTitle = String(data.title || '').trim();
    const publisher = String(data.publisher || '').trim();
    return {
      // Microlink: title ≈ og:title, publisher ≈ og:site_name. GitHub image URLs are often long
      // opengraph.githubassets.com/.../hash/owner/repo paths (normal for their OG previews).
      title: pageTitle || publisher || typedUrl || fallback.title,
      urlText: typedUrl || fallback.urlText,
      faviconUrl: String(logo?.url || fallback.faviconUrl || ''),
      imageUrl: String(image?.url || ''),
      description: String(data.description || '').trim(),
    };
  } catch {
    return fallback;
  }
}

export const LinkEditCard: React.FC<LinkCardProps> = ({
  r,
  c,
  rc,
  originText,
  originType,
  originAddress,
  links,
  editingLinkIndex,
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
  const [previewByKey, setPreviewByKey] = useState<Record<string, LinkPreviewData>>(
    {},
  );
  const { insertLink, linkTypeList } = locale(context);
  const isLinkAddressValid = isLinkValid(context, linkType, linkAddress);

  const linksToShow = useMemo(() => {
    if (links && links.length > 0) return links;
    if (originAddress)
      return [{ linkType: originType, linkAddress: originAddress }];
    return [];
  }, [links, originAddress, originType]);

  const isButtonDisabled = useMemo(() => {
    // if (!linkText.trim()) return true;
    if (linkType === 'webpage') {
      return !linkAddress.trim() || !isLinkAddressValid.isValid;
    }
    if (linkType === 'sheet') {
      return !linkAddress.trim();
    }
    return false;
  }, [linkText, linkAddress, linkType, isLinkAddressValid.isValid]);

  const getPreviewKey = useCallback(
    (lt: string, la: string) => `${lt}::${String(la ?? '').trim().toLowerCase()}`,
    [],
  );

  useEffect(() => {
    if (isEditing) return;
    let cancelled = false;
    const targets = linksToShow.filter(
      (l) => l.linkType === 'webpage' && !isEmailLikeAddress(l.linkAddress),
    );
    if (targets.length === 0) return;
    targets.forEach((item) => {
      const key = getPreviewKey(item.linkType, item.linkAddress);
      if (previewByKey[key]) return;
      fetchLinkPreview(item.linkAddress).then((meta) => {
        if (cancelled) return;
        setPreviewByKey((prev) => {
          if (prev[key]) return prev;
          return { ...prev, [key]: meta };
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isEditing, linksToShow, getPreviewKey, previewByKey]);

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
      const list = draftCtx.linkCard?.links;
      const idx = draftCtx.linkCard?.editingLinkIndex;
      const cell = getFlowdata(draftCtx)?.[r]?.[c];
      const isInline =
        cell?.ct?.t === 'inlineStr' && Array.isArray((cell as { ct?: { s?: unknown[] } }).ct?.s);
      if (list && list.length > 0 && isInline) {
        const targetIdx =
          typeof idx === 'number' && idx >= 0 && idx < list.length ? idx : 0;
        const resolvedLinkText = linkText.trim() || linkAddress;
        updateHyperlinkForLink(
          draftCtx,
          r,
          c,
          list[targetIdx],
          resolvedLinkText,
          linkType,
          linkAddress,
        );
        draftCtx.luckysheetCellUpdate = [];
        jfrefreshgrid(draftCtx, null, undefined);
        return;
      }
      const wasInCellEdit =
        draftCtx.luckysheetCellUpdate?.length === 2 &&
        draftCtx.luckysheetCellUpdate[0] === r &&
        draftCtx.luckysheetCellUpdate[1] === c;
      saveHyperlink(draftCtx, r, c, linkText, linkType, linkAddress, {
        applyToSelection: applyToSelection || undefined,
        cellInput: wasInCellEdit ? refs.cellInput.current ?? undefined : undefined,
        applySelectionFromModel: !!(applyToSelection && !wasInCellEdit),
      });
      if (!applyToSelection) {
        draftCtx.luckysheetCellUpdate = [];
        jfrefreshgrid(draftCtx, null, undefined);
      } else if (!wasInCellEdit) {
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
    (iconId: string, onClick: () => void, testIdSuffix = '') => {
      const iconIdClass = iconId
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-+/g, '-');
      return (
        <div
          className={`fortune-link-card__icon fortune-link-card__action fortune-link-card__action--${iconIdClass} fortune-toolbar-button`}
          data-icon-id={iconId}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          tabIndex={0}
          data-testid={`link-card-action-${iconId}${testIdSuffix}`}
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
  }, [rc, originAddress, originText, originType, editingLinkIndex]);

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
  useLayoutEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    // Double rAF: TextFields mount after layout; URL field should always take focus for insert.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        if (linkType === 'webpage') {
          const urlEl = linkAddressRef.current;
          if (urlEl) {
            urlEl.focus({ preventScroll: true });
            const len = urlEl.value?.length ?? 0;
            urlEl.setSelectionRange(len, len);
            return;
          }
        }
        const sheetTrigger = cardRef.current?.querySelector(
          '.fortune-sheet-select',
        ) as HTMLElement | null;
        if (sheetTrigger) {
          sheetTrigger.focus({ preventScroll: true });
          return;
        }
        linkTextRef.current?.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isEditing, rc, linkType]);

  useEffect(() => {
    if (!isEditing) return undefined;
    const openedAt = Date.now();

    const isInsideLinkDropdownPortal = (target: Node | null) => {
      if (!(target instanceof Element)) return false;
      return !!target.closest(
        '.fortune-link-type-dropdown, .fortune-sheet-dropdown, [data-radix-popper-content-wrapper]',
      );
    };

    const onPointerOutside = (e: MouseEvent | TouchEvent) => {
      // Ignore the click that opened the modal (e.g. toolbar hyperlink button),
      // otherwise it is treated as an outside click and closes immediately.
      if (Date.now() - openedAt < 120) return;
      const card = cardRef.current;
      const target = e.target as Node | null;
      if (!card || !target) return;
      if (card.contains(target)) return;
      if (isInsideLinkDropdownPortal(target)) return;
      hideLinkCard();
    };

    // Use bubble-phase click/touchend so sheet/input lifecycle (focus/selection/update)
    // finishes first; capture mousedown here could prematurely clear editor state.
    document.addEventListener('click', onPointerOutside);
    document.addEventListener('touchend', onPointerOutside);
    return () => {
      document.removeEventListener('click', onPointerOutside);
      document.removeEventListener('touchend', onPointerOutside);
    };
  }, [hideLinkCard, isEditing]);

  if (!isEditing) {
    const multi = linksToShow.length > 1;
    const singleLink = multi
      ? undefined
      : {
        linkType,
        linkAddress: originAddress || linkAddress,
      };
    const singleMeta = singleLink
      ? previewByKey[getPreviewKey(singleLink.linkType, singleLink.linkAddress)] ||
      fallbackPreview(singleLink.linkAddress)
      : undefined;

    return (
      <div
        ref={cardRef}
        {...containerEvent}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        className="fortune-link-card fortune-link-modify-modal link-toolbar"
        style={{ left: position.cellLeft + 20, top: position.cellBottom - 5 }}
        data-testid="link-card"
      >
        {multi ? (
          <div className="fortune-link-card__multi-list">
            {linksToShow.map((item, idx) => (
              <div
                key={`${item.linkType}-${item.linkAddress}-${idx}`}
                className="fortune-link-card__multi-row"
              >
                <div
                  className="fortune-link-card__info link-content fortune-link-card__multi-info fortune-link-card__link-truncate"
                  onClick={() => {
                    setContext((draftCtx) =>
                      goToLink(
                        draftCtx,
                        r,
                        c,
                        item.linkType,
                        item.linkAddress,
                        refs.scrollbarX.current!,
                        refs.scrollbarY.current!,
                      ),
                    );
                  }}
                  tabIndex={0}
                  data-testid={`link-card-info-open-${idx}`}
                >
                  {(() => {
                    const meta =
                      previewByKey[getPreviewKey(item.linkType, item.linkAddress)] ||
                      fallbackPreview(item.linkAddress);
                    const emailLike = isEmailLikeAddress(item.linkAddress);
                    const isSheetLink = item.linkType === 'sheet';
                    return (
                      <div
                        className={`fortune-link-card__preview-line${
                          emailLike
                            ? ' fortune-link-card__preview-line--email'
                            : isSheetLink
                              ? ' fortune-link-card__preview-line--sheet'
                              : ''
                        }`}
                      >
                        {isSheetLink ? (
                          <LucideIcon
                            name="Grid2x2"
                            className="fortune-link-card__favicon-fallback fortune-link-card__favicon-fallback--sheet"
                          />
                        ) : emailLike ? (
                          <LucideIcon
                            name="Mail"
                            className="fortune-link-card__favicon-fallback"
                          />
                        ) : meta.faviconUrl ? (
                          <img
                            src={meta.faviconUrl}
                            alt=""
                            className="fortune-link-card__favicon"
                          />
                        ) : (
                          <LucideIcon
                            name="Globe"
                            className="fortune-link-card__favicon-fallback"
                          />
                        )}
                        <div className="fortune-link-card__preview-text">
                          <span className="fortune-link-card__link-label" title={meta.title}>
                            {meta.title}
                          </span>
                          {item.linkType === 'webpage' && meta.urlText && (
                            <span
                              className="fortune-link-card__url-label"
                              title={meta.urlText}
                            >
                              {meta.urlText}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="fortune-link-card__row-actions">
                  {(context.allowEdit === true ||
                    (context.isFlvReadOnly && item.linkType === 'webpage')) &&
                    item.linkType === 'webpage' &&
                    renderToolbarButton(
                      'copy',
                      () => {
                        navigator.clipboard.writeText(item.linkAddress);
                        hideLinkCard();
                      },
                      `-${idx}`,
                    )}
                  {context.allowEdit === true &&
                    !context.isFlvReadOnly &&
                    renderToolbarButton(
                      'pencil',
                      () =>
                        setContext((draftCtx) => {
                          if (draftCtx.linkCard == null || !draftCtx.allowEdit) return;
                          const cell = getFlowdata(draftCtx)?.[r]?.[c];
                          draftCtx.luckysheet_select_save = normalizeSelection(draftCtx, [
                            {
                              row: [r, r],
                              column: [c, c],
                              row_focus: r,
                              column_focus: c,
                            },
                          ]);
                          draftCtx.luckysheetCellUpdate = [r, c];
                          draftCtx.linkCard.isEditing = true;
                          draftCtx.linkCard.editingLinkIndex = idx;
                          draftCtx.linkCard.originType = item.linkType;
                          draftCtx.linkCard.originAddress = item.linkAddress;
                          const offsets = getSelectionOffsetsForInlineLink(
                            cell,
                            item,
                            idx,
                          );
                          const fullText = getFallbackCellText(cell);
                          const selectedText = getTextByOffsets(fullText, offsets);
                          const linkedText = getHyperlinkDisplayTextInCell(
                            cell ?? null,
                            item,
                          );
                          draftCtx.linkCard.originText =
                            selectedText || linkedText || '';
                          draftCtx.linkCard.applyToSelection = true;
                          draftCtx.linkCard.selectionOffsets = offsets;
                          draftCtx.linkCard.linkInsertOffset = offsets?.end;
                        }),
                      `-${idx}`,
                    )}
                  {context.allowEdit === true &&
                    !context.isFlvReadOnly &&
                    renderToolbarButton(
                      'unlink',
                      () =>
                        setContext((draftCtx) => {
                          _.set(refs.globalCache, 'linkCard.mouseEnter', false);
                          removeHyperlinkForLink(draftCtx, r, c, item);
                          jfrefreshgrid(draftCtx, null, undefined);
                        }),
                      `-${idx}`,
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fortune-link-card__single-layout">
            <div className="fortune-link-card__single-top-row">
              <div
                className="fortune-link-card__info link-content fortune-link-card__link-truncate"
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
                {(() => {
                  const address = originAddress || linkAddress;
                  const emailLike = isEmailLikeAddress(address);
                  const isSheetLink = linkType === 'sheet';
                  return (
                    <div
                      className={`fortune-link-card__preview-line${
                        emailLike
                          ? ' fortune-link-card__preview-line--email'
                          : isSheetLink
                            ? ' fortune-link-card__preview-line--sheet'
                            : ''
                      }`}
                    >
                      {isSheetLink ? (
                        <LucideIcon
                          name="Grid2x2"
                          className="fortune-link-card__favicon-fallback fortune-link-card__favicon-fallback--sheet"
                        />
                      ) : emailLike ? (
                        <LucideIcon
                          name="Mail"
                          className="fortune-link-card__favicon-fallback"
                        />
                      ) : singleMeta?.faviconUrl ? (
                        <img
                          src={singleMeta.faviconUrl}
                          alt=""
                          className="fortune-link-card__favicon"
                        />
                      ) : (
                        <LucideIcon
                          name="Globe"
                          className="fortune-link-card__favicon-fallback"
                        />
                      )}
                      <div className="fortune-link-card__preview-text">
                        <span
                          className="fortune-link-card__link-label"
                          title={singleMeta?.title || originAddress || linkAddress}
                        >
                          {singleMeta?.title ||
                            getViewLabel(linkType, originAddress || linkAddress, insertLink.openLink)}
                        </span>
                        {linkType === 'webpage' &&
                          (singleMeta?.urlText ||
                            (!emailLike && (originAddress || linkAddress))) && (
                          <span
                            className="fortune-link-card__url-label"
                            title={singleMeta?.urlText || originAddress || linkAddress}
                          >
                            {singleMeta?.urlText || (originAddress || linkAddress)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="fortune-link-card__row-actions">
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
                        const cell = getFlowdata(draftCtx)?.[r]?.[c];
                        draftCtx.luckysheet_select_save = normalizeSelection(draftCtx, [
                          {
                            row: [r, r],
                            column: [c, c],
                            row_focus: r,
                            column_focus: c,
                          },
                        ]);
                        draftCtx.luckysheetCellUpdate = [r, c];
                        draftCtx.linkCard.isEditing = true;
                        draftCtx.linkCard.editingLinkIndex = undefined;
                        draftCtx.linkCard.applyToSelection = true;
                        const offsets = getSelectionOffsetsForInlineLink(cell, {
                          linkType,
                          linkAddress,
                        }, 0);
                        const fullText = getFallbackCellText(cell);
                        const selectedText = getTextByOffsets(fullText, offsets);
                        draftCtx.linkCard.selectionOffsets = offsets;
                        draftCtx.linkCard.originText = selectedText || '';
                        draftCtx.linkCard.linkInsertOffset = offsets?.end;
                      }
                    }),
                  )}
                {context.allowEdit === true &&
                  !context.isFlvReadOnly &&
                  renderToolbarButton('unlink', () =>
                    setContext((draftCtx) => {
                      _.set(refs.globalCache, 'linkCard.mouseEnter', false);
                      removeHyperlink(draftCtx, r, c);
                      jfrefreshgrid(draftCtx, null, undefined);
                    }),
                  )}
              </div>
            </div>
            {singleMeta?.imageUrl ? (
              <div className="fortune-link-card__preview-image-wrap">
                <img
                  src={singleMeta.imageUrl}
                  alt=""
                  className="fortune-link-card__preview-image"
                />
              </div>
            ) : singleMeta?.description ? (
              <div className="fortune-link-card__preview-description">
                {singleMeta.description}
              </div>
            ) : null}
          </div>
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
        {true && <TextField
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
        />}
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
            className={`fortune-link-input ${!linkAddress || isLinkAddressValid.isValid ? '' : 'error-input'
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
        {links && links.length > 0 ? 'Save link' : 'Insert link'}
      </Button>
    </div>
  );
};

export default LinkEditCard;
