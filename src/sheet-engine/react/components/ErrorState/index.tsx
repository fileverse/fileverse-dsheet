import React, { useContext } from 'react';
import WorkbookContext from '../../context';

const ErrorBoxes: React.FC = () => {
  const { context } = useContext(WorkbookContext);

  const error = context.hoverErrorBox;
  if (!error) return null;
  const { left, top, title, message } = error;

  return (
    <div
      style={{
        borderLeft: `4px solid #FB3449`,
        width: 'auto',
        maxWidth: '280px',
        height: 'auto',
        left,
        top,
        position: 'absolute',
        padding: '8px',
        background: '#FFFFFF',
        zIndex: 100,
        borderRadius: '4px',
      }}
      className="fortune-error-state shadow-lg flex flex-col gap-2 break-all"
      data-testid="error-state"
    >
      <h3
        className="fortune-error-state__heading text-heading-xsm color-text-danger"
        data-testid="error-state-heading"
      >
        {title}
      </h3>
      <div
        className="fortune-error-state__para color-text-default text-body-sm"
        data-testid="error-state-para"
      >
        {message}
      </div>
    </div>
  );
};

export default ErrorBoxes;
