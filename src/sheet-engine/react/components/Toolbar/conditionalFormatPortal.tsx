// DataVerificationPortal.tsx
import React from "react";
import { createPortal } from "react-dom";
import ConditionRules from "../ConditionFormat/ConditionRules";

const ConditionalFormatPortal = ({
  visible,
  context,
}: {
  visible: boolean;
  context: any;
}) => {
  const container = document.getElementById("placeholder-conditional-format");

  if (!visible || !container) return null;

  return createPortal(<ConditionRules context={context} />, container);
};

export default ConditionalFormatPortal;
