import { Button, LucideIcon } from '@fileverse/ui';
import React from 'react';

interface ImportSectionProps {
  isImporting: boolean;
  handleImport: () => void;
}

export const ImportSection: React.FC<ImportSectionProps> = ({
  isImporting,
  handleImport,
}) => (
  <div className="mb-4 mx-3">
    <Button
      onClick={handleImport}
      size="md"
      className="w-full"
      disabled={isImporting}
    >
      {isImporting && (
        <LucideIcon
          name={'LoaderCircle'}
          className={'h-4 w-4 mr-3 animate-spin'}
        />
      )}
      Import Smart Contract
    </Button>
  </div>
);
