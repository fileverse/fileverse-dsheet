import { Sheet } from '@fileverse-dev/fortune-core';

/**
 * Compare two spreadsheets' cell data and images, checking if anything changed
 * @param {Array} oldSheets - Original sheets data
 * @param {Array} newSheets - New sheets data
 * @returns {boolean} - true if any cell data or images changed, false if identical
 */
export function isSpreadsheetChanged(oldSheets: Sheet[], newSheets: Sheet[]) {
  if (!oldSheets || !newSheets || oldSheets.length !== newSheets.length) {
    return true;
  }

  if (oldSheets.length > 0) {
    for (let i = 0; i < oldSheets.length; i++) {
      const oldSheet = oldSheets[i];
      const newSheet = newSheets[i];

      // Check if sheet name has changed
      if (oldSheet.name !== newSheet.name) {
        return true;
      }

      if (JSON.stringify(oldSheet.config) !== JSON.stringify(newSheet.config)) {
        return true;
      }

      // Check if data verification settings have changed
      if (
        JSON.stringify(oldSheet.dataVerification) !==
        JSON.stringify(newSheet.dataVerification)
      ) {
        return true;
      }

      // Check celldata changes
      const oldCellData = oldSheet?.celldata || [];
      const newCellData = newSheet?.celldata || [];

      const oldCellMap = new Map();
      const newCellMap = new Map();

      // Only store cells with non-null values
      for (const cell of oldCellData) {
        if (cell && cell.v !== null) {
          const key = `${cell.r},${cell.c}`;
          oldCellMap.set(key, cell.v);
        }
      }

      for (const cell of newCellData) {
        if (cell.v !== null) {
          const key = `${cell.r},${cell.c}`;
          newCellMap.set(key, cell.v);
        }
      }

      // Different number of non-null cells means change
      if (oldCellMap.size !== newCellMap.size) {
        return true;
      }

      // Check each non-null cell specifically
      for (const [key, value] of oldCellMap.entries()) {
        if (!newCellMap.has(key)) {
          return true;
        }

        const newValue = newCellMap.get(key);

        // If both values are objects, we need to do deep comparison
        if (
          typeof value === 'object' &&
          value !== null &&
          typeof newValue === 'object' &&
          newValue !== null
        ) {
          for (const prop in value) {
            if (value[prop] !== newValue[prop]) {
              return true;
            }
          }

          for (const prop in newValue) {
            if (value[prop] !== newValue[prop]) {
              return true;
            }
          }
        }
        // Simple value comparison for non-objects
        else if (value !== newValue) {
          return true;
        }
      }

      // Check image changes
      const oldImages = oldSheet?.images || [];
      const newImages = newSheet?.images || [];

      // Different number of images means change
      if (oldImages.length !== newImages.length) {
        return true;
      }

      // Create maps for efficient image comparison
      const oldImageMap = new Map();
      const newImageMap = new Map();

      // Map images by their position or unique identifier
      // Assuming images have some identifying property like id, src, or position
      for (const image of oldImages) {
        // You can adjust this key generation based on your image object structure
        // For example, if images have id: use image.id
        // If they have position: use `${image.x},${image.y}` or similar
        // @ts-ignore
        const key = image.id || `${image.x || 0},${image.y || 0}` || JSON.stringify(image);
        oldImageMap.set(key, image);
      }

      for (const image of newImages) {
        // @ts-ignore
        const key = image.id || `${image.x || 0},${image.y || 0}` || JSON.stringify(image);
        newImageMap.set(key, image);
      }

      // Check each image for changes
      for (const [key, oldImage] of oldImageMap.entries()) {
        if (!newImageMap.has(key)) {
          return true; // Image was removed
        }

        const newImage = newImageMap.get(key);

        // Compare each property of the image objects
        const oldImageProps = Object.keys(oldImage);
        const newImageProps = Object.keys(newImage);

        // Check if number of properties changed
        if (oldImageProps.length !== newImageProps.length) {
          return true;
        }

        // Compare each property
        for (const prop of oldImageProps) {
          if (!newImage.hasOwnProperty(prop)) {
            return true; // Property was removed
          }

          const oldValue = oldImage[prop];
          const newValue = newImage[prop];

          // Deep comparison for nested objects
          if (
            typeof oldValue === 'object' &&
            oldValue !== null &&
            typeof newValue === 'object' &&
            newValue !== null
          ) {
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
              return true;
            }
          }
          // Simple value comparison
          else if (oldValue !== newValue) {
            return true;
          }
        }

        // Check for new properties in newImage
        for (const prop of newImageProps) {
          if (!oldImage.hasOwnProperty(prop)) {
            return true; // New property was added
          }
        }
      }

      // Check for new images that weren't in oldImages
      for (const key of newImageMap.keys()) {
        if (!oldImageMap.has(key)) {
          return true; // New image was added
        }
      }

      // Check iframe changes
      const oldIframes = oldSheet?.iframes || [];
      const newIframes = newSheet?.iframes || [];

      // Different number of iframes means change
      if (oldIframes.length !== newIframes.length) {
        return true;
      }

      // Create maps for efficient iframe comparison
      const oldIframeMap = new Map();
      const newIframeMap = new Map();

      // Map iframes by their position or unique identifier
      for (const iframe of oldIframes) {
        // Use iframe id or position as key
        const key =
          iframe.id ||
          `${iframe.left || 0},${iframe.top || 0}` ||
          JSON.stringify(iframe);
        oldIframeMap.set(key, iframe);
      }

      for (const iframe of newIframes) {
        const key =
          iframe.id ||
          `${iframe.left || 0},${iframe.top || 0}` ||
          JSON.stringify(iframe);
        newIframeMap.set(key, iframe);
      }

      // Check each iframe for changes
      for (const [key, oldIframe] of oldIframeMap.entries()) {
        if (!newIframeMap.has(key)) {
          return true; // Iframe was removed
        }

        const newIframe = newIframeMap.get(key);

        // Compare each property of the iframe objects
        const oldIframeProps = Object.keys(oldIframe);
        const newIframeProps = Object.keys(newIframe);

        // Check if number of properties changed
        if (oldIframeProps.length !== newIframeProps.length) {
          return true;
        }

        // Compare each property
        for (const prop of oldIframeProps) {
          if (!Object.prototype.hasOwnProperty.call(newIframe, prop)) {
            return true; // Property was removed
          }

          const oldValue = oldIframe[prop];
          const newValue = newIframe[prop];

          // Deep comparison for nested objects
          if (
            typeof oldValue === 'object' &&
            oldValue !== null &&
            typeof newValue === 'object' &&
            newValue !== null
          ) {
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
              return true;
            }
          }
          // Simple value comparison
          else if (oldValue !== newValue) {
            return true;
          }
        }

        // Check for new properties in newIframe
        for (const prop of newIframeProps) {
          if (!Object.prototype.hasOwnProperty.call(oldIframe, prop)) {
            return true; // New property was added
          }
        }
      }

      // Check for new iframes that weren't in oldIframes
      for (const key of newIframeMap.keys()) {
        if (!oldIframeMap.has(key)) {
          return true; // New iframe was added
        }
      }

      // check for freeze changes
      const oldSheetFreezeString = JSON.stringify(oldSheet?.frozen || {});
      const newSheetFreezeString = JSON.stringify(newSheet?.frozen || {});
      if (oldSheetFreezeString !== newSheetFreezeString) {
        return true;
      }
    }
  }

  return false;
}
