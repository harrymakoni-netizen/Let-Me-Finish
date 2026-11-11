import { ImageResponse } from "next/og";

export const alt = "Let Me Finish — your voice, your words, your pace.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview shown when someone shares a link to Let Me Finish. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "radial-gradient(circle at 85% 15%, rgba(106,91,255,0.45), rgba(46,139,255,0.15) 35%, #10243a 65%)",
          color: "#f6f4ee",
        }}
      >
        <div style={{ fontSize: 30, color: "#7ee0e6" }}>A speech companion for adults who stammer</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 120, letterSpacing: -4, lineHeight: 1 }}>Let me finish.</div>
          <div style={{ fontSize: 44, marginTop: 28, color: "#b9c6d4" }}>Your voice. Your words. Your pace.</div>
        </div>
        <div style={{ fontSize: 28, color: "#b9c6d4" }}>Practise real conversations with a partner that waits.</div>
      </div>
    ),
    size,
  );
}
