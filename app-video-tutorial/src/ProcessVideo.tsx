import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Audio } from "remotion";
import { User, Monitor, Hash, MapPin, Search, Save, Download, UploadCloud, CheckCircle, FileText, MousePointer2, RefreshCw, AlertCircle, ShieldCheck } from "lucide-react";

export const ProcessVideo = () => {
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f172a", color: "white", fontFamily: "sans-serif" }}>
            {/* Background Gradient */}
            <AbsoluteFill style={{
                background: "radial-gradient(circle at top right, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(circle at bottom left, rgba(168, 85, 247, 0.15) 0%, transparent 50%)"
            }} />

            {/* Corporate/ambient background music placeholder */}
            <Audio src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" volume={0.4} />

            <Sequence from={0} durationInFrames={180}>
                <Scene1FillingOut />
            </Sequence>

            <Sequence from={180} durationInFrames={180}>
                <Scene2DeepScan />
            </Sequence>

            <Sequence from={360} durationInFrames={180}>
                <Scene3SavingResult />
            </Sequence>

            <Sequence from={540} durationInFrames={180}>
                <Scene4ExportingCSV />
            </Sequence>

            <Sequence from={720} durationInFrames={180}>
                <Scene5UploadingFormA />
            </Sequence>
        </AbsoluteFill>
    );
};

// ======================= SCENE 1 ========================
const Scene1FillingOut = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
    const scale = spring({ frame, fps, config: { damping: 15 } });

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <h1 style={{ opacity, fontSize: "50px", marginBottom: "40px", color: "#e2e8f0" }}>Step 1: Fill Out Computer Info</h1>
            <div style={{
                opacity,
                transform: `scale(${scale})`,
                backgroundColor: "#1e293b",
                padding: "50px",
                borderRadius: "30px",
                border: "1px solid #334155",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                width: "600px",
                display: "flex",
                flexDirection: "column",
                gap: "25px"
            }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", borderBottom: "1px solid #334155", paddingBottom: "20px", marginBottom: "10px" }}>
                    <Monitor size={32} color="#818cf8" />
                    <h2 style={{ fontSize: "30px", margin: 0 }}>Computer Info</h2>
                </div>

                <TypingField label="Asset Tag / Property No." icon={Hash} value="PC-2024-001" startFrame={20} />
                <TypingField label="Assigned User" icon={User} value="Charles Jasthyn" startFrame={50} />
                <TypingField label="Brand & Model" icon={Monitor} value="Dell Optiplex 7090" startFrame={80} />
                <TypingField label="Location / Room" icon={MapPin} value="Quality Assurance Office" startFrame={110} />
            </div>
        </AbsoluteFill>
    )
}

const TypingField = ({ label, value, icon: Icon, startFrame }: { label: string, value: string, icon: any, startFrame: number }) => {
    const frame = useCurrentFrame();
    const charsToShow = Math.max(0, Math.floor((frame - startFrame) / 2));
    const text = value.slice(0, charsToShow);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "16px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "8px" }}>
                {label}
            </label>
            <div style={{
                backgroundColor: "#0f172a",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid #334155",
                fontSize: "24px",
                color: "#f8fafc",
                height: "65px",
                display: "flex",
                alignItems: "center"
            }}>
                {text}
                <span style={{
                    opacity: frame % 30 < 15 && text.length < value.length ? 1 : 0,
                    marginLeft: "2px",
                    width: "3px",
                    height: "30px",
                    backgroundColor: "#818cf8",
                    display: "inline-block"
                }} />
            </div>
        </div>
    )
}

// ======================= SCENE 2 ========================
const Scene2DeepScan = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const clicked = frame > 80;

    const cursorX = spring({ frame: frame - 20, fps, from: 800, to: 0, config: { damping: 15 } });
    const cursorY = spring({ frame: frame - 20, fps, from: 300, to: 0, config: { damping: 15 } });
    const cursorScale = frame > 75 && frame < 85 ? 0.8 : 1;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <h1 style={{ fontSize: "50px", marginBottom: "60px", color: "#e2e8f0" }}>Step 2: Initiate Software Scan</h1>

            <div style={{ position: "relative" }}>
                <div style={{
                    backgroundColor: clicked ? "#1e293b" : "#4f46e5",
                    padding: "30px 60px",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                    border: clicked ? "3px dashed #818cf8" : "3px solid transparent",
                    boxShadow: !clicked ? "0 10px 30px rgba(79, 70, 229, 0.5)" : "none",
                    transition: "all 0.2s"
                }}>
                    {clicked ? (
                        <>
                            <RefreshCw size={40} className="spin" color="#818cf8" style={{ transform: `rotate(${frame * 4}deg)` }} />
                            <span style={{ fontSize: "36px", fontWeight: "bold", color: "#818cf8" }}>Deep Scanning System...</span>
                        </>
                    ) : (
                        <>
                            <Search size={40} color="white" />
                            <span style={{ fontSize: "36px", fontWeight: "bold", color: "white" }}>Initiate Software Scan</span>
                        </>
                    )}
                </div>

                {/* Simulated Cursor */}
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: `translate(${cursorX}px, ${cursorY}px) scale(${cursorScale})`,
                    zIndex: 10
                }}>
                    <MousePointer2 size={60} color="white" fill="#1e293b" strokeWidth={1} style={{ filter: "drop-shadow(0 5px 5px rgba(0,0,0,0.5))" }} />
                    {frame > 75 && frame < 85 && (
                        <div style={{
                            position: "absolute",
                            top: -10, left: -10, right: -10, bottom: -10,
                            border: "3px solid rgba(255,255,255,0.5)",
                            borderRadius: "50%",
                            animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite"
                        }} />
                    )}
                </div>
            </div>

            {clicked && (
                <div style={{ marginTop: "40px", width: "400px", height: "8px", backgroundColor: "#334155", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{
                        height: "100%", width: "100%", backgroundColor: "#4ade80",
                        transform: `scaleX(${interpolate(frame, [80, 160], [0, 1], { extrapolateRight: "clamp" })})`,
                        transformOrigin: "left"
                    }} />
                </div>
            )}
        </AbsoluteFill>
    )
}

