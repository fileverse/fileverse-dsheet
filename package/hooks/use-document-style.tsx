import { useEffect } from 'react';

export const useFortuneDocumentStyle = (
  {
    exportDropdownOpen = false,
    isTemplateOpen = false,
    isReadOnly = false,
  }:
    {
      exportDropdownOpen: boolean,
      isTemplateOpen: boolean | undefined,
      isReadOnly?: boolean
    }
) => {
  // this effect is used to change the background color of the template and export buttons
  useEffect(() => {
    const updateTemplateButtonBackgroundColor = () => {
      const templateButton =
        document.getElementsByClassName('template-button')[0] as HTMLElement | null;
      if (templateButton) {
        templateButton.style.backgroundColor = isTemplateOpen ? '#FFDE0A' : 'white';
      }
    };

    const updateExportButtonBackgroundColor = () => {
      const exportButton = document.getElementsByClassName('export-button')[0] as HTMLElement | null;
      if (exportButton) {
        exportButton.style.backgroundColor = exportDropdownOpen ? '#FFDE0A' : 'white';
      }
    };

    const timerRef = setInterval(() => {
      updateTemplateButtonBackgroundColor();
      updateExportButtonBackgroundColor();
    }, 300);

    return () => {
      clearInterval(timerRef);
    };
  }, [exportDropdownOpen, isTemplateOpen]);

  useEffect(() => {
    const toggleDisplay = (element: HTMLElement | null, shouldHide: boolean) => {
      if (element) {
        element.style.display = shouldHide ? 'none' : 'block';
      }
    };
    const updateDisplay = () => {
      const inputContainer = document.getElementById('luckysheet-rich-text-editor');
      const inputContainer2 = document.getElementsByClassName('luckysheet-input-box-inner')[0] as HTMLElement;

      toggleDisplay(inputContainer, isReadOnly);
      toggleDisplay(inputContainer2, isReadOnly);
    };

    const timerRef = setTimeout(updateDisplay, 500);

    return () => {
      clearTimeout(timerRef);
    };
  }, [isReadOnly]);
};
