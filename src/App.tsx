import React, { useState, useRef } from "react";
import "./components/App.css";
import ImageAnnotation from "./components/ImageAnnotation";
import * as pdfjsLib from "pdfjs-dist";

// Set the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export type ShapeType = "RECTANGLE" | "CIRCLE" | "TRAPEZOID";
export type ImageFormat = "PNG" | "JPEG";
export type CoordinateOrigin = "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "CENTER";

export interface Position {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: ShapeType;
  // Overlay image properties
  overlayImage?: string | null;
  overlayFileName?: string | null;
  showFileName?: boolean;
  fileNamePositionId?: string | null; // ID of position where filename will be displayed
}

function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [coordinateOrigin, setCoordinateOrigin] = useState<CoordinateOrigin>("TOP_LEFT");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertPdfToImage = async (file: File, format: ImageFormat): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    const page = await pdf.getPage(1); // Get first page

    // Get the original PDF page dimensions at scale 1
    const viewport = page.getViewport({ scale: 1 });
    
    // Use higher scale for better quality while maintaining aspect ratio
    const scale = 2; // 2x for better quality
    const scaledViewport = page.getViewport({ scale });

    // Create canvas with PDF dimensions
    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not get canvas context");
    }

    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    // Convert canvas to image data URL
    const mimeType = format === "PNG" ? "image/png" : "image/jpeg";
    const quality = format === "JPEG" ? 0.95 : undefined;
    const dataUrl = canvas.toDataURL(mimeType, quality);

    // Store original dimensions (before scale) for accurate position mapping
    setImageDimensions({
      width: viewport.width,
      height: viewport.height,
    });

    console.log(`PDF converted to ${format}`);
    console.log(`Original PDF dimensions: ${viewport.width} x ${viewport.height}`);
    console.log(`Canvas dimensions: ${canvas.width} x ${canvas.height}`);

    return dataUrl;
  };

  const handleFormatSelect = async (format: ImageFormat) => {
    if (!pendingPdfFile) return;

    setIsConverting(true);
    setShowFormatModal(false);

    try {
      const imageDataUrl = await convertPdfToImage(pendingPdfFile, format);
      setImageUrl(imageDataUrl);
      setPositions([]);
    } catch (error) {
      console.error("Error converting PDF:", error);
      alert("Failed to convert PDF. Please try again.");
    } finally {
      setIsConverting(false);
      setPendingPdfFile(null);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a PDF
    if (file.type === "application/pdf") {
      setPendingPdfFile(file);
      setShowFormatModal(true);
      return;
    }

    // Regular image upload
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setImageUrl(dataUrl);
        setPositions([]);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Transform coordinate based on selected origin
  const transformCoordinate = (x: number, y: number): { x: number; y: number } => {
    if (!imageDimensions) return { x, y };
    
    const { width: imgW, height: imgH } = imageDimensions;
    
    switch (coordinateOrigin) {
      case "TOP_LEFT":
        return { x, y };
      case "TOP_RIGHT":
        return { x: imgW - x, y };
      case "BOTTOM_LEFT":
        return { x, y: imgH - y };
      case "BOTTOM_RIGHT":
        return { x: imgW - x, y: imgH - y };
      case "CENTER":
        return { x: x - imgW / 2, y: y - imgH / 2 };
      default:
        return { x, y };
    }
  };

  const handlePositionsChange = (newPositions: Position[]) => {
    setPositions(newPositions);
  };

  const handleSavePositions = () => {
    if (positions.length === 0) {
      alert("No positions to save");
      return;
    }

    // Format coordinates in database format with selected origin transformation
    const databaseFormat = positions.map((pos) => {
      let coordinates: Array<{ x: number; y: number }> = [];

      if (pos.shape === "RECTANGLE") {
        // For rectangle: Top-left and Bottom-right (transformed)
        const tl = transformCoordinate(pos.x, pos.y);
        const br = transformCoordinate(pos.x + pos.width, pos.y + pos.height);
        coordinates = [
          { x: Math.round(tl.x), y: Math.round(tl.y) },
          { x: Math.round(br.x), y: Math.round(br.y) },
        ];
      } else if (pos.shape === "CIRCLE") {
        // For circle: center point (transformed) and radius
        const rawCenterX = pos.x + pos.width / 2;
        const rawCenterY = pos.y + pos.height / 2;
        const center = transformCoordinate(rawCenterX, rawCenterY);
        const radius = Math.round(Math.max(pos.width, pos.height) / 2);
        coordinates = [
          { x: Math.round(center.x), y: Math.round(center.y) },
          { x: radius, y: 0 }, // Radius as separate value
        ];
      } else if (pos.shape === "TRAPEZOID") {
        // For trapezoid: Top-left and Bottom-right (transformed)
        const topWidth = pos.width * 0.8;
        const topOffset = (pos.width - topWidth) / 2;
        const tl = transformCoordinate(pos.x + topOffset, pos.y);
        const br = transformCoordinate(pos.x + pos.width, pos.y + pos.height);
        coordinates = [
          { x: Math.round(tl.x), y: Math.round(tl.y) },
          { x: Math.round(br.x), y: Math.round(br.y) },
        ];
      }

      return {
        coordinates: JSON.stringify(coordinates),
        shape: pos.shape,
      };
    });

    // Create a formatted string to display
    const formattedData = JSON.stringify(databaseFormat, null, 2);

    // Display in console
    console.log("=== SAVE POSITIONS ===");
    console.log("Coordinate Origin:", coordinateOrigin);
    console.log("Image Dimensions:", imageDimensions);
    console.log("Database Format (Coordinates | Shape):");
    databaseFormat.forEach((item, index) => {
      console.log(
        `${index + 1}. Coordinates: ${item.coordinates} | Shape: ${item.shape}`
      );
    });
    console.log("\nFull JSON:", formattedData);
    console.log("======================");

    // Display in alert (formatted nicely)
    const alertMessage = `Database Format:\n\n${databaseFormat
      .map(
        (item, index) =>
          `Position ${index + 1}:\n  Coordinates: ${
            item.coordinates
          }\n  Shape: ${item.shape}`
      )
      .join("\n\n")}\n\n\n(Also check console for full details)`;

    alert(alertMessage);
  };

  const handleReset = () => {
    setImageUrl(null);
    setPositions([]);
    setImageDimensions(null);
    setPendingPdfFile(null);
    setShowFormatModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancelFormatModal = () => {
    setShowFormatModal(false);
    setPendingPdfFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>Advertisement Position Selector</h1>
        <div className="app-controls">
          {!imageUrl ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleImageUpload}
                style={{ display: "none" }}
                id="image-upload"
                disabled={isConverting}
              />
              <label htmlFor="image-upload" className={`upload-button ${isConverting ? 'disabled' : ''}`}>
                {isConverting ? "Converting PDF..." : "Upload Image/PDF"}
              </label>
            </>
          ) : (
            <>
              <button onClick={handleReset} className="reset-button">
                Upload New Image
              </button>
              <button
                onClick={handleSavePositions}
                className="save-button"
                disabled={positions.length === 0}
              >
                Save Positions ({positions.length})
              </button>
            </>
          )}
        </div>
      </div>

      {imageUrl ? (
        <ImageAnnotation
          imageUrl={imageUrl}
          positions={positions}
          onPositionsChange={handlePositionsChange}
          coordinateOrigin={coordinateOrigin}
          onCoordinateOriginChange={setCoordinateOrigin}
        />
      ) : (
        <div className="empty-state">
          <p>Upload an image or PDF to start selecting advertisement positions</p>
          {isConverting && <p className="converting-text">Converting PDF, please wait...</p>}
        </div>
      )}

      {/* Format Selection Modal for PDF */}
      {showFormatModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Select Output Format</h2>
            <p>Choose the image format for the PDF conversion:</p>
            <p className="modal-note">Dimensions will be preserved for accurate position mapping.</p>
            <div className="modal-buttons">
              <button
                className="format-button png-button"
                onClick={() => handleFormatSelect("PNG")}
              >
                PNG
                <span className="format-desc">Lossless, larger file</span>
              </button>
              <button
                className="format-button jpeg-button"
                onClick={() => handleFormatSelect("JPEG")}
              >
                JPEG
                <span className="format-desc">Compressed, smaller file</span>
              </button>
            </div>
            <button className="cancel-button" onClick={handleCancelFormatModal}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Show dimensions if available */}
      {imageDimensions && (
        <div className="dimensions-info">
          Original PDF Size: {Math.round(imageDimensions.width)} x {Math.round(imageDimensions.height)} px
        </div>
      )}
    </div>
  );
}

export default App;
