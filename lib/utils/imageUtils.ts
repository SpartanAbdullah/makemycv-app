/**
 * Resizes and crops an image file to a square using the browser
 * Canvas API. Returns a base64 JPEG data URL.
 * Max output size: 200x200px at 0.85 quality.
 * No external dependencies required.
 */
export async function resizeAndCropToSquare(
  file: File,
  outputSize = 200,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        // Crop to largest square. Bias the vertical anchor toward the top of
        // the source image so headshots keep the head in frame (typical photo
        // has the face in the upper third). Horizontally still center-cropped.
        const srcSize = Math.min(img.width, img.height);
        const srcX = (img.width - srcSize) / 2;
        const verticalSlack = img.height - srcSize;
        const srcY = Math.min(verticalSlack / 2, img.height * 0.08);

        ctx.drawImage(
          img,
          srcX,
          srcY, // source x, y
          srcSize,
          srcSize, // source width, height (square)
          0,
          0, // dest x, y
          outputSize,
          outputSize, // dest width, height
        );

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };

      img.onerror = () => reject(new Error("Image load failed"));
      img.src = dataUrl;
    };

    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Validates that a file is an acceptable image type and size.
 * Returns null if valid, or an error string if invalid.
 */
export function validateImageFile(file: File): string | null {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return "Please upload a JPG, PNG, or WebP image.";
  }
  const maxSizeMB = 5;
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `Image must be smaller than ${maxSizeMB}MB.`;
  }
  return null;
}