// ======================= SCENE 3 ========================
const Scene3SavingResult = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const tableY = spring({ frame, fps, from: 200, to: 0 });
    const tableOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

    const clicked = frame > 110;

    const cursorX = spring({ frame: frame - 60, fps, from: 800, to: 0, config: { damping: 15 } });
    const cursorY = spring({ frame: frame - 60, fps, from: -300, to: 0, config: { damping: 15 } });
    const cursorScale = frame > 105 && frame < 115 ? 0.8 : 1;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "100px" }}>
            <h1 style={{ fontSize: "50px", marginBottom: "40px", color: "#e2e8f0" }}>Step 3: Save Entire Audit</h1>

            <div style={{
                opacity: tableOpacity,
                transform: `translateY(${tableY}px)`,
                backgroundColor: "#1e293b",
                borderRadius: "20px",
                width: "900px",
                border: "1px solid #334155",
                overflow: "hidden",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}>
                <div style={{ padding: "20px 30px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <AlertCircle size={24} color="#818cf8" />
                        <span style={{ fontSize: "20px", fontWeight: "bold" }}>Detected Software Inventory (45)</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <span style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#f87171", padding: "5px 15px", borderRadius: "20px", fontSize: "14px", fontWeight: "bold" }}>2 Alerts</span>
                        <span style={{ backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#4ade80", padding: "5px 15px", borderRadius: "20px", fontSize: "14px", fontWeight: "bold" }}>43 OK</span>
                    </div>
                </div>

                {/* Fake Table */}
                <div style={{ padding: "0" }}>
                    {[
                        { name: "Microsoft Office 2021", status: "OK", valid: "Licensed" },
                        { name: "Adobe Photoshop CC", status: "Alert", valid: "Check Req." },
                        { name: "Google Chrome", status: "OK", valid: "Permanent" },
                    ].map((sw, i) => (
                        <div key={i} style={{ padding: "15px 30px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                            <span style={{ fontSize: "18px", width: "40%" }}>{sw.name}</span>
                            <span style={{ fontSize: "16px", color: sw.status === "OK" ? "#4ade80" : "#f87171" }}>{sw.status}</span>
                            <span style={{ fontSize: "16px", color: sw.valid === "Licensed" || sw.valid === "Permanent" ? "#4ade80" : "#fbbf24" }}>{sw.valid}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ position: "relative", marginTop: "40px" }}>
                <div style={{
                    backgroundColor: clicked ? "#22c55e" : "#059669",
                    padding: "20px 60px",
                    borderRadius: "15px",
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                    boxShadow: "0 10px 20px rgba(5, 150, 105, 0.3)",
                    transition: "all 0.2s"
                }}>
                    {clicked ? (
                        <>
                            <CheckCircle size={30} color="white" />
                            <span style={{ fontSize: "24px", fontWeight: "bold", color: "white" }}>Saved Successfully!</span>
                        </>
                    ) : (
                        <>
                            <Save size={30} color="white" />
                            <span style={{ fontSize: "24px", fontWeight: "bold", color: "white" }}>SAVE ENTIRE AUDIT</span>
                        </>
                    )}
                </div>

                {/* Cursor */}
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: `translate(${cursorX}px, ${cursorY}px) scale(${cursorScale})`,
                    zIndex: 10
                }}>
                    <MousePointer2 size={60} color="white" fill="#1e293b" strokeWidth={1} style={{ filter: "drop-shadow(0 5px 5px rgba(0,0,0,0.5))" }} />
                </div>
            </div>
        </AbsoluteFill>
    )
}

// ======================= SCENE 4 ========================
const Scene4ExportingCSV = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const clicked = frame > 80;

    const cursorX = spring({ frame: frame - 20, fps, from: -600, to: 0, config: { damping: 15 } });
    const cursorY = spring({ frame: frame - 20, fps, from: 300, to: 0, config: { damping: 15 } });
    const cursorScale = frame > 75 && frame < 85 ? 0.8 : 1;

    const fileY = spring({ frame: clicked ? frame - 80 : 0, fps, from: 200, to: 0, config: { damping: 12 } });
    const fileOpacity = interpolate(frame - 80, [0, 15], [0, 1], { extrapolateRight: "clamp" });

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <h1 style={{ fontSize: "50px", marginBottom: "60px", color: "#e2e8f0" }}>Step 4: Export to CSV</h1>

            <div style={{ position: "relative" }}>
                <div style={{
                    backgroundColor: "#1e293b",
                    padding: "20px 40px",
                    borderRadius: "15px",
                    border: "1px solid #334155",
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                    boxShadow: !clicked ? "0 10px 20px rgba(0,0,0,0.2)" : "inset 0 2px 10px rgba(0,0,0,0.5)"
                }}>
                    <Download size={30} color="#e2e8f0" />
                    <span style={{ fontSize: "24px", fontWeight: "bold", color: "#e2e8f0" }}>Export CSV</span>
                </div>

                {/* Cursor */}
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: `translate(${cursorX}px, ${cursorY}px) scale(${cursorScale})`,
                    zIndex: 10
                }}>
                    <MousePointer2 size={60} color="white" fill="#0f172a" strokeWidth={1} style={{ filter: "drop-shadow(0 5px 5px rgba(0,0,0,0.5))" }} />
                </div>
            </div>

            {clicked && (
                <div style={{
                    opacity: fileOpacity,
                    transform: `translateY(${fileY}px)`,
                    marginTop: "60px",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    border: "2px solid #10b981",
                    padding: "30px 50px",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "20px"
                }}>
                    <FileText size={50} color="#10b981" />
                    <div>
                        <div style={{ fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>AUDIT-Charles-Jasthyn-2024.csv</div>
                        <div style={{ fontSize: "16px", color: "#a7f3d0", marginTop: "5px" }}>Successfully downloaded to your computer</div>
                    </div>
                </div>
            )}
        </AbsoluteFill>
    )
}

// ======================= SCENE 5 ========================
const Scene5UploadingFormA = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
    const dropped = frame > 80;

    const fileY = spring({ frame: frame - 30, fps, from: -300, to: 0, config: { damping: 15 } });
    const fileScale = dropped ? spring({ frame: frame - 80, fps, from: 1, to: 0 }) : 1;

    return (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <h1 style={{ fontSize: "50px", marginBottom: "40px", color: "#e2e8f0" }}>Step 5: Upload FORM A</h1>

            <div style={{
                opacity,
                backgroundColor: dropped ? "rgba(16, 185, 129, 0.05)" : "transparent",
                border: dropped ? "3px solid #10b981" : "3px dashed #64748b",
                borderRadius: "30px",
                width: "700px",
                height: "400px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "20px",
                position: "relative",
                transition: "all 0.5s"
            }}>
                {dropped ? (
                    <>
                        {frame > 120 ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", transform: `scale(${spring({ frame: frame - 120, fps })})` }}>
                                <ShieldCheck size={100} color="#10b981" />
                                <h2 style={{ fontSize: "36px", color: "#10b981", margin: 0 }}>FORM A Uploaded</h2>
                                <p style={{ fontSize: "20px", color: "#a7f3d0", margin: 0 }}>Compliance Process Complete!</p>
                            </div>
                        ) : (
                            <div style={{ width: "80%", display: "flex", flexDirection: "column", gap: "15px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#e2e8f0", fontSize: "18px", fontWeight: "bold" }}>
                                    <span>Uploading FORM A: LICENSE INVENTORY...</span>
                                    <span>{Math.floor(interpolate(frame, [80, 120], [0, 100], { extrapolateRight: "clamp" }))}%</span>
                                </div>
                                <div style={{ width: "100%", height: "15px", backgroundColor: "#334155", borderRadius: "10px", overflow: "hidden" }}>
                                    <div style={{ height: "100%", backgroundColor: "#10b981", width: `${interpolate(frame, [80, 120], [0, 100], { extrapolateRight: "clamp" })} % ` }} />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <UploadCloud size={80} color="#64748b" />
                        <span style={{ fontSize: "24px", color: "#94a3b8" }}>Drag & Drop FORM A: LICENSE INVENTORY STATUS REPORT here</span>
                        <span style={{ fontSize: "16px", color: "#64748b" }}>Or click to browse files</span>
                    </>
                )}

                {/* Animated File falling in */}
                {frame > 30 && !dropped && (
                    <div style={{
                        position: "absolute",
                        top: "20%",
                        transform: `translateY(${fileY}px) scale(${fileScale})`,
                        backgroundColor: "#1e293b",
                        border: "2px solid #818cf8",
                        padding: "15px 25px",
                        borderRadius: "15px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                        zIndex: 20
                    }}>
                        <FileText size={30} color="#818cf8" />
                        <span style={{ fontSize: "18px", fontWeight: "bold", color: "white" }}>AUDIT-Charles-Jasthyn-2024.csv</span>
                    </div>
                )}
            </div>
        </AbsoluteFill>
    )
}
