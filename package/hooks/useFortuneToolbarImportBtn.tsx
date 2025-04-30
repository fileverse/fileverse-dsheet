import { useEffect, ChangeEventHandler } from 'react';
import { createRoot } from 'react-dom/client';
import { CustomButton } from '../components/ImportButton';

export const useFortuneToolbarImportBtn = (
    { handleCSVUpload,
        handleXLSXUpload,
        handleExportToXLSX,
        handleExportToCSV,
        handleExportToJSON }
        : {
            handleCSVUpload: ChangeEventHandler<HTMLInputElement>,
            handleXLSXUpload: ChangeEventHandler<HTMLInputElement>,
            handleExportToXLSX: Function,
            handleExportToCSV: Function,
            handleExportToJSON: Function
        }) => {
    useEffect(() => {
        let root: any = null;

        const injectReactButton = () => {
            const toolbar = document.querySelector('.fortune-toolbar');

            if (toolbar && !document.querySelector('.fortune-toolbar-custom-btn-container')) {
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'fortune-toolbar-custom-btn-container';
                toolbar.insertBefore(buttonContainer, toolbar.firstChild);

                // Create root and render component
                root = createRoot(buttonContainer);
                root.render(<CustomButton handleCSVUpload={handleCSVUpload} handleXLSXUpload={handleXLSXUpload} handleExportToXLSX={handleExportToXLSX}
                    handleExportToCSV={handleExportToCSV} handleExportToJSON={handleExportToJSON} />);

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
                subtree: true
            });

            // Clean up observer on component unmount
            return () => observer.disconnect();
        }

        // Clean up function for the injected React component
        return () => {
            if (root) {
                root.unmount();
            }

            const buttonContainer = document.querySelector('.fortune-toolbar-custom-btn-container');
            if (buttonContainer) {
                if (buttonContainer.parentNode) {
                    buttonContainer.parentNode.removeChild(buttonContainer);
                }
            }
        };
    }, [handleCSVUpload]);
};