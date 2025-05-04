import { useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import icon from '../assets/template-icon.svg';

export const useToggleTemplateBtn = ({
  toggleTemplateSidebar,
}: {
  toggleTemplateSidebar: (() => void) | undefined;
}) => {
  useEffect(() => {
    let root: Root | null = null;

    const injectReactButton = () => {
      const toolbar = document.querySelector('.fortune-toolbar');

      if (
        toolbar &&
        !document.querySelector('.fortune-toolbar-custom-btn-container')
      ) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'fortune-toolbar-custom-btn-container-t';
        toolbar.insertBefore(buttonContainer, toolbar.lastChild);

        // Create root and render component
        root = createRoot(buttonContainer);
        root.render(
          <div
            className="fortune-toolbar-custom-btn template-icon fortune-toolbar-button fortune-toolbar-item"
            onClick={toggleTemplateSidebar}
          >
            <img
              src={icon}
              alt="Icon"
              style={{ width: '20px', height: '20px' }}
            />
            <div className="fortune-tooltip">Templates</div>
          </div>,
        );

        return true;
      }

      return false;
    };

    // Try immediately injecting the button
    const injected = injectReactButton();

    if (!injected) {
      // If not successful, set up a MutationObserver to watch for changes
      const observer = new MutationObserver(() => {
        if (injectReactButton()) {
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Clean up observer on component unmount
      return () => observer.disconnect();
    }

    // Clean up function for the injected React component
    return () => {
      if (root) {
        root.unmount();
      }

      const buttonContainer = document.querySelector(
        '.fortune-toolbar-custom-btn-container',
      );
      if (buttonContainer) {
        if (buttonContainer.parentNode) {
          buttonContainer.parentNode.removeChild(buttonContainer);
        }
      }
    };
  }, []);
};
