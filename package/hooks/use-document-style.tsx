import { useEffect } from 'react';

export const useFortuneDocumentStyle = (
  {
    exportDropdownOpen = false,
    isTemplateOpen = false,
  }:
    {
      exportDropdownOpen: boolean,
      isTemplateOpen: boolean | undefined,
    }
) => {
  // this effect is used to change the background color of the template and export buttons
  useEffect(() => {
    //return
    const updateTemplateButtonBackgroundColor = () => {
      const templateButton =
        document.getElementsByClassName('template-button')[0] as HTMLElement | null;
      if (templateButton) {
        templateButton.style.backgroundColor = isTemplateOpen ? '#FFDE0A' : '';
      }
    };

    const updateExportButtonBackgroundColor = () => {
      const exportButton = document.getElementsByClassName('export-button')[0] as HTMLElement | null;
      if (exportButton) {
        exportButton.style.backgroundColor = exportDropdownOpen ? '#FFDE0A' : '';
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

};
