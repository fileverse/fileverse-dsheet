import { useEffect } from 'react';

export const useFortuneDocumentStyle = ({
  exportDropdownOpen = false,
  isTemplateOpen = false,
  isReadOnly = false,
  loading = false,
}: {
  exportDropdownOpen: boolean;
  isTemplateOpen: boolean | undefined;
  isReadOnly: boolean | undefined;
  loading: boolean;
}) => {
  // this effect is used to change the background color of the template and export buttons
  useEffect(() => {
    //return
    const updateTemplateButtonBackgroundColor = () => {
      const templateButton = document.getElementsByClassName(
        'template-button',
      )[0] as HTMLElement | null;
      if (templateButton) {
        templateButton.style.backgroundColor = isTemplateOpen ? '#FFDE0A' : '';
      }
    };

    const updateExportButtonBackgroundColor = () => {
      const exportButton = document.getElementsByClassName(
        'export-button',
      )[0] as HTMLElement | null;
      if (exportButton) {
        exportButton.style.backgroundColor = exportDropdownOpen
          ? '#FFDE0A'
          : '';
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
    if (isReadOnly && loading) {
      // Select all elements with the class "luckysheet-sheets-item-name"
      const targetElements = document.querySelectorAll(
        '.luckysheet-sheets-item-name',
      );

      // Create a MutationObserver callback function
      const observerCallback = (mutationsList: MutationRecord[]) => {
        for (const mutation of mutationsList) {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'contenteditable'
          ) {
            const element = mutation.target as HTMLElement;

            // Read-only: prevent contenteditable from being set to true
            if (element.contentEditable === 'true') {
              element.contentEditable = 'false';
            }
          }
        }
      };

      // Create a MutationObserver instance
      const observer = new MutationObserver(observerCallback);

      // Set up the observer to watch for changes to contenteditable
      targetElements.forEach((element) => {
        observer.observe(element, {
          attributes: true, // Watch for changes to attributes
          attributeOldValue: true, // Track the old value of attributes
        });
      });
    }
  }, [isReadOnly, loading]);

  useEffect(() => {
    const styleId = 'readonly-pointer-events-style';
    let styleTag = document.getElementById(styleId);

    if (isReadOnly) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.innerHTML = `
          #luckysheet-modal-dialog-activeImage,
          .luckysheet-modal-dialog-iframe,
          .luckysheet-modal-dialog-image,
          #fortune-iframe-boxes {
            pointer-events: none !important;
          }
        `;
        document.head.appendChild(styleTag);
      }
    } else {
      if (styleTag) {
        styleTag.remove();
      }
    }
  }, [isReadOnly]);
};
