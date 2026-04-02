import React from "react";
import { sanitizeDuneUrl } from "@sheet-engine/core";
import "./index.css";

interface DunePreviewProps {
  url: string;
  position: {
    left: number;
    top: number;
  };
  onKeepAsLink: () => void;
  onEmbed: () => void;
}

const DunePreview: React.FC<DunePreviewProps> = ({
  url,
  position,
  onKeepAsLink,
  onEmbed,
}) => {
  const embedUrl = sanitizeDuneUrl(url);
  if (!embedUrl) return null;

  return (
    <div
      className="fortune-dune-preview"
      style={{
        left: position.left,
        top: position.top,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="fortune-dune-preview-header">
        <span className="fortune-dune-preview-title">
          Detected Dune chart link
        </span>
      </div>
      <div className="fortune-dune-preview-content">
        <iframe
          src={embedUrl}
          title="Dune Chart Preview"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      </div>
      <p>Do you want to insert Dune chart?</p>
      <div className="fortune-dune-preview-footer">
        <button
          type="button"
          onClick={onKeepAsLink}
          className="fortune-dune-preview-button"
        >
          Keep as Link
        </button>
        <button
          type="button"
          onClick={onEmbed}
          className="fortune-dune-preview-button primary"
        >
          Embed
        </button>
      </div>
    </div>
  );
};

export default DunePreview;
