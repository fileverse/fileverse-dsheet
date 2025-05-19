import { useEffect } from 'react';

export const useFortuneDocumentStyle = (
  exportDropdownOpen: boolean,
  isTemplateOpen: boolean | undefined,
) => {
  useEffect(() => {
    const timerRef = setTimeout(() => {
      const templateButton =
        document.getElementsByClassName('template-button')[0];
      if (templateButton && isTemplateOpen) {
        (templateButton as HTMLElement).style.backgroundColor = '#FFDE0A';
      } else if (templateButton && !isTemplateOpen) {
        (templateButton as HTMLElement).style.backgroundColor = 'white';
      }
    }, 300);
    const exportButton = document.getElementsByClassName('export-button')[0];
    if (exportButton && exportDropdownOpen) {
      (exportButton as HTMLElement).style.backgroundColor = '#FFDE0A';
    } else if (exportButton) {
      (exportButton as HTMLElement).style.backgroundColor = 'white';
    }

    return () => {
      clearTimeout(timerRef);
    };
  }, [exportDropdownOpen, isTemplateOpen]);

  useEffect(() => {
    document.querySelectorAll('*').forEach(function (el) {
      const element = el as HTMLElement;
      element.style.userSelect = 'text';
    });

  }, [])
};
