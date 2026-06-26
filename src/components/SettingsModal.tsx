import { X } from "lucide-react";
import { GenerationSettings } from "../api";
import ConfigurationPanel from "./ConfigurationPanel";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GenerationSettings;
  onSave: (newSettings: GenerationSettings) => void;
}

export default function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "960px",
          width: "90%",
          maxHeight: "90vh",
          padding: "1.5rem",
        }}
      >
        <div className="modal-header" style={{ borderBottom: "none", padding: "0 0 1rem 0" }}>
          <h3 className="modal-title">Settings</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, paddingRight: "0.25rem" }}>
          <ConfigurationPanel
            settings={settings}
            onSave={onSave}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
