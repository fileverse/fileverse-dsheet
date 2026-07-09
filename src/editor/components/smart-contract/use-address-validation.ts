import { useState, useCallback } from 'react';
import { isAddress } from 'viem';

export const useAddressValidation = () => {
  const [isValidAddress, setIsValidAddress] = useState(false);

  const handleAddressChange = (address: string) => {
    const valid = isAddress(address);
    setIsValidAddress(valid);
    return valid;
  };

  const resetValidation = useCallback(() => {
    setIsValidAddress(false);
  }, []);

  return {
    isValidAddress,
    handleAddressChange,
    resetValidation,
  };
};
