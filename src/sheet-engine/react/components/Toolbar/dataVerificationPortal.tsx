// DataVerificationPortal.tsx
import React from 'react';
import { createPortal } from 'react-dom';
import DataVerification from '../DataVerification';

const DataVerificationPortal = ({ visible }: { visible: boolean }) => {
  const container = document.getElementById('placeholder-data-verification');

  if (!visible || !container) return null;

  return createPortal(<DataVerification />, container);
};

export default DataVerificationPortal;
