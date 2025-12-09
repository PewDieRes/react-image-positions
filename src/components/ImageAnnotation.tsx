import React, { useState, useRef, useCallback, useEffect } from "react";
import { Position, ShapeType } from "../App";
import "./ImageAnnotation.css";

interface ImageAnnotationProps {
  imageUrl: string;
  positions: Position[];
  onPositionsChange: (positions: Position[]) => void;
}

const ImageAnnotation: React.FC<ImageAnnotationProps> = ({
  imageUrl,
  positions,
  onPositionsChange,
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

  // Get coordinates relative to the original image
  const getImageCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!containerRef.current || !imageRef.current) return null;

      const containerRect = containerRef.current.getBoundingClientRect();

      // Calculate position relative to container, accounting for scroll
      const scrollLeft = containerRef.current.scrollLeft;
      const scrollTop = containerRef.current.scrollTop;

      // Mouse position relative to container (including scroll)
      const mouseX = clientX - containerRect.left + scrollLeft;
      const mouseY = clientY - containerRect.top + scrollTop;

      // Remove pan offset and un-scale to get original image coordinates
      const imageX = (mouseX - panOffset.x) / scale;
      const imageY = (mouseY - panOffset.y) / scale;

      return { x: imageX, y: imageY };
    },
    [scale, panOffset]
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

        // Log all 4 corner points
        const x = Math.round(currentRect.x);
        const y = Math.round(currentRect.y);
        const w = Math.round(currentRect.width);
        const h = Math.round(currentRect.height);

        console.log("=== NEW SHAPE CREATED ===");
        console.log("Shape:", selectedShape);

        if (selectedShape === "RECTANGLE") {
          const corners = [
            { x: x, y: y }, // Top-left
            { x: x + w, y: y }, // Top-right
            { x: x + w, y: y + h }, // Bottom-right
            { x: x, y: y + h }, // Bottom-left
          ];
          console.log("Top-left:", corners[0]);
          console.log("Top-right:", corners[1]);
          console.log("Bottom-right:", corners[2]);
          console.log("Bottom-left:", corners[3]);
          console.log("All corners:", JSON.stringify(corners));
        } else if (selectedShape === "CIRCLE") {
          const centerX = Math.round(x + w / 2);
          const centerY = Math.round(y + h / 2);
          const radius = Math.round(Math.max(w, h) / 2);
          console.log("Center:", { x: centerX, y: centerY });
          console.log("Radius:", radius);
          console.log("Radius point:", { x: centerX + radius, y: centerY });
        } else if (selectedShape === "TRAPEZOID") {
          const topWidth = w * 0.8;
          const topOffset = (w - topWidth) / 2;
          const corners = [
            { x: Math.round(x + topOffset), y: y },
            { x: Math.round(x + topOffset + topWidth), y: y },
            { x: x + w, y: y + h },
            { x: x, y: y + h },
          ];
          console.log("Top-left:", corners[0]);
          console.log("Top-right:", corners[1]);
          console.log("Bottom-right:", corners[2]);
          console.log("Bottom-left:", corners[3]);
          console.log("All corners:", JSON.stringify(corners));
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPosition, positions, onPositionsChange]);

  // Render position shapes
  const renderPosition = (position: Position, isSelected: boolean) => {
    const baseStyle = {
      left: `${position.x * scale}px`,
      top: `${position.y * scale}px`,
      width: `${position.width * scale}px`,
      height: `${position.height * scale}px`,
      transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
    };

    let shapeStyle: React.CSSProperties = {};
    let shapeClass = "position-shape";

    if (position.shape === "CIRCLE") {
      // Circle: use border-radius to make it circular
      shapeStyle = {
        ...baseStyle,
        borderRadius: "50%",
      };
      shapeClass = `position-shape position-circle ${
        isSelected ? "selected" : ""
      }`;
    } else if (position.shape === "TRAPEZOID") {
      // Trapezoid: use clip-path
      const topWidth = position.width * 0.8;
      const topOffset = (position.width - topWidth) / 2;
      const topLeftPercent = (topOffset / position.width) * 100;
      const topRightPercent = ((topOffset + topWidth) / position.width) * 100;
      shapeStyle = {
        ...baseStyle,
        clipPath: `polygon(${topLeftPercent}% 0%, ${topRightPercent}% 0%, 100% 100%, 0% 100%)`,
      };
      shapeClass = `position-shape position-trapezoid ${
        isSelected ? "selected" : ""
      }`;
    } else {
      // Rectangle: default
      shapeStyle = baseStyle;
      shapeClass = `position-shape position-rectangle ${
        isSelected ? "selected" : ""
      }`;
    }

    return (
      <div
        key={position.id}
        className={shapeClass}
        style={shapeStyle}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedPosition(position.id);
        }}
      >
        <div className="position-label">
          {Math.round(position.x)}, {Math.round(position.y)}
        </div>
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
                  <th>Coordinates (All Points)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, index) => {
                  // Calculate all corner points
                  let cornerPoints: Array<{ x: number; y: number }> = [];
                  if (pos.shape === "RECTANGLE") {
                    cornerPoints = [
                      { x: Math.round(pos.x), y: Math.round(pos.y) },
                      {
                        x: Math.round(pos.x + pos.width),
                        y: Math.round(pos.y),
                      },
                      {
                        x: Math.round(pos.x + pos.width),
                        y: Math.round(pos.y + pos.height),
                      },
                      {
                        x: Math.round(pos.x),
                        y: Math.round(pos.y + pos.height),
                      },
                    ];
                  } else if (pos.shape === "CIRCLE") {
                    const centerX = Math.round(pos.x + pos.width / 2);
                    const centerY = Math.round(pos.y + pos.height / 2);
                    const radius = Math.round(
                      Math.max(pos.width, pos.height) / 2
                    );
                    cornerPoints = [
                      { x: centerX, y: centerY },
                      { x: centerX + radius, y: centerY },
                    ];
                  } else if (pos.shape === "TRAPEZOID") {
                    const topWidth = pos.width * 0.8;
                    const topOffset = (pos.width - topWidth) / 2;
                    cornerPoints = [
                      {
                        x: Math.round(pos.x + topOffset),
                        y: Math.round(pos.y),
                      },
                      {
                        x: Math.round(pos.x + topOffset + topWidth),
                        y: Math.round(pos.y),
                      },
                      {
                        x: Math.round(pos.x + pos.width),
                        y: Math.round(pos.y + pos.height),
                      },
                      {
                        x: Math.round(pos.x),
                        y: Math.round(pos.y + pos.height),
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
                        {cornerPoints.map((pt, i) => {
                          // Get label based on shape and point index
                          let label = "";
                          if (
                            pos.shape === "RECTANGLE" ||
                            pos.shape === "TRAPEZOID"
                          ) {
                            const labels = [
                              "Top-left",
                              "Top-right",
                              "Bottom-right",
                              "Bottom-left",
                            ];
                            label = labels[i] || `P${i + 1}`;
                          } else if (pos.shape === "CIRCLE") {
                            const labels = ["Center", "Radius"];
                            label = labels[i] || `P${i + 1}`;
                          }
                          return (
                            <span key={i} className="coordinate-point">
                              {label}: ({pt.x}, {pt.y})
                            </span>
                          );
                        })}
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
