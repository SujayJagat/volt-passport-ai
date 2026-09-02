import React, { useMemo, useState } from "react";
import {
  Clock,
  Coins,
  Layers,
  Recycle,
  Scale,
  X,
  Zap,
} from "lucide-react";
import {
  calculateBatteryResaleValuation,
  type BatteryValuationInput,
  type BatteryValuationResult,
} from "@/lib/batteryValuation";

interface BatteryResaleValuationProps {
  input: BatteryValuationInput;
  onClose?: () => void;
  className?: string;
}

export default function BatteryResaleValuation({ input, onClose, className = "" }: BatteryResaleValuationProps) {
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [showBreakdown, setShowBreakdown] = useState(true);

  const valuation: BatteryValuationResult = useMemo(() => {
    return calculateBatteryResaleValuation(input);
  }, [input]);

  const formatPrice = (amountUsd: number) => {
    if (currency === "INR") {
      const inr = Math.round(amountUsd * 83.5);
      return `₹${inr.toLocaleString("en-IN")}`;
    }
    return `$${amountUsd.toLocaleString()}`;
  };

  return (
    <section
      className={`battery-resale-card ${className}`}
      style={{
        background: "linear-gradient(145deg, rgba(8, 22, 24, 0.95), rgba(4, 12, 14, 0.98))",
        border: "1px solid rgba(0, 245, 212, 0.25)",
        borderRadius: "12px",
        padding: "28px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: "absolute",
          top: "-50px",
          right: "-50px",
          width: "220px",
          height: "220px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0, 245, 212, 0.12), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "18px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Coins size={18} style={{ color: "var(--cyan)" }} />
            <span
              style={{
                font: "700 11px var(--mono, monospace)",
                color: "var(--cyan)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              DIAGNOSTIC RESIDUAL VALUATION
            </span>
          </div>
          <h2 style={{ fontSize: "22px", margin: "2px 0 6px", color: "#eef5f3" }}>
            Estimated Resale & Secondary Market Value
          </h2>
          <p style={{ margin: 0, color: "#8aa5a0", fontSize: "13px" }}>
            Real-time algorithmic pricing based on electrochemical telemetry, SOH, and certified passport provenance.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Currency Switcher */}
          <div
            style={{
              display: "inline-flex",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(0, 245, 212, 0.3)",
              borderRadius: "6px",
              padding: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              style={{
                background: currency === "USD" ? "var(--cyan)" : "transparent",
                color: currency === "USD" ? "#041012" : "#9bb2ae",
                border: "none",
                padding: "5px 12px",
                borderRadius: "4px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              style={{
                background: currency === "INR" ? "var(--cyan)" : "transparent",
                color: currency === "INR" ? "#041012" : "#9bb2ae",
                border: "none",
                padding: "5px 12px",
                borderRadius: "4px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              INR (₹)
            </button>
          </div>

          {/* Close button if provided */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#eef5f3",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <X size={14} /> Close
            </button>
          )}
        </div>
      </div>

      {/* Main Fair Market Value Hero Box */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          alignItems: "center",
          background: "rgba(4, 14, 16, 0.7)",
          border: "1px solid rgba(0, 245, 212, 0.2)",
          borderRadius: "10px",
          padding: "24px",
          marginBottom: "28px",
        }}
      >
        <div>
          <span style={{ fontSize: "11px", color: "#8fa8a3", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            ESTIMATED FAIR MARKET RESALE VALUE
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", margin: "6px 0 8px" }}>
            <span
              style={{
                fontSize: "clamp(32px, 5vw, 44px)",
                fontWeight: 800,
                color: "var(--cyan)",
                fontFamily: "var(--mono, monospace)",
                textShadow: "0 0 20px rgba(0, 245, 212, 0.35)",
              }}
            >
              {formatPrice(valuation.fairMarketValueUsd)}
            </span>
            <span
              style={{
                padding: "3px 8px",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#10b981",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 700,
                fontFamily: "var(--mono, monospace)",
              }}
            >
              {valuation.valueRetentionPct}% Pack Equity Retained
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "#9bb5b0", lineHeight: "1.4" }}>
            Recommended Secondary Route: <strong style={{ color: "#eef5f3" }}>{valuation.primaryMarketChannel.channelName}</strong>
          </p>
        </div>

        {/* Optimal Window Card */}
        <div
          style={{
            background:
              valuation.optimalSellingWindow.urgency === "OPTIMAL"
                ? "rgba(16, 185, 129, 0.08)"
                : valuation.optimalSellingWindow.urgency === "ATTENTION"
                ? "rgba(245, 158, 11, 0.08)"
                : "rgba(239, 68, 68, 0.08)",
            border: `1px solid ${
              valuation.optimalSellingWindow.urgency === "OPTIMAL"
                ? "rgba(16, 185, 129, 0.3)"
                : valuation.optimalSellingWindow.urgency === "ATTENTION"
                ? "rgba(245, 158, 11, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <Clock
              size={15}
              style={{
                color:
                  valuation.optimalSellingWindow.urgency === "OPTIMAL"
                    ? "#10b981"
                    : valuation.optimalSellingWindow.urgency === "ATTENTION"
                    ? "#f59e0b"
                    : "#ef4444",
              }}
            />
            <strong style={{ fontSize: "12px", color: "#eef5f3", textTransform: "uppercase" }}>
              Optimal Monetization Window
            </strong>
          </div>
          <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#b0c4c0", lineHeight: "1.4" }}>
            {valuation.optimalSellingWindow.recommendation}
          </p>
          <span style={{ fontSize: "11px", color: "var(--cyan)", fontFamily: "var(--mono, monospace)" }}>
            ⏳ ~{valuation.optimalSellingWindow.monthsRemaining} months of prime value retention remaining
          </span>
        </div>
      </div>

      {/* Diagnostic Price Breakdown Meter */}
      <div style={{ marginBottom: "28px" }}>
        <button
          type="button"
          onClick={() => setShowBreakdown(!showBreakdown)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "12px 18px",
            borderRadius: "6px",
            color: "#eef5f3",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Scale size={16} style={{ color: "var(--cyan)" }} />
            Diagnostic Price Breakdown (Evaluation Model)
          </span>
        </button>

        {showBreakdown && (
          <div
            style={{
              marginTop: "12px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              padding: "16px",
              display: "grid",
              gap: "10px",
            }}
          >
            {valuation.breakdown.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background:
                    item.type === "base"
                      ? "rgba(255,255,255,0.03)"
                      : item.type === "bonus"
                      ? "rgba(16, 185, 129, 0.08)"
                      : "rgba(239, 68, 68, 0.05)",
                  borderLeft: `3px solid ${
                    item.type === "base"
                      ? "var(--cyan)"
                      : item.type === "bonus"
                      ? "#10b981"
                      : "#ef4444"
                  }`,
                  borderRadius: "4px",
                  fontSize: "13px",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ color: "#ffffff", display: "block" }}>{item.label}</strong>
                  <span style={{ color: "#7a9591", fontSize: "11px" }}>{item.description}</span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono, monospace)",
                    fontWeight: 700,
                    fontSize: "14px",
                    color:
                      item.type === "base"
                        ? "var(--cyan)"
                        : item.type === "bonus"
                        ? "#10b981"
                        : "#ff7777",
                  }}
                >
                  {item.amount > 0 && item.type === "bonus" ? "+" : ""}
                  {formatPrice(item.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3 Secondary Market Channels Comparison */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "14px", color: "#eef5f3", margin: "0 0 14px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Secondary Market Channel Price Comparison
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
          {valuation.allMarketChannels.map((channel, idx) => (
            <div
              key={idx}
              style={{
                background: channel.recommended
                  ? "linear-gradient(145deg, rgba(0, 245, 212, 0.08), rgba(8, 26, 28, 0.95))"
                  : "rgba(0,0,0,0.3)",
                border: channel.recommended
                  ? "2px solid var(--cyan)"
                  : "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                padding: "20px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {channel.recommended && (
                <span
                  style={{
                    position: "absolute",
                    top: "-10px",
                    right: "16px",
                    background: "var(--cyan)",
                    color: "#041214",
                    fontSize: "10px",
                    fontWeight: 800,
                    fontFamily: "var(--mono, monospace)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    letterSpacing: "0.05em",
                  }}
                >
                  RECOMMENDED ROUTE
                </span>
              )}

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  {channel.channel === "ev_marketplace" ? (
                    <Zap size={16} style={{ color: "var(--cyan)" }} />
                  ) : channel.channel === "bess_storage" ? (
                    <Layers size={16} style={{ color: "#f59e0b" }} />
                  ) : (
                    <Recycle size={16} style={{ color: "#10b981" }} />
                  )}
                  <h4 style={{ margin: 0, color: "#eef5f3", fontSize: "14px" }}>{channel.channelName}</h4>
                </div>

                <div style={{ margin: "10px 0" }}>
                  <span
                    style={{
                      fontSize: "24px",
                      fontWeight: 700,
                      color: channel.recommended ? "var(--cyan)" : "#ffffff",
                      fontFamily: "var(--mono, monospace)",
                    }}
                  >
                    {formatPrice(channel.estimatedPrice)}
                  </span>
                  <span style={{ fontSize: "11px", color: "#7a9591", marginLeft: "6px" }}>
                    (~{formatPrice(channel.pricePerKwh)}/kWh)
                  </span>
                </div>

                <p style={{ fontSize: "12px", color: "#8aa5a0", margin: "0 0 14px", lineHeight: "1.4" }}>
                  {channel.description}
                </p>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    color: "#7a9591",
                    paddingTop: "10px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <span>Demand: <strong style={{ color: "#eef5f3" }}>{channel.demandRating}</strong></span>
                  <span>Turnaround: <strong style={{ color: "#eef5f3" }}>{channel.turnaroundDays}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5-Year Residual Value Forecast */}
      <div>
        <h3 style={{ fontSize: "14px", color: "#eef5f3", margin: "0 0 12px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          5-Year Residual Value Forecast
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "8px",
          }}
        >
          {valuation.projectedCurve.map((point, idx) => (
            <div
              key={idx}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "6px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <span className="small-label" style={{ display: "block", marginBottom: "4px" }}>
                {idx === 0 ? "CURRENT (YEAR 0)" : `YEAR +${idx} (${point.year})`}
              </span>
              <strong style={{ color: idx === 0 ? "var(--cyan)" : "#eef5f3", fontSize: "16px", fontFamily: "var(--mono, monospace)", display: "block" }}>
                {formatPrice(point.projectedValue)}
              </strong>
              <small style={{ color: "#7a9591", fontSize: "10px", display: "block", marginTop: "2px" }}>
                ~{point.estimatedSoh}% SOH
              </small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
