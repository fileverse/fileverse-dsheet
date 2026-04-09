import React from 'react';
import Dialog from '../Dialog';

type Props = {
  type: 'ok' | 'yesno';
  onOk?: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
};

const MessageBox: React.FC<Props> = ({
  type = 'yesno',
  onOk,
  onCancel,
  children,
}) => {
  return (
    <Dialog
      type={type}
      onOk={onOk}
      onCancel={onCancel}
      title={type === 'yesno' ? 'Confirmation' : undefined}
    >
      {children}
    </Dialog>
  );
};

export default MessageBox;
