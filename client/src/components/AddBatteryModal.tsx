import React, { useState } from "react";
import { QrCode, Hash, X, CheckCircle2, AlertCircle, Camera, Upload, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatteryDataset } from "@/contexts/BatteryDatasetContext";

type AddBatteryModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AddBatteryModal({ isOpen, onClose }: AddBatteryModalProps) {
  const { addBatteryToAccount, claimedBatteries } = useAuth();
  const { selectBatteryId } = useBatteryDataset();

  const [tab, setTab] = useState<"code" | "qr">("code");
  const [batteryId, setBatteryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [scannedId, setScannedId] = useState("");

  if (!isOpen) return null;

  const handleAddByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batteryId.trim()) {
      setErrorMsg("Please enter a Battery ID (e.g. BAT0002).");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    const normalized = batteryId.trim().toUpperCase();
    const claimRes = await addBatteryToAccount(normalized);
    if (!claimRes.success) {
      setLoading(false);
      setErrorMsg(claimRes.error || "Could not claim this battery ID.");
      return;
    }

    await selectBatteryId(normalized);
    setLoading(false);
    setSuccessMsg(`✓ Battery ${normalized} successfully added to your account!`);
    setTimeout(() => {
      setBatteryId("");
      setSuccessMsg("");
      onClose();
    }, 1200);
  };

  const handleSimulateQRScan = async (selectedBatId: string) => {
    setScannedId(selectedBatId);
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const claimRes = await addBatteryToAccount(selectedBatId);
    if (!claimRes.success) {
      setLoading(false);
      setErrorMsg(claimRes.error || "QR verification failed.");
      return;
    }

    await selectBatteryId(selectedBatId);
    setLoading(false);
    setSuccessMsg(`✓ Physical QR verification successful: ${selectedBatId} paired!`);
    setTimeout(() => {
      setSuccessMsg("");
      setScannedId("");
      onClose();
    }, 1200);
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="add-battery-dialog"
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#081316",
          border: "1px solid rgba(0, 245, 212, 0.35)",
          borderRadius: "8px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
          overflow: "hidden",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(180, 224, 220, 0.12)",
            background: "rgba(10, 23, 25, 0.9)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "var(--cyan)" }}><Plus size={18}/></span>
            <strong style={{ color: "#eef5f3", fontSize: "15px", fontFamily: "Space Grotesk, sans-serif" }}>
              Add Battery to My Fleet
            </strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: 0, color: "#8fa5a1", cursor: "pointer", padding: "4px" }}
          >
            <X size={18}/>
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(180, 224, 220, 0.12)", background: "rgba(3, 10, 12, 0.5)" }}>
          <button
            type="button"
            onClick={() => setTab("code")}
            style={{
              flex: 1,
              padding: "12px",
              background: tab === "code" ? "rgba(0, 245, 212, 0.08)" : "none",
              border: 0,
              borderBottom: tab === "code" ? "2px solid var(--cyan)" : "2px solid transparent",
              color: tab === "code" ? "var(--cyan)" : "#8fa5a1",
              fontSize: "12px",
              fontFamily: "monospace",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Hash size={14}/> Battery Code
          </button>
          <button
            type="button"
            onClick={() => setTab("qr")}
            style={{
              flex: 1,
              padding: "12px",
              background: tab === "qr" ? "rgba(0, 245, 212, 0.08)" : "none",
              border: 0,
              borderBottom: tab === "qr" ? "2px solid var(--cyan)" : "2px solid transparent",
              color: tab === "qr" ? "var(--cyan)" : "#8fa5a1",
              fontSize: "12px",
              fontFamily: "monospace",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <QrCode size={14}/> Scan QR Code
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {errorMsg && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(255, 107, 107, 0.12)", border: "1px solid rgba(255, 107, 107, 0.3)", borderRadius: "4px", color: "#ff8787", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={15}/> {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(0, 245, 212, 0.12)", border: "1px solid var(--cyan)", borderRadius: "4px", color: "var(--cyan)", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={15}/> {successMsg}
            </div>
          )}

          {tab === "code" ? (
            <form onSubmit={handleAddByCode} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", color: "#b5c9c5", fontSize: "12px", marginBottom: "6px", fontFamily: "monospace" }}>
                  BATTERY IDENTIFIER (e.g. BAT0002)
                </label>
                <input
                  type="text"
                  value={batteryId}
                  onChange={e => setBatteryId(e.target.value.toUpperCase())}
                  placeholder="Enter Battery ID (e.g. BAT0002)"
                  style={{
                    width: "100%",
                    background: "rgba(1, 8, 9, 0.9)",
                    border: "1px solid rgba(0, 245, 212, 0.35)",
                    borderRadius: "4px",
                    color: "#eef5f3",
                    padding: "10px 14px",
                    fontSize: "14px",
                    fontFamily: "monospace",
                    letterSpacing: "1px",
                  }}
                  autoFocus
                />
              </div>

              {/* Suggestions */}
              <div>
                <span style={{ fontSize: "11px", color: "#78918f", display: "block", marginBottom: "6px", fontFamily: "monospace" }}>
                  QUICK SUGGESTIONS FROM VERIFIED DATABASE:
                </span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["BAT0001", "BAT0002", "BAT0042", "BAT0075", "BAT0100", "BAT0150", "BAT0180"].map(id => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBatteryId(id)}
                      style={{
                        background: claimedBatteries.includes(id) ? "rgba(0, 245, 212, 0.15)" : "rgba(15, 30, 33, 0.8)",
                        border: claimedBatteries.includes(id) ? "1px solid var(--cyan)" : "1px solid rgba(180, 224, 220, 0.18)",
                        color: claimedBatteries.includes(id) ? "var(--cyan)" : "#b5c9c5",
                        borderRadius: "3px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontFamily: "monospace",
                        cursor: "pointer",
                      }}
                    >
                      {id} {claimedBatteries.includes(id) ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="button button-solid"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {loading ? "Verifying..." : "Add to My Account"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="button button-outline"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" }}>
              <div
                style={{
                  background: "rgba(1, 8, 9, 0.9)",
                  border: "2px dashed rgba(0, 245, 212, 0.35)",
                  borderRadius: "6px",
                  padding: "24px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <QrCode size={44} style={{ color: "var(--cyan)" }}/>
                <div>
                  <strong style={{ color: "#eef5f3", fontSize: "14px", display: "block" }}>
                    Scan Physical Battery QR Code
                  </strong>
                  <small style={{ color: "#8fa5a1", fontSize: "11px" }}>
                    Scan the QR sticker on the battery enclosure for instant direct pairing.
                  </small>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="button button-solid"
                    onClick={() => handleSimulateQRScan("BAT0002")}
                    disabled={loading}
                    style={{ fontSize: "11px", padding: "8px 12px", flex: "1 1 180px", justifyContent: "center" }}
                  >
                    <Camera size={13}/> Scan Pack (BAT0002)
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => handleSimulateQRScan("BAT0042")}
                    disabled={loading}
                    style={{ fontSize: "11px", padding: "8px 12px", flex: "1 1 180px", justifyContent: "center" }}
                  >
                    <Upload size={13}/> Scan Pack (BAT0042)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
