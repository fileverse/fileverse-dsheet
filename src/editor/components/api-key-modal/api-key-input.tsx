import { Button, TextField } from '@fileverse/ui';
import { useState } from 'react';

export const ApiKeyInput = ({
  name,
  onSave,
  onCancel,
}: {
  name: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) => {
  const [localStorageValue, setLocalStorageValue] = useState<string>('');
  const keyName = name;
  return (
    <div className="py-4 px-6">
      <p className="text-heading-xlg-bold">Insert API key</p>
      <p className="mt-3 mb-1 text-heading-xsm">API key</p>
      <TextField
        value={localStorageValue}
        onChange={(e) => setLocalStorageValue(e.target.value)}
        placeholder={`Paste ${keyName} API key`}
      />

      <div className="flex justify-between mt-6 items-center">
        <div>
          <p className="text-body-sm-bold">Send feedback</p>
        </div>

        <div className="flex gap-3 items-center">
          <p onClick={onCancel} className="text-body-sm-bold cursor-pointer">
            Cancel
          </p>

          <Button
            onClick={() => onSave(localStorageValue)}
            className="!min-w-[96px]"
            disabled={!localStorageValue}
          >
            Insert key
          </Button>
        </div>
      </div>
    </div>
  );
};
