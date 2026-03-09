/**
 * PDF export utility for MakeMyCV.
 * Renders the CV preview DOM node to a PDF using
 * html2canvas + jsPDF, both loaded from CDN on demand.
 * No build-time dependencies added.
 */

declare global {
  interface Window {
    html2canvas: (
      element: HTMLElement,
      options?: Record<string, unknown>
    ) => Promise<HTMLCanvasElement>
    jspdf: { jsPDF: new (...args: unknown[]) => JsPDFInstance }
  }
}

interface JsPDFInstance {
  addImage(
    data: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void
  save(filename: string): void
  internal: { pageSize: { getWidth(): number; getHeight(): number } }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.id = id
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(script)
  })
}

async function ensureLibraries(): Promise<void> {
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    "mmcv-html2canvas"
  )
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "mmcv-jspdf"
  )
}

/**
 * Exports the CV preview element to a PDF file download.
 * @param elementId - The DOM id of the CV preview container.
 *                    Defaults to "cv-preview-root"
 * @param filename  - The output filename. Defaults to "my-cv.pdf"
 */
export async function exportCvToPdf(
  elementId = "cv-preview-root",
  filename = "my-cv.pdf"
): Promise<void> {
  // Load libraries on demand
  await ensureLibraries()

  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(
      `CV preview element not found. Expected id="${elementId}"`
    )
  }

  // Capture the element at 2x resolution for sharp PDF output
  const canvas = await window.html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const imgData = canvas.toDataURL("image/jpeg", 0.95)

  // A4 dimensions in mm
  const A4_WIDTH_MM = 210
  const A4_HEIGHT_MM = 297

  // Calculate how many A4 pages are needed
  const canvasWidthPx = canvas.width
  const canvasHeightPx = canvas.height
  const pxPerMm = canvasWidthPx / A4_WIDTH_MM
  const contentHeightMm = canvasHeightPx / pxPerMm

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = window.jspdf as any
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  }) as JsPDFInstance

  // If content fits in one A4 page
  if (contentHeightMm <= A4_HEIGHT_MM) {
    pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, contentHeightMm)
  } else {
    // Multi-page: slice canvas into A4-height segments
    const pageHeightPx = A4_HEIGHT_MM * pxPerMm
    let remainingHeightPx = canvasHeightPx
    let yOffsetPx = 0
    let isFirstPage = true

    while (remainingHeightPx > 0) {
      const sliceHeightPx = Math.min(pageHeightPx, remainingHeightPx)

      // Create a slice canvas for this page
      const sliceCanvas = document.createElement("canvas")
      sliceCanvas.width = canvasWidthPx
      sliceCanvas.height = sliceHeightPx
      const ctx = sliceCanvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(
          canvas,
          0, yOffsetPx, canvasWidthPx, sliceHeightPx,
          0, 0, canvasWidthPx, sliceHeightPx
        )
      }

      const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95)
      const sliceHeightMm = sliceHeightPx / pxPerMm

      if (!isFirstPage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(pdf as any).addPage()
      }

      pdf.addImage(sliceData, "JPEG", 0, 0, A4_WIDTH_MM, sliceHeightMm)

      yOffsetPx += sliceHeightPx
      remainingHeightPx -= sliceHeightPx
      isFirstPage = false
    }
  }

  pdf.save(filename)
}
