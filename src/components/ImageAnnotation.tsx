import React, { useState, useRef, useCallback, useEffect } from "react";
import { Position, ShapeType, CoordinateOrigin } from "../App";
import "./ImageAnnotation.css";

interface ImageAnnotationProps {
  imageUrl: string;
  positions: Position[];
  onPositionsChange: (positions: Position[]) => void;
  coordinateOrigin: CoordinateOrigin;
  onCoordinateOriginChange: (origin: CoordinateOrigin) => void;
}

const ImageAnnotation: React.FC<ImageAnnotationProps> = ({
  imageUrl,
  positions,
  onPositionsChange,
  coordinateOrigin,
  onCoordinateOriginChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentRect, setCurrentRect] = useState<Position | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<ShapeType>("RECTANGLE");
  const [isSelectingFileNamePosition, setIsSelectingFileNamePosition] =
    useState(false);
  const [pendingFileNameLinkId, setPendingFileNameLinkId] = useState<
    string | null
  >(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  // Get image dimensions when image loads
  useEffect(() => {
    const img = imageRef.current;
    if (img) {
      const handleLoad = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      if (img.complete) {
        handleLoad();
      } else {
        img.addEventListener("load", handleLoad);
        return () => img.removeEventListener("load", handleLoad);
      }
    }
  }, [imageUrl]);

  // Transform coordinates based on selected origin
  const transformCoordinate = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      if (!imageDimensions) return { x, y };

      const { width: imgW, height: imgH } = imageDimensions;

      switch (coordinateOrigin) {
        case "TOP_LEFT":
          return { x, y }; // Default - no transformation
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
    },
    [coordinateOrigin, imageDimensions]
  );

  // Get coordinates relative to the original image's TOP-LEFT corner
  // In this coordinate system: (0,0) is at TOP-LEFT of image
  // X increases to the RIGHT, Y increases DOWNWARD
  const getImageCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!containerRef.current || !imageRef.current) return null;

      // Get the actual image element's bounding rect (accounts for transforms)
      const imageRect = imageRef.current.getBoundingClientRect();

      // Calculate position relative to the image's top-left corner
      // This gives us coordinates where (0,0) is at the image's top-left
      const imageX = (clientX - imageRect.left) / scale;
      const imageY = (clientY - imageRect.top) / scale;

      // Log for debugging
      console.log(
        `Click at image coords: (${Math.round(imageX)}, ${Math.round(
          imageY
        )}) - Origin: TOP-LEFT`
      );

      return { x: imageX, y: imageY };
    },
    [scale]
  );

  // Handle mouse down for drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left mouse button

      const coords = getImageCoordinates(e.clientX, e.clientY);
      if (!coords) return;

      // Check if clicking on an existing position
      const clickedPosition = positions.find((pos) => {
        return (
          coords.x >= pos.x &&
          coords.x <= pos.x + pos.width &&
          coords.y >= pos.y &&
          coords.y <= pos.y + pos.height
        );
      });

      if (clickedPosition) {
        setSelectedPosition(clickedPosition.id);
        return;
      }

      // Start drawing new rectangle
      setIsDrawing(true);
      setDrawStart(coords);
      setSelectedPosition(null);
    },
    [getImageCoordinates, positions]
  );

  // Handle mouse move for drawing
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDrawing && drawStart) {
        const coords = getImageCoordinates(e.clientX, e.clientY);
        if (!coords) return;

        const x = Math.min(drawStart.x, coords.x);
        const y = Math.min(drawStart.y, coords.y);
        const width = Math.abs(coords.x - drawStart.x);
        const height = Math.abs(coords.y - drawStart.y);

        setCurrentRect({
          id: "temp",
          x,
          y,
          width,
          height,
          shape: selectedShape,
        });
      }
    },
    [isDrawing, drawStart, getImageCoordinates, selectedShape]
  );

  // Handle mouse up to finish drawing
  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentRect && drawStart) {
      // Only add if rectangle has meaningful size
      if (currentRect.width > 5 && currentRect.height > 5) {
        const newPosition: Position = {
          id: `pos-${Date.now()}-${Math.random()}`,
          x: currentRect.x,
          y: currentRect.y,
          width: currentRect.width,
          height: currentRect.height,
          shape: selectedShape,
        };

        // Log coordinates with transformation
        const x = currentRect.x;
        const y = currentRect.y;
        const w = currentRect.width;
        const h = currentRect.height;

        console.log("=== NEW SHAPE CREATED ===");
        console.log("Shape:", selectedShape);
        console.log("Coordinate Origin:", coordinateOrigin);

        if (selectedShape === "RECTANGLE") {
          // Raw corners (before transform)
          const rawCorners = [
            { x: x, y: y },
            { x: x + w, y: y },
            { x: x + w, y: y + h },
            { x: x, y: y + h },
          ];
          // Transformed corners
          const transformedCorners = rawCorners.map((c) => {
            const t = transformCoordinate(c.x, c.y);
            return { x: Math.round(t.x), y: Math.round(t.y) };
          });
          console.log("Top-left:", transformedCorners[0]);
          console.log("Top-right:", transformedCorners[1]);
          console.log("Bottom-right:", transformedCorners[2]);
          console.log("Bottom-left:", transformedCorners[3]);
          console.log("All 4 corners:", JSON.stringify(transformedCorners));
        } else if (selectedShape === "CIRCLE") {
          const rawCenter = { x: x + w / 2, y: y + h / 2 };
          const center = transformCoordinate(rawCenter.x, rawCenter.y);
          const radius = Math.round(Math.max(w, h) / 2);
          console.log("Center:", {
            x: Math.round(center.x),
            y: Math.round(center.y),
          });
          console.log("Radius:", radius);
        } else if (selectedShape === "TRAPEZOID") {
          const topWidth = w * 0.8;
          const topOffset = (w - topWidth) / 2;
          const rawCorners = [
            { x: x + topOffset, y: y },
            { x: x + topOffset + topWidth, y: y },
            { x: x + w, y: y + h },
            { x: x, y: y + h },
          ];
          const transformedCorners = rawCorners.map((c) => {
            const t = transformCoordinate(c.x, c.y);
            return { x: Math.round(t.x), y: Math.round(t.y) };
          });
          console.log("Top-left:", transformedCorners[0]);
          console.log("Top-right:", transformedCorners[1]);
          console.log("Bottom-right:", transformedCorners[2]);
          console.log("Bottom-left:", transformedCorners[3]);
          console.log("All 4 corners:", JSON.stringify(transformedCorners));
        }
        console.log("========================");

        onPositionsChange([...positions, newPosition]);
      }
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentRect(null);
    }
  }, [
    isDrawing,
    currentRect,
    drawStart,
    positions,
    onPositionsChange,
    selectedShape,
    coordinateOrigin,
    transformCoordinate,
  ]);

  // Handle panning
  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        // Middle mouse button or Ctrl + Left click
        e.preventDefault();
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      }
    },
    [panOffset]
  );

  const handlePanMove = useCallback(
    (e: React.MouseEvent) => {
      if (panStart) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [panStart]
  );

  const handlePanEnd = useCallback(() => {
    setPanStart(null);
  }, []);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.5, Math.min(5, prev * delta)));
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedPosition) {
          onPositionsChange(positions.filter((p) => p.id !== selectedPosition));
          setSelectedPosition(null);
        }
      }
      if (e.key === "Escape") {
        setIsSelectingFileNamePosition(false);
        setPendingFileNameLinkId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPosition, positions, onPositionsChange]);

  // Handle overlay image upload for selected position
  const handleOverlayUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPosition) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const updatedPositions = positions.map((pos) =>
        pos.id === selectedPosition
          ? {
              ...pos,
              overlayImage: reader.result as string,
              overlayFileName: file.name,
            }
          : pos
      );
      onPositionsChange(updatedPositions);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (overlayInputRef.current) {
      overlayInputRef.current.value = "";
    }
  };

  // Remove overlay from selected position
  const handleRemoveOverlay = () => {
    if (!selectedPosition) return;
    const updatedPositions = positions.map((pos) =>
      pos.id === selectedPosition
        ? {
            ...pos,
            overlayImage: null,
            overlayFileName: null,
          }
        : pos
    );
    onPositionsChange(updatedPositions);
  };

  // Toggle filename display for selected position
  const handleToggleFileName = () => {
    if (!selectedPosition) return;
    const position = positions.find((p) => p.id === selectedPosition);
    if (!position) return;

    if (position.showFileName) {
      // Turn off - also clear the linked position
      const updatedPositions = positions.map((pos) =>
        pos.id === selectedPosition
          ? { ...pos, showFileName: false, fileNamePositionId: null }
          : pos
      );
      onPositionsChange(updatedPositions);
    } else {
      // Turn on - enter selection mode
      setIsSelectingFileNamePosition(true);
      setPendingFileNameLinkId(selectedPosition);
    }
  };

  // Handle clicking on a position to link filename display
  const handlePositionClick = (positionId: string) => {
    if (isSelectingFileNamePosition && pendingFileNameLinkId) {
      // Link the filename to this position
      const updatedPositions = positions.map((pos) =>
        pos.id === pendingFileNameLinkId
          ? { ...pos, showFileName: true, fileNamePositionId: positionId }
          : pos
      );
      onPositionsChange(updatedPositions);
      setIsSelectingFileNamePosition(false);
      setPendingFileNameLinkId(null);
    } else {
      setSelectedPosition(positionId);
    }
  };

  // Get the selected position object
  const selectedPositionObj = positions.find((p) => p.id === selectedPosition);

  // Find positions that have filenames linked to them
  const getLinkedFileName = (positionId: string): string | null => {
    const linkingPosition = positions.find(
      (p) =>
        p.showFileName &&
        p.fileNamePositionId === positionId &&
        p.overlayFileName
    );
    return linkingPosition?.overlayFileName || null;
  };

  // Render position shapes
  const renderPosition = (position: Position, isSelected: boolean) => {
    const baseStyle: React.CSSProperties = {
      left: `${position.x * scale}px`,
      top: `${position.y * scale}px`,
      width: `${position.width * scale}px`,
      height: `${position.height * scale}px`,
      transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
    };

    let shapeStyle: React.CSSProperties = {};
    let shapeClass = "position-shape";
    let clipPath = "";

    if (position.shape === "CIRCLE") {
      shapeStyle = {
        ...baseStyle,
        borderRadius: "50%",
      };
      shapeClass = `position-shape position-circle ${
        isSelected ? "selected" : ""
      }`;
    } else if (position.shape === "TRAPEZOID") {
      const topWidth = position.width * 0.8;
      const topOffset = (position.width - topWidth) / 2;
      const topLeftPercent = (topOffset / position.width) * 100;
      const topRightPercent = ((topOffset + topWidth) / position.width) * 100;
      clipPath = `polygon(${topLeftPercent}% 0%, ${topRightPercent}% 0%, 100% 100%, 0% 100%)`;
      shapeStyle = {
        ...baseStyle,
        clipPath,
      };
      shapeClass = `position-shape position-trapezoid ${
        isSelected ? "selected" : ""
      }`;
    } else {
      shapeStyle = baseStyle;
      shapeClass = `position-shape position-rectangle ${
        isSelected ? "selected" : ""
      }`;
    }

    // Check if selecting filename position
    const isSelectingTarget =
      isSelectingFileNamePosition && pendingFileNameLinkId !== position.id;
    if (isSelectingTarget) {
      shapeClass += " selecting-target";
    }

    // Check if this position has a linked filename to display
    const linkedFileName = getLinkedFileName(position.id);

    return (
      <div
        key={position.id}
        className={shapeClass}
        style={shapeStyle}
        onClick={(e) => {
          e.stopPropagation();
          handlePositionClick(position.id);
        }}
      >
        {/* Overlay image with transparency support */}
        {position.overlayImage && (
          <img
            src={position.overlayImage}
            alt="Overlay"
            className="overlay-image"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              borderRadius: position.shape === "CIRCLE" ? "50%" : "0",
              clipPath: position.shape === "TRAPEZOID" ? clipPath : undefined,
            }}
          />
        )}

        {/* Display linked filename */}
        {linkedFileName && (
          <div className="filename-display">{linkedFileName}</div>
        )}

        {/* Position label - show transformed Top-left and Bottom-right */}
        {!position.overlayImage &&
          !linkedFileName &&
          (() => {
            const tl = transformCoordinate(position.x, position.y);
            const br = transformCoordinate(
              position.x + position.width,
              position.y + position.height
            );
            return (
              <div className="position-label">
                <span>
                  TL: ({Math.round(tl.x)}, {Math.round(tl.y)})
                </span>
                <span>
                  BR: ({Math.round(br.x)}, {Math.round(br.y)})
                </span>
              </div>
            );
          })()}

        {/* Show indicator if this position has an overlay */}
        {position.overlayImage && isSelected && (
          <div className="overlay-indicator">📷</div>
        )}

        {/* Show link indicator */}
        {position.showFileName && position.fileNamePositionId && (
          <div className="link-indicator">🔗</div>
        )}
      </div>
    );
  };

  return (
    <div className="image-annotation-container">
      <div className="toolbar">
        <div className="zoom-controls">
          <button onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}>
            Zoom Out
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(5, s + 0.1))}>
            Zoom In
          </button>
          <button onClick={() => setScale(1)}>Reset Zoom</button>
        </div>
        <div className="pan-controls">
          <button onClick={() => setPanOffset({ x: 0, y: 0 })}>
            Reset Pan
          </button>
        </div>
        <div className="shape-selector">
          <label>Shape: </label>
          <select
            value={selectedShape}
            onChange={(e) => setSelectedShape(e.target.value as ShapeType)}
          >
            <option value="RECTANGLE">Rectangle</option>
            <option value="CIRCLE">Circle</option>
            <option value="TRAPEZOID">Trapezoid</option>
          </select>
        </div>
        <div className="origin-selector">
          <label>Coordinate Origin: </label>
          <select
            value={coordinateOrigin}
            onChange={(e) =>
              onCoordinateOriginChange(e.target.value as CoordinateOrigin)
            }
          >
            <option value="TOP_LEFT">Top-Left ↘</option>
            <option value="TOP_RIGHT">Top-Right ↙</option>
            <option value="BOTTOM_LEFT">Bottom-Left ↗</option>
            <option value="BOTTOM_RIGHT">Bottom-Right ↖</option>
            <option value="CENTER">Center ✛</option>
          </select>
        </div>
        <div className="instructions">
          <p>
            Click and drag to create shapes | Ctrl+Click to pan | Scroll to zoom
            | Delete to remove selected
          </p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="image-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onMouseDownCapture={handlePanStart}
        onMouseMoveCapture={handlePanMove}
        onMouseUpCapture={handlePanEnd}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Annotation target"
          className="annotation-image"
          style={{
            transform: `scale(${scale}) translate(${panOffset.x / scale}px, ${
              panOffset.y / scale
            }px)`,
            transformOrigin: "top left",
          }}
          draggable={false}
        />

        {/* Render existing positions */}
        {positions.map((position) =>
          renderPosition(position, position.id === selectedPosition)
        )}

        {/* Render current drawing shape */}
        {isDrawing &&
          currentRect &&
          (() => {
            const baseStyle = {
              left: `${currentRect.x * scale}px`,
              top: `${currentRect.y * scale}px`,
              width: `${currentRect.width * scale}px`,
              height: `${currentRect.height * scale}px`,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            };

            if (currentRect.shape === "CIRCLE") {
              return (
                <div
                  className="position-shape position-circle drawing"
                  style={{
                    ...baseStyle,
                    borderRadius: "50%",
                  }}
                />
              );
            } else if (currentRect.shape === "TRAPEZOID") {
              const topWidth = currentRect.width * 0.8;
              const topOffset = (currentRect.width - topWidth) / 2;
              const topLeftPercent = (topOffset / currentRect.width) * 100;
              const topRightPercent =
                ((topOffset + topWidth) / currentRect.width) * 100;
              return (
                <div
                  className="position-shape position-trapezoid drawing"
                  style={{
                    ...baseStyle,
                    clipPath: `polygon(${topLeftPercent}% 0%, ${topRightPercent}% 0%, 100% 100%, 0% 100%)`,
                  }}
                />
              );
            } else {
              return (
                <div
                  className="position-shape position-rectangle drawing"
                  style={baseStyle}
                />
              );
            }
          })()}
      </div>

      {/* Selection mode indicator */}
      {isSelectingFileNamePosition && (
        <div className="selection-mode-banner">
          🎯 Click on a position where the filename should be displayed (ESC to
          cancel)
        </div>
      )}

      {/* Selected position controls */}
      {selectedPositionObj && (
        <div className="selected-position-controls">
          <h4>Selected Position Controls</h4>

          <div className="control-group">
            <label>Overlay Image:</label>
            <input
              ref={overlayInputRef}
              type="file"
              accept="image/*"
              onChange={handleOverlayUpload}
              style={{ display: "none" }}
              id="overlay-upload"
            />
            <div className="control-buttons">
              <label
                htmlFor="overlay-upload"
                className="control-btn upload-overlay-btn"
              >
                {selectedPositionObj.overlayImage
                  ? "Change Image"
                  : "Upload Image"}
              </label>
              {selectedPositionObj.overlayImage && (
                <button
                  className="control-btn remove-overlay-btn"
                  onClick={handleRemoveOverlay}
                >
                  Remove Image
                </button>
              )}
            </div>
            {selectedPositionObj.overlayFileName && (
              <span className="filename-info">
                📎 {selectedPositionObj.overlayFileName}
              </span>
            )}
          </div>

          <div className="control-group">
            <label>Show Filename in Another Position:</label>
            <div className="control-buttons">
              <button
                className={`control-btn ${
                  selectedPositionObj.showFileName ? "active" : ""
                }`}
                onClick={handleToggleFileName}
                disabled={!selectedPositionObj.overlayImage}
              >
                {selectedPositionObj.showFileName
                  ? `Linked to Position`
                  : "Link Filename Display"}
              </button>
              {selectedPositionObj.showFileName && (
                <button
                  className="control-btn remove-link-btn"
                  onClick={() => {
                    const updatedPositions = positions.map((pos) =>
                      pos.id === selectedPosition
                        ? {
                            ...pos,
                            showFileName: false,
                            fileNamePositionId: null,
                          }
                        : pos
                    );
                    onPositionsChange(updatedPositions);
                  }}
                >
                  Remove Link
                </button>
              )}
            </div>
            {!selectedPositionObj.overlayImage && (
              <span className="hint-text">
                Upload an image first to enable filename display
              </span>
            )}
          </div>
        </div>
      )}

      <div className="positions-list">
        <h3>Positions ({positions.length})</h3>
        {positions.length === 0 ? (
          <p className="empty-list">No positions selected yet</p>
        ) : (
          <div className="positions-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Shape</th>
                  <th>Coordinates</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, index) => {
                  // Calculate corner points with transformed coordinates
                  let cornerPoints: Array<{
                    x: number;
                    y: number;
                    label: string;
                  }> = [];

                  if (pos.shape === "RECTANGLE") {
                    const tl = transformCoordinate(pos.x, pos.y);
                    const br = transformCoordinate(
                      pos.x + pos.width,
                      pos.y + pos.height
                    );
                    cornerPoints = [
                      {
                        x: Math.round(tl.x),
                        y: Math.round(tl.y),
                        label: "Top-left",
                      },
                      {
                        x: Math.round(br.x),
                        y: Math.round(br.y),
                        label: "Bottom-right",
                      },
                    ];
                  } else if (pos.shape === "CIRCLE") {
                    const rawCenterX = pos.x + pos.width / 2;
                    const rawCenterY = pos.y + pos.height / 2;
                    const center = transformCoordinate(rawCenterX, rawCenterY);
                    const radius = Math.round(
                      Math.max(pos.width, pos.height) / 2
                    );
                    cornerPoints = [
                      {
                        x: Math.round(center.x),
                        y: Math.round(center.y),
                        label: "Center",
                      },
                      { x: radius, y: 0, label: "Radius" },
                    ];
                  } else if (pos.shape === "TRAPEZOID") {
                    const topWidth = pos.width * 0.8;
                    const topOffset = (pos.width - topWidth) / 2;
                    const tl = transformCoordinate(pos.x + topOffset, pos.y);
                    const br = transformCoordinate(
                      pos.x + pos.width,
                      pos.y + pos.height
                    );
                    cornerPoints = [
                      {
                        x: Math.round(tl.x),
                        y: Math.round(tl.y),
                        label: "Top-left",
                      },
                      {
                        x: Math.round(br.x),
                        y: Math.round(br.y),
                        label: "Bottom-right",
                      },
                    ];
                  }

                  return (
                    <tr
                      key={pos.id}
                      className={
                        selectedPosition === pos.id ? "selected-row" : ""
                      }
                      onClick={() => setSelectedPosition(pos.id)}
                    >
                      <td>{index + 1}</td>
                      <td>{pos.shape}</td>
                      <td className="coordinates-cell">
                        {cornerPoints.map((pt, i) => (
                          <span key={i} className="coordinate-point">
                            {pt.label}: ({pt.x}, {pt.y})
                          </span>
                        ))}
                      </td>
                      <td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPositionsChange(
                              positions.filter((p) => p.id !== pos.id)
                            );
                          }}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageAnnotation;
