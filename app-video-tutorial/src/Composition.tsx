import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const MyComposition = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations for Title
  const titleOpacity = interpolate(frame, [0, 15], [0, 1]);
  const titleY = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#111827", color: "white", fontFamily: "sans-serif" }}>
      <Sequence from={0} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <h1
            style={{
              opacity: titleOpacity,
              transform: `translateY(${interpolate(titleY, [0, 1], [50, 0])}px)`,
              fontSize: "80px",
              fontWeight: "bold",
              textAlign: "center",
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CJSoftware License Checker
          </h1>
          <p
            style={{
              opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" }),
              fontSize: "40px",
              marginTop: "20px",
              color: "#9ca3af"
            }}
          >
            Automate Your Software Audits
          </p>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={150} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{
            opacity: interpolate(frame - 150, [0, 15], [0, 1]),
            transform: `scale(${spring({ frame: frame - 150, fps })})`,
            padding: "60px",
            backgroundColor: "#1f2937",
            borderRadius: "30px",
            border: "2px solid #6366f1",
            boxShadow: "0 0 50px rgba(99, 102, 241, 0.3)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <h2 style={{ fontSize: "60px", marginBottom: "40px" }}>Detect Software instantly.</h2>
            <div style={{
              width: "100%",
              height: "20px",
              backgroundColor: "#374151",
              borderRadius: "10px",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                backgroundColor: "#4ade80",
                width: `${interpolate(frame - 150, [30, 100], [0, 100], { extrapolateRight: "clamp" })}%`
              }} />
            </div>
            <p style={{ marginTop: "20px", fontSize: "30px", color: "#6366f1" }}>Deep Scanning System...</p>
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={300} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <h2 style={{
            opacity: interpolate(frame - 300, [0, 15], [0, 1]),
            transform: `scale(${spring({ frame: frame - 300, fps })})`,
            fontSize: "70px",
            textAlign: "center"
          }}>
            Export Results to CSV
          </h2>
          <p style={{
            opacity: interpolate(frame - 330, [0, 15], [0, 1], { extrapolateLeft: 'clamp' }),
            fontSize: "40px",
            marginTop: "30px",
            color: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            padding: "20px 40px",
            borderRadius: "20px",
            border: "1px solid rgba(16, 185, 129, 0.4)"
          }}>
            100% Audit Ready!
          </p>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
