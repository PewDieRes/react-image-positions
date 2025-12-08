import React, { useState, useRef } from "react";
import "./components/App.css";
import ImageAnnotation from "./components/ImageAnnotation";

export type ShapeType = "RECTANGLE" | "CIRCLE" | "TRAPEZOID";

export interface Position {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: ShapeType;
}

function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        setPositions([]); // Reset positions when new image is uploaded
      };
      reader.readAsDataURL(file);
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

    // Format coordinates in database format: array of points + shape
    const databaseFormat = positions.map((pos) => {
      let coordinates: Array<{ x: number; y: number }> = [];

      if (pos.shape === "RECTANGLE") {
        // For rectangle: all 4 corner points (top-left, top-right, bottom-right, bottom-left)
        coordinates = [
          { x: Math.round(pos.x), y: Math.round(pos.y) }, // Top-left
          { x: Math.round(pos.x + pos.width), y: Math.round(pos.y) }, // Top-right
          { x: Math.round(pos.x + pos.width), y: Math.round(pos.y + pos.height) }, // Bottom-right
          { x: Math.round(pos.x), y: Math.round(pos.y + pos.height) }, // Bottom-left
        ];
      } else if (pos.shape === "CIRCLE") {
        // For circle: center point and radius point
        const centerX = Math.round(pos.x + pos.width / 2);
        const centerY = Math.round(pos.y + pos.height / 2);
        const radius = Math.round(Math.max(pos.width, pos.height) / 2);
        coordinates = [
          { x: centerX, y: centerY },
          { x: centerX + radius, y: centerY },
        ];
      } else if (pos.shape === "TRAPEZOID") {
        // For trapezoid: 4 corner points (top-left, top-right, bottom-right, bottom-left)
        // Top edge is 80% of bottom edge width
        const topWidth = pos.width * 0.8;
        const topOffset = (pos.width - topWidth) / 2;
        coordinates = [
          { x: Math.round(pos.x + topOffset), y: Math.round(pos.y) }, // Top-left
          { x: Math.round(pos.x + topOffset + topWidth), y: Math.round(pos.y) }, // Top-right
          {
            x: Math.round(pos.x + pos.width),
            y: Math.round(pos.y + pos.height),
          }, // Bottom-right
          { x: Math.round(pos.x), y: Math.round(pos.y + pos.height) }, // Bottom-left
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
    console.log("Database Format (Coordinates | Shape):");
    databaseFormat.forEach((item, index) => {
      console.log(
        `${index + 1}. Coordinates: ${item.coordinates} | Shape: ${item.shape}`
      );
    });
    console.log("\nFull JSON:", formattedData);

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
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
                id="image-upload"
              />
              <label htmlFor="image-upload" className="upload-button">
                Upload Image
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
        />
      ) : (
        <div className="empty-state">
          <p>Upload an image to start selecting advertisement positions</p>
        </div>
      )}
    </div>
  );
}

export default App;
