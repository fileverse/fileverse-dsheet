import { useEffect } from 'react';
import { Sheet } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

interface Template {
  data: Sheet[];
  [key: string]: unknown;
}

export function useTemplateManager(options: {
  selectedTemplate?: Template | null;
  updateData: (data: Sheet[]) => void;
  sheetEditorRef: React.RefObject<WorkbookInstance>;
}) {
  const { selectedTemplate, updateData, sheetEditorRef } = options;

  useEffect(() => {
    if (!selectedTemplate || !sheetEditorRef.current) return;

    try {
      // Apply the template
      const templateData = selectedTemplate.data;
      if (templateData && Array.isArray(templateData)) {
        updateData(templateData);
      }
    } catch (error) {
      console.error('Error applying template:', error);
    }
  }, [selectedTemplate, updateData, sheetEditorRef]);
}
