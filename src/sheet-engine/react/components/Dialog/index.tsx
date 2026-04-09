import { locale } from '@sheet-engine/core';
import { Button, cn, IconButton } from '@fileverse/ui';
import React, { useContext } from 'react';
import WorkbookContext from '../../context';
import './index.css';

type Props = {
  type?: 'ok' | 'yesno';
  onOk?: () => void;
  onCancel?: () => void;
  containerStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  children?: React.ReactNode;
  title?: string | React.ReactNode;
  okLabel?: string;
  cancelLabel?: string;
};

const Dialog: React.FC<Props> = ({
  type,
  onOk,
  onCancel,
  children,
  containerStyle,
  contentStyle,
  title,
  okLabel,
  cancelLabel,
}) => {
  const { context } = useContext(WorkbookContext);
  const { button } = locale(context);
  return (
    <div
      className="fortune-dialog"
      data-testid="dialog"
      style={{
        ...containerStyle,
        ...([
          'Data validation',
          'Split text to columns',
          'Resize column',
        ].includes(title as string)
          ? { maxWidth: 'unset' }
          : {}),
      }}
    >
      <div
        className={cn(
          'fortune-dialog__header flex items-center justify-between border-b color-border-default py-3 px-6',
        )}
        data-testid="dialog-header"
      >
        {title ? (
          <div
            className="fortune-dialog__heading text-heading-sm"
            data-testid="dialog-heading"
          >
            {title}
          </div>
        ) : (
          <div
            className="fortune-dialog__heading text-heading-sm"
            data-testid="dialog-heading"
          >
            Oops! Something went wrong
          </div>
        )}
        <IconButton
          icon="X"
          variant="ghost"
          onClick={onCancel}
          tabIndex={0}
          className="fortune-dialog__icon fortune-dialog__icon--close"
          data-testid="dialog-icon-close"
        />
      </div>
      <div
        className="fortune-dialog__para px-6 pb-6 pt-4 text-body-sm"
        style={contentStyle}
        data-testid="dialog-para"
      >
        {children}
      </div>
      {type != null && (
        <div
          className="fortune-dialog__actions px-6 pb-6 flex flex-row gap-2 justify-end"
          data-testid="dialog-actions"
        >
          {type === 'ok' ? (
            <Button
              variant="default"
              className="fortune-dialog__cta fortune-dialog__cta--confirm"
              style={{
                minWidth: '80px',
              }}
              onClick={onOk}
              tabIndex={0}
              data-testid="dialog-cta-confirm"
            >
              {okLabel || button.confirm}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                className="fortune-dialog__cta fortune-dialog__cta--cancel"
                style={{
                  minWidth: '80px',
                }}
                onClick={onCancel}
                tabIndex={0}
                data-testid="dialog-cta-cancel"
              >
                {cancelLabel || button.cancel}
              </Button>
              <Button
                variant="default"
                className="fortune-dialog__cta fortune-dialog__cta--confirm"
                style={{
                  minWidth: '80px',
                }}
                onClick={onOk}
                tabIndex={0}
                data-testid="dialog-cta-confirm"
              >
                {okLabel || button.confirm}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Dialog;
