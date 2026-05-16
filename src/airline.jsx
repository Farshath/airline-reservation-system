import { useState, useEffect, useRef, useCallback } from "react";

// ─── In-memory DB ──────────────────────────────────────────────────────────────
const DB = {
    users: [
        { id: 1, firstName: "Arjun", lastName: "Sharma", dob: "1990-05-12", email: "arjun@example.com", mobile: "9876543210", passport: "A1234567" }
    ],
    flights: [
        { id: 1, name: "IndiGo 6E-101", source: "Chennai", destination: "Delhi", date: "2025-06-10", session: "Morning", class: "Economy", price: 4500, seats: 42, duration: "2h 50m", aircraft: "A320" },
        { id: 2, name: "Air India AI-202", source: "Mumbai", destination: "Chennai", date: "2025-06-11", session: "Evening", class: "Business", price: 12000, seats: 8, duration: "2h 05m", aircraft: "B787" },
        { id: 3, name: "SpiceJet SG-303", source: "Delhi", destination: "Bangalore", date: "2025-06-12", session: "Afternoon", class: "Economy", price: 3800, seats: 55, duration: "2h 30m", aircraft: "B737" },
        { id: 4, name: "Vistara UK-404", source: "Kolkata", destination: "Mumbai", date: "2025-06-13", session: "Morning", class: "Premium Economy", price: 7500, seats: 20, duration: "2h 45m", aircraft: "A321" },
        { id: 5, name: "GoAir G8-505", source: "Hyderabad", destination: "Goa", date: "2025-06-14", session: "Evening", class: "Economy", price: 3200, seats: 60, duration: "1h 20m", aircraft: "A320" },
        { id: 6, name: "IndiGo 6E-606", source: "Chennai", destination: "Mumbai", date: "2025-06-15", session: "Afternoon", class: "Economy", price: 5100, seats: 35, duration: "2h 10m", aircraft: "A321" },
        { id: 7, name: "Air India AI-707", source: "Delhi", destination: "London", date: "2025-06-20", session: "Night", class: "Business", price: 85000, seats: 12, duration: "9h 30m", aircraft: "B777" },
        { id: 8, name: "Vistara UK-808", source: "Bangalore", destination: "Singapore", date: "2025-06-22", session: "Morning", class: "Economy", price: 18000, seats: 45, duration: "4h 05m", aircraft: "A321" },
    ],
    bookings: [],
    nextBookingId: 1,
};

const CITIES = ["Chennai", "Delhi", "Mumbai", "Bangalore", "Kolkata", "Hyderabad", "Goa", "London", "Singapore"];
const SESSIONS = ["Morning", "Afternoon", "Evening", "Night"];
const CLASSES = ["Economy", "Premium Economy", "Business", "First Class"];

const AIRLINE_LOGOS = {
    "IndiGo": "#1B3FA0", "Air India": "#E31837", "SpiceJet": "#FF5E00",
    "Vistara": "#8B1D7D", "GoAir": "#17479E"
};

// ─── City map coordinates (SVG viewport 520x580) ──────────────────────────────
const CITY_COORDS = {
    "Delhi": { x: 210, y: 108, label: "DEL" },
    "Mumbai": { x: 148, y: 258, label: "BOM" },
    "Chennai": { x: 248, y: 390, label: "MAA" },
    "Bangalore": { x: 220, y: 362, label: "BLR" },
    "Kolkata": { x: 330, y: 192, label: "CCU" },
    "Hyderabad": { x: 232, y: 308, label: "HYD" },
    "Goa": { x: 170, y: 316, label: "GOI" },
    "London": { x: 58, y: 40, label: "LHR" },
    "Singapore": { x: 430, y: 430, label: "SIN" },
};

function getAirlineColor(name) {
    for (const [k, v] of Object.entries(AIRLINE_LOGOS)) if (name.includes(k)) return v;
    return "#0F6E56";
}

// ─── Route Map Component ───────────────────────────────────────────────────────
function RouteMap({ flights, onRouteClick, highlightFlight }) {
    const [hoveredCity, setHoveredCity] = useState(null);
    const [hoveredRoute, setHoveredRoute] = useState(null);
    const [animOffset, setAnimOffset] = useState(0);

    useEffect(() => {
        let raf;
        let t = 0;
        const animate = () => {
            t += 0.5;
            setAnimOffset(t % 100);
            raf = requestAnimationFrame(animate);
        };
        raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
    }, []);

    // Build unique routes from flights
    const routes = flights.map(f => ({
        ...f,
        src: CITY_COORDS[f.source],
        dst: CITY_COORDS[f.destination],
        color: getAirlineColor(f.name),
    })).filter(r => r.src && r.dst);

    // Bezier control point (arc upward)
    function ctrl(x1, y1, x2, y2) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const bend = Math.min(len * 0.28, 70);
        return { cx: mx - dy / len * bend, cy: my + dx / len * bend };
    }

    function pathD(r) {
        const c = ctrl(r.src.x, r.src.y, r.dst.x, r.dst.y);
        return `M ${r.src.x} ${r.src.y} Q ${c.cx} ${c.cy} ${r.dst.x} ${r.dst.y}`;
    }

    const activeCities = new Set(flights.flatMap(f => [f.source, f.destination]));

    return (
        <div style={{ position: "relative", width: "100%", maxWidth: "520px", margin: "0 auto" }}>
            <svg viewBox="0 0 520 490" style={{ width: "100%", height: "auto" }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <radialGradient id="cityGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                    </radialGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.4)" />
                    </marker>
                </defs>

                {/* India landmass silhouette - simplified polygon */}
                <polygon
                    points="155,60 175,55 200,50 230,52 260,58 290,65 315,80 340,100 355,125 365,150 370,175 368,200 360,225 348,248 335,268 318,285 305,305 295,325 285,345 278,365 272,382 268,398 260,415 248,430 235,442 222,448 210,442 195,430 182,415 170,398 162,378 155,358 148,338 142,318 138,298 136,275 138,252 143,228 148,205 150,182 148,158 150,135 153,110 155,88 155,60"
                    fill="rgba(30,41,59,0.5)" stroke="rgba(148,163,184,0.15)" strokeWidth="1" />

                {/* Grid lines */}
                {[100, 200, 300, 400].map(y => (
                    <line key={`h${y}`} x1="40" y1={y} x2="480" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                ))}
                {[100, 200, 300, 400].map(x => (
                    <line key={`v${x}`} x1={x} y1="20" x2={x} y2="470" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                ))}

                {/* Route arcs */}
                {routes.map((r, i) => {
                    const isHighlighted = highlightFlight?.id === r.id;
                    const isHovered = hoveredRoute === r.id;
                    const active = isHighlighted || isHovered;
                    const d = pathD(r);
                    const pathLen = 300;
                    return (
                        <g key={r.id} style={{ cursor: "pointer" }} onClick={() => onRouteClick(r)}>
                            {/* Glow/shadow arc */}
                            <path d={d} fill="none"
                                stroke={r.color} strokeWidth={active ? 5 : 2.5}
                                strokeOpacity={active ? 0.6 : 0.18}
                                strokeLinecap="round" />
                            {/* Main arc */}
                            <path d={d} fill="none"
                                stroke={active ? r.color : "rgba(148,163,184,0.35)"} strokeWidth={active ? 2.5 : 1.5}
                                strokeLinecap="round"
                                strokeDasharray={active ? "8 4" : "none"}
                                onMouseEnter={() => setHoveredRoute(r.id)}
                                onMouseLeave={() => setHoveredRoute(null)} />
                            {/* Animated plane dot */}
                            {active && (
                                <circle r="4" fill="white" filter="url(#glow)" opacity="0.9">
                                    <animateMotion dur="2.5s" repeatCount="indefinite" path={d} />
                                </circle>
                            )}
                            {/* Arrow marker tip */}
                            <path d={d} fill="none" stroke="transparent" strokeWidth="12"
                                onMouseEnter={() => setHoveredRoute(r.id)}
                                onMouseLeave={() => setHoveredRoute(null)} />
                        </g>
                    );
                })}

                {/* City nodes */}
                {Object.entries(CITY_COORDS).map(([city, pos]) => {
                    const isActive = activeCities.has(city);
                    const isHovered = hoveredCity === city;
                    if (!isActive && city !== "London" && city !== "Singapore") return null;
                    return (
                        <g key={city} style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHoveredCity(city)}
                            onMouseLeave={() => setHoveredCity(null)}>
                            {/* Pulse ring */}
                            {isHovered && (
                                <circle cx={pos.x} cy={pos.y} r="14" fill="none"
                                    stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.5">
                                    <animate attributeName="r" from="10" to="20" dur="1s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite" />
                                </circle>
                            )}
                            {/* Glow */}
                            <circle cx={pos.x} cy={pos.y} r={isHovered ? 10 : 7} fill={isActive ? "#3b82f6" : "#475569"} opacity="0.15" />
                            {/* Node */}
                            <circle cx={pos.x} cy={pos.y} r={isHovered ? 6 : 4.5}
                                fill={isHovered ? "#60a5fa" : "#93c5fd"}
                                stroke={isHovered ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)"}
                                strokeWidth="1.5" filter={isHovered ? "url(#glow)" : "none"} />
                            {/* Label */}
                            <text x={pos.x} y={pos.y - 10} textAnchor="middle"
                                fontSize="9.5" fontFamily="'DM Sans', sans-serif" fontWeight="600"
                                fill={isHovered ? "#e2e8f0" : "#94a3b8"} letterSpacing="0.08em">
                                {pos.label}
                            </text>
                            <text x={pos.x} y={pos.y + 17} textAnchor="middle"
                                fontSize="7.5" fontFamily="'DM Sans', sans-serif"
                                fill={isHovered ? "#cbd5e1" : "#64748b"}>
                                {city}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}


// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(p) { return `₹${p.toLocaleString("en-IN")}`; }
function today() { return new Date().toISOString().split("T")[0]; }
function randomPNR() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    app: { fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100vh", background: "linear-gradient(135deg, #0a0e1a 0%, #0d1b2a 50%, #091018 100%)", color: "#e8edf5", position: "relative", overflow: "hidden" },
    stars: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 },
    nav: { position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(20px)", background: "rgba(10,14,26,0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" },
    logo: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.4rem", fontWeight: 700, background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" },
    main: { position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem 4rem" },
    card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "2rem", backdropFilter: "blur(10px)" },
    input: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "0.75rem 1rem", color: "#e8edf5", fontSize: "0.95rem", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" },
    label: { display: "block", fontSize: "0.78rem", fontWeight: 500, color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" },
    btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "0.75rem 1.75rem", borderRadius: "12px", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", border: "none", transition: "all 0.2s", letterSpacing: "0.01em" },
    btnPrimary: { background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "white" },
    btnSecondary: { background: "rgba(255,255,255,0.08)", color: "#e8edf5", border: "1px solid rgba(255,255,255,0.1)" },
    btnGhost: { background: "transparent", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" },
    tag: { display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 500 },
    hero: { textAlign: "center", padding: "4rem 0 2rem" },
    heroTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 700, lineHeight: 1.1, background: "linear-gradient(135deg, #e2e8f0, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "1rem" },
    heroSub: { color: "#64748b", fontSize: "1.05rem", maxWidth: "400px", margin: "0 auto 2.5rem" },
    flightCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "1.25rem 1.5rem", transition: "all 0.2s", cursor: "pointer", marginBottom: "12px" },
    flightCardHover: { background: "rgba(255,255,255,0.08)", borderColor: "rgba(99,102,241,0.4)", transform: "translateY(-1px)" },
    divider: { height: "1px", background: "rgba(255,255,255,0.07)", margin: "1.5rem 0" },
    pill: { background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "20px", padding: "3px 12px", fontSize: "0.75rem", fontWeight: 500 },
    pillSuccess: { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "20px", padding: "3px 12px", fontSize: "0.75rem", fontWeight: 500 },
    pillWarn: { background: "rgba(234,179,8,0.12)", color: "#facc15", border: "1px solid rgba(234,179,8,0.2)", borderRadius: "20px", padding: "3px 12px", fontSize: "0.75rem", fontWeight: 500 },
};

// ─── Star Background ───────────────────────────────────────────────────────────
function Stars() {
    const stars = Array.from({ length: 80 }, (_, i) => ({
        id: i, x: Math.random() * 100, y: Math.random() * 100,
        size: Math.random() * 2 + 0.5, opacity: Math.random() * 0.5 + 0.1,
        delay: Math.random() * 4,
    }));
    return (
        <div style={S.stars}>
            <svg width="100%" height="100%" style={{ position: "absolute" }}>
                {stars.map(s => (
                    <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.size}
                        fill="white" opacity={s.opacity}
                        style={{ animation: `twinkle ${2 + s.delay}s ease-in-out infinite alternate`, animationDelay: `${s.delay}s` }} />
                ))}
            </svg>
            <style>{`@keyframes twinkle { from{opacity:0.1} to{opacity:0.6} } @keyframes fadeSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} } @keyframes spin { to{transform:rotate(360deg)} }`}</style>
        </div>
    );
}

// ─── Input with Suggestions ────────────────────────────────────────────────────
function SuggestInput({ label, value, onChange, suggestions, placeholder }) {
    const [open, setOpen] = useState(false);
    const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value);
    return (
        <div style={{ position: "relative" }}>
            {label && <label style={S.label}>{label}</label>}
            <input style={S.input} value={value} placeholder={placeholder}
                onChange={e => { onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
            {open && filtered.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", zIndex: 50, overflow: "hidden" }}>
                    {filtered.map(s => (
                        <div key={s} onMouseDown={() => { onChange(s); setOpen(false); }}
                            style={{ padding: "0.6rem 1rem", cursor: "pointer", fontSize: "0.9rem", transition: "background 0.15s" }}
                            onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.06)"}
                            onMouseLeave={e => e.target.style.background = "transparent"}>
                            ✈ {s}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
    return (
        <div style={{ position: "fixed", top: "80px", right: "1.5rem", zIndex: 999, display: "flex", flexDirection: "column", gap: "8px" }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    padding: "0.75rem 1.25rem", borderRadius: "12px", fontSize: "0.9rem", fontWeight: 500, animation: "fadeSlideUp 0.3s ease",
                    background: t.type === "success" ? "rgba(34,197,94,0.15)" : t.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)",
                    border: `1px solid ${t.type === "success" ? "rgba(34,197,94,0.3)" : t.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.3)"}`,
                    color: t.type === "success" ? "#4ade80" : t.type === "error" ? "#f87171" : "#a5b4fc",
                    backdropFilter: "blur(10px)"
                }}>
                    {t.msg}
                </div>
            ))}
        </div>
    );
}

// ─── Flight Card ───────────────────────────────────────────────────────────────
function FlightCard({ flight, onSelect, selected }) {
    const [hovered, setHovered] = useState(false);
    const airlineColor = getAirlineColor(flight.name);
    const isLow = flight.seats < 15;
    return (
        <div onClick={() => onSelect(flight)}
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            style={{ ...S.flightCard, ...(hovered || selected ? S.flightCardHover : {}), borderColor: selected ? "rgba(99,102,241,0.5)" : undefined, boxShadow: selected ? "0 0 0 2px rgba(99,102,241,0.2)" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                {/* Airline */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "140px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: airlineColor + "25", border: `1px solid ${airlineColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>✈</div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#e2e8f0" }}>{flight.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{flight.aircraft}</div>
                    </div>
                </div>
                {/* Route */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, justifyContent: "center" }}>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{flight.source.slice(0, 3).toUpperCase()}</div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{flight.source}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{flight.duration}</div>
                        <div style={{ height: "1px", width: "60px", background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", position: "relative" }}>
                            <div style={{ position: "absolute", right: 0, top: "-4px", width: "8px", height: "8px", borderRadius: "50%", background: "#8b5cf6" }} />
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{flight.session}</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{flight.destination.slice(0, 3).toUpperCase()}</div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{flight.destination}</div>
                    </div>
                </div>
                {/* Price + Class */}
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.2rem", background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{formatPrice(flight.price)}</div>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px", flexWrap: "wrap" }}>
                        <span style={S.pill}>{flight.class}</span>
                        {isLow && <span style={S.pillWarn}>{flight.seats} left</span>}
                        {!isLow && <span style={S.pillSuccess}>{flight.seats} seats</span>}
                    </div>
                </div>
            </div>
            <div style={{ marginTop: "10px", fontSize: "0.78rem", color: "#64748b" }}>📅 {flight.date}</div>
        </div>
    );
}

// ─── Booking Confirmation Modal ────────────────────────────────────────────────
function BookingModal({ booking, flight, user, onClose }) {
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
            <div style={{ ...S.card, maxWidth: "440px", width: "90%", animation: "fadeSlideUp 0.3s ease", border: "1px solid rgba(99,102,241,0.3)" }}>
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🎫</div>
                    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.5rem", margin: 0, background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Booking Confirmed!</h2>
                    <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "6px" }}>Your journey is all set</p>
                </div>
                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "12px", padding: "1rem", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ color: "#64748b", fontSize: "0.8rem" }}>PNR Number</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.1rem", color: "#a5b4fc", letterSpacing: "0.1em" }}>{booking.pnr}</span>
                    </div>
                    <div style={S.divider} />
                    {[["Passenger", `${user.firstName} ${user.lastName}`], ["Flight", flight.name], ["Route", `${flight.source} → ${flight.destination}`], ["Date", flight.date], ["Session", flight.session], ["Class", flight.class], ["Amount Paid", formatPrice(flight.price)]].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                            <span style={{ color: "#64748b" }}>{k}</span>
                            <span style={{ fontWeight: 500 }}>{v}</span>
                        </div>
                    ))}
                </div>
                <button style={{ ...S.btn, ...S.btnPrimary, width: "100%" }} onClick={onClose}>Close</button>
            </div>
        </div>
    );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
    const [page, setPage] = useState("home");
    const [currentUser, setCurrentUser] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [modal, setModal] = useState(null);

    // Search state
    const [search, setSearch] = useState({ source: "", destination: "", date: "", session: "", class: "" });
    const [results, setResults] = useState([]);
    const [selectedFlight, setSelectedFlight] = useState(null);
    const [searched, setSearched] = useState(false);

    // Auth forms
    const [loginForm, setLoginForm] = useState({ email: "", mobile: "" });
    const [signupForm, setSignupForm] = useState({ firstName: "", lastName: "", dob: "", email: "", mobile: "", passport: "" });

    // Bookings view
    const [myBookings, setMyBookings] = useState([]);

    // Route map
    const [routeDetail, setRouteDetail] = useState(null);

    function toast(msg, type = "info") {
        const id = Date.now();
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }

    function doLogin() {
        const u = DB.users.find(u => u.email === loginForm.email && u.mobile === loginForm.mobile);
        if (u) {
            setCurrentUser(u);
            toast(`Welcome back, ${u.firstName}! ✈`, "success");
            setPage("search");
        } else {
            toast("Invalid credentials. Please try again.", "error");
        }
    }

    function doSignup() {
        const { firstName, lastName, dob, email, mobile, passport } = signupForm;
        if (!firstName || !lastName || !dob || !email || !mobile) return toast("All fields are required.", "error");
        if (mobile.length !== 10) return toast("Mobile must be 10 digits.", "error");
        if (DB.users.find(u => u.email === email)) return toast("Email already registered.", "error");
        const newUser = { id: DB.users.length + 1, firstName, lastName, dob, email, mobile, passport };
        DB.users.push(newUser);
        toast("Account created! Please log in.", "success");
        setPage("login");
    }

    function doSearch() {
        const r = DB.flights.filter(f =>
            (!search.source || f.source.toLowerCase().includes(search.source.toLowerCase())) &&
            (!search.destination || f.destination.toLowerCase().includes(search.destination.toLowerCase())) &&
            (!search.date || f.date === search.date) &&
            (!search.session || f.session === search.session) &&
            (!search.class || f.class === search.class)
        );
        setResults(r);
        setSearched(true);
        setSelectedFlight(null);
        if (r.length === 0) toast("No flights found. Try adjusting your search.", "error");
        else toast(`Found ${r.length} flight${r.length > 1 ? "s" : ""}`, "success");
    }

    function doBook() {
        if (!selectedFlight) return toast("Please select a flight first.", "error");
        if (!currentUser) { toast("Please log in to book.", "error"); setPage("login"); return; }
        const pnr = randomPNR();
        const booking = { id: DB.nextBookingId++, pnr, userEmail: currentUser.email, flightId: selectedFlight.id, bookedAt: new Date().toLocaleString() };
        DB.bookings.push(booking);
        setModal({ booking, flight: selectedFlight, user: currentUser });
        setSelectedFlight(null);
        setResults([]);
        setSearched(false);
        setSearch({ source: "", destination: "", date: "", session: "", class: "" });
    }

    function loadMyBookings() {
        const bk = DB.bookings.filter(b => b.userEmail === currentUser?.email).map(b => ({
            ...b, flight: DB.flights.find(f => f.id === b.flightId)
        }));
        setMyBookings(bk);
        setPage("bookings");
    }

    function logout() {
        setCurrentUser(null);
        setPage("home");
        toast("Logged out successfully.", "info");
    }

    const NavBtn = ({ to, label }) => (
        <button onClick={() => setPage(to)} style={{ ...S.btn, ...S.btnGhost, padding: "0.5rem 1rem", fontSize: "0.85rem", background: page === to ? "rgba(255,255,255,0.08)" : "transparent" }}>
            {label}
        </button>
    );

    return (
        <div style={S.app}>
            <Stars />
            <Toast toasts={toasts} />
            {modal && <BookingModal {...modal} onClose={() => setModal(null)} />}

            {/* NAV */}
            <nav style={S.nav}>
                <div style={S.logo} onClick={() => setPage("home")} role="button">✈ SkyFly</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <NavBtn to="search" label="Flights" />
                    <NavBtn to="routes" label="Route Map" />
                    {currentUser && <NavBtn to="bookings" label="My Trips" />}
                    {currentUser ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem" }}>
                                {currentUser.firstName[0]}
                            </div>
                            <button onClick={logout} style={{ ...S.btn, ...S.btnGhost, padding: "0.4rem 0.9rem", fontSize: "0.8rem" }}>Logout</button>
                        </div>
                    ) : (
                        <>
                            <NavBtn to="login" label="Log In" />
                            <button onClick={() => setPage("signup")} style={{ ...S.btn, ...S.btnPrimary, padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}>Sign Up</button>
                        </>
                    )}
                </div>
            </nav>

            <main style={S.main}>
                {/* HOME */}
                {page === "home" && (
                    <div style={{ animation: "fadeSlideUp 0.5s ease" }}>
                        <div style={S.hero}>
                            <h1 style={S.heroTitle}>Your Next Journey<br />Starts Here</h1>
                            <p style={S.heroSub}>Book flights across India and beyond with ease. Fast, simple, and reliable.</p>
                            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                                <button onClick={() => setPage("search")} style={{ ...S.btn, ...S.btnPrimary, fontSize: "1rem", padding: "0.875rem 2.25rem" }}>Search Flights ✈</button>
                                <button onClick={() => setPage("signup")} style={{ ...S.btn, ...S.btnSecondary, fontSize: "1rem", padding: "0.875rem 2.25rem" }}>Create Account</button>
                            </div>
                        </div>
                        {/* Stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px", marginTop: "3rem" }}>
                            {[["8+", "Destinations"], ["100+", "Flights Weekly"], ["24/7", "Support"], ["₹3,200", "Lowest Fare"]].map(([v, l]) => (
                                <div key={l} style={{ ...S.card, textAlign: "center", padding: "1.5rem 1rem" }}>
                                    <div style={{ fontSize: "1.8rem", fontWeight: 700, background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        {/* Popular Routes */}
                        <div style={{ marginTop: "3rem" }}>
                            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.3rem", marginBottom: "1rem", color: "#e2e8f0" }}>Popular Routes</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                                {[["Chennai", "Delhi", 4500], ["Mumbai", "Bangalore", 3800], ["Delhi", "Goa", 5200], ["Hyderabad", "Mumbai", 4100]].map(([from, to, price]) => (
                                    <div key={from + to} onClick={() => { setSearch(s => ({ ...s, source: from, destination: to })); setPage("search"); }}
                                        style={{ ...S.card, cursor: "pointer", padding: "1rem 1.25rem", transition: "all 0.2s" }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}>
                                        <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{from} → {to}</div>
                                        <div style={{ fontWeight: 600, marginTop: "4px", color: "#60a5fa" }}>From {formatPrice(price)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* LOGIN */}
                {page === "login" && (
                    <div style={{ maxWidth: "420px", margin: "2rem auto", animation: "fadeSlideUp 0.4s ease" }}>
                        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2rem", marginBottom: "0.5rem" }}>Welcome back</h2>
                        <p style={{ color: "#64748b", marginBottom: "2rem" }}>Sign in to manage your bookings</p>
                        <div style={S.card}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div>
                                    <label style={S.label}>Email Address</label>
                                    <input style={S.input} type="email" placeholder="you@example.com" value={loginForm.email}
                                        onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={S.label}>Mobile Number</label>
                                    <input style={S.input} placeholder="10-digit number" value={loginForm.mobile} maxLength={10}
                                        onChange={e => setLoginForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} />
                                </div>
                                <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: "0.5rem" }} onClick={doLogin}>Sign In</button>
                            </div>
                            <div style={S.divider} />
                            <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>
                                No account?{" "}
                                <span style={{ color: "#818cf8", cursor: "pointer" }} onClick={() => setPage("signup")}>Create one →</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* SIGNUP */}
                {page === "signup" && (
                    <div style={{ maxWidth: "480px", margin: "2rem auto", animation: "fadeSlideUp 0.4s ease" }}>
                        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2rem", marginBottom: "0.5rem" }}>Create account</h2>
                        <p style={{ color: "#64748b", marginBottom: "2rem" }}>Join SkyFly and start exploring</p>
                        <div style={S.card}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                {[["firstName", "First Name", "text", "Arjun"], ["lastName", "Last Name", "text", "Sharma"]].map(([k, lbl, type, ph]) => (
                                    <div key={k}>
                                        <label style={S.label}>{lbl}</label>
                                        <input style={S.input} type={type} placeholder={ph} value={signupForm[k]}
                                            onChange={e => setSignupForm(f => ({ ...f, [k]: e.target.value }))} />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
                                {[["dob", "Date of Birth", "date", ""], ["email", "Email Address", "email", "you@example.com"], ["passport", "Passport Number (optional)", "text", "A1234567"]].map(([k, lbl, type, ph]) => (
                                    <div key={k}>
                                        <label style={S.label}>{lbl}</label>
                                        <input style={S.input} type={type} placeholder={ph} value={signupForm[k]}
                                            onChange={e => setSignupForm(f => ({ ...f, [k]: e.target.value }))} />
                                    </div>
                                ))}
                                <div>
                                    <label style={S.label}>Mobile Number</label>
                                    <input style={S.input} placeholder="10-digit number" value={signupForm.mobile} maxLength={10}
                                        onChange={e => setSignupForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} />
                                </div>
                            </div>
                            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: "1.5rem" }} onClick={doSignup}>Create Account</button>
                            <div style={S.divider} />
                            <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>
                                Have an account?{" "}
                                <span style={{ color: "#818cf8", cursor: "pointer" }} onClick={() => setPage("login")}>Sign in →</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* SEARCH */}
                {page === "search" && (
                    <div style={{ animation: "fadeSlideUp 0.4s ease" }}>
                        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.8rem", marginBottom: "1.5rem" }}>Find Your Flight</h2>
                        <div style={S.card}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
                                <SuggestInput label="From" value={search.source} onChange={v => setSearch(s => ({ ...s, source: v }))} suggestions={CITIES} placeholder="City or airport" />
                                <SuggestInput label="To" value={search.destination} onChange={v => setSearch(s => ({ ...s, destination: v }))} suggestions={CITIES} placeholder="City or airport" />
                                <div>
                                    <label style={S.label}>Date</label>
                                    <input style={S.input} type="date" value={search.date} min={today()}
                                        onChange={e => setSearch(s => ({ ...s, date: e.target.value }))} />
                                </div>
                                <SuggestInput label="Session" value={search.session} onChange={v => setSearch(s => ({ ...s, session: v }))} suggestions={SESSIONS} placeholder="Any time" />
                                <SuggestInput label="Class" value={search.class} onChange={v => setSearch(s => ({ ...s, class: v }))} suggestions={CLASSES} placeholder="Any class" />
                            </div>
                            <div style={{ display: "flex", gap: "12px", marginTop: "1.25rem", flexWrap: "wrap" }}>
                                <button style={{ ...S.btn, ...S.btnPrimary }} onClick={doSearch}>Search Flights</button>
                                <button style={{ ...S.btn, ...S.btnSecondary }} onClick={() => { setSearch({ source: "", destination: "", date: "", session: "", class: "" }); setResults([]); setSearched(false); }}>Clear</button>
                            </div>
                        </div>

                        {/* Results */}
                        {searched && (
                            <div style={{ marginTop: "2rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{results.length} Flight{results.length !== 1 ? "s" : ""} Found</h3>
                                    {results.length > 1 && (
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button style={{ ...S.btn, ...S.btnGhost, padding: "0.4rem 0.9rem", fontSize: "0.78rem" }}
                                                onClick={() => setResults(r => [...r].sort((a, b) => a.price - b.price))}>
                                                ↑ Price
                                            </button>
                                            <button style={{ ...S.btn, ...S.btnGhost, padding: "0.4rem 0.9rem", fontSize: "0.78rem" }}
                                                onClick={() => setResults(r => [...r].sort((a, b) => b.price - a.price))}>
                                                ↓ Price
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {results.map(f => <FlightCard key={f.id} flight={f} selected={selectedFlight?.id === f.id} onSelect={setSelectedFlight} />)}
                                {selectedFlight && (
                                    <div style={{ ...S.card, marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", border: "1px solid rgba(99,102,241,0.3)" }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Selected: {selectedFlight.name}</div>
                                            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>{selectedFlight.source} → {selectedFlight.destination} · {formatPrice(selectedFlight.price)}</div>
                                        </div>
                                        <button style={{ ...S.btn, ...S.btnPrimary, padding: "0.875rem 2rem" }}
                                            onClick={currentUser ? doBook : () => { toast("Please log in to book.", "error"); setPage("login"); }}>
                                            {currentUser ? "Confirm Booking 🎫" : "Log In to Book"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ROUTE MAP */}
                {page === "routes" && (
                    <div style={{ animation: "fadeSlideUp 0.4s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                            <div>
                                <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.8rem", margin: 0 }}>Flight Route Map</h2>
                                <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "4px" }}>Click any route or city to explore flights</p>
                            </div>
                            <button style={{ ...S.btn, ...S.btnPrimary, fontSize: "0.85rem", padding: "0.6rem 1.25rem" }}
                                onClick={() => setPage("search")}>Book a Flight ✈</button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
                            {/* Map */}
                            <div style={{ ...S.card, padding: "1.25rem" }}>
                                <RouteMap
                                    flights={DB.flights}
                                    highlightFlight={selectedFlight}
                                    onRouteClick={(f) => {
                                        setSelectedFlight(f);
                                        setRouteDetail(f);
                                    }} />
                                <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                    {Object.entries(AIRLINE_LOGOS).map(([name, color]) => (
                                        <span key={name} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.72rem", color: "#94a3b8" }}>
                                            <span style={{ width: "20px", height: "2px", background: color, display: "inline-block", borderRadius: "2px" }} />
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Route list + detail */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {/* Detail panel */}
                                {routeDetail ? (
                                    <div style={{ ...S.card, padding: "1.25rem", border: "1px solid rgba(99,102,241,0.3)", animation: "fadeSlideUp 0.3s ease" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Selected Route</div>
                                            <button onClick={() => { setRouteDetail(null); setSelectedFlight(null); }}
                                                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                                        </div>
                                        {/* Route visual */}
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", margin: "1rem 0" }}>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e2e8f0" }}>{routeDetail.source.slice(0, 3).toUpperCase()}</div>
                                                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{routeDetail.source}</div>
                                            </div>
                                            <div style={{ flex: 1, position: "relative", height: "2px", background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }}>
                                                <span style={{ position: "absolute", top: "-18px", left: "50%", transform: "translateX(-50%)", fontSize: "1rem" }}>✈</span>
                                                <div style={{ position: "absolute", right: 0, top: "-4px", width: "8px", height: "8px", borderRadius: "50%", background: "#8b5cf6" }} />
                                                <div style={{ position: "absolute", bottom: "-16px", left: "50%", transform: "translateX(-50%)", fontSize: "0.7rem", color: "#64748b", whiteSpace: "nowrap" }}>{routeDetail.duration}</div>
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e2e8f0" }}>{routeDetail.destination.slice(0, 3).toUpperCase()}</div>
                                                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{routeDetail.destination}</div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "7px" }}>
                                            {[["Flight", routeDetail.name], ["Date", routeDetail.date], ["Session", routeDetail.session], ["Class", routeDetail.class], ["Aircraft", routeDetail.aircraft], ["Seats Left", `${routeDetail.seats} seats`]].map(([k, v]) => (
                                                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                                                    <span style={{ color: "#64748b" }}>{k}</span>
                                                    <span style={{ fontWeight: 500 }}>{v}</span>
                                                </div>
                                            ))}
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                                                <span style={{ color: "#64748b" }}>Price</span>
                                                <span style={{ fontWeight: 700, background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{formatPrice(routeDetail.price)}</span>
                                            </div>
                                        </div>
                                        <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: "1rem", fontSize: "0.85rem" }}
                                            onClick={() => { if (!currentUser) { toast("Please log in to book.", "error"); setPage("login"); } else { const pnr = randomPNR(); const booking = { id: DB.nextBookingId++, pnr, userEmail: currentUser.email, flightId: routeDetail.id, bookedAt: new Date().toLocaleString() }; DB.bookings.push(booking); setModal({ booking, flight: routeDetail, user: currentUser }); setRouteDetail(null); setSelectedFlight(null); } }}>
                                            Book This Flight 🎫
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ ...S.card, padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
                                        ← Click a route on the map to see details
                                    </div>
                                )}

                                {/* All routes list */}
                                <div style={{ ...S.card, padding: "1rem", maxHeight: "380px", overflowY: "auto" }}>
                                    <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>All Routes ({DB.flights.length})</div>
                                    {DB.flights.map(f => {
                                        const isSelected = selectedFlight?.id === f.id;
                                        return (
                                            <div key={f.id}
                                                onClick={() => { setSelectedFlight(f); setRouteDetail(f); }}
                                                style={{
                                                    padding: "0.6rem 0.75rem", borderRadius: "10px", cursor: "pointer", marginBottom: "5px", transition: "all 0.15s",
                                                    background: isSelected ? "rgba(99,102,241,0.12)" : "transparent",
                                                    border: isSelected ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent"
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f0" }}>
                                                            {f.source} <span style={{ color: "#64748b" }}>→</span> {f.destination}
                                                        </div>
                                                        <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>{f.name} · {f.session}</div>
                                                    </div>
                                                    <div style={{ textAlign: "right" }}>
                                                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#818cf8" }}>{formatPrice(f.price)}</div>
                                                        <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{f.duration}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {page === "bookings" && (
                    <div style={{ animation: "fadeSlideUp 0.4s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.8rem" }}>My Trips</h2>
                            <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { setPage("search"); loadMyBookings(); }}>+ Book New Flight</button>
                        </div>
                        {(() => {
                            const bk = DB.bookings.filter(b => b.userEmail === currentUser?.email).map(b => ({ ...b, flight: DB.flights.find(f => f.id === b.flightId) }));
                            if (bk.length === 0) return (
                                <div style={{ ...S.card, textAlign: "center", padding: "3rem" }}>
                                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🌍</div>
                                    <p style={{ color: "#64748b" }}>No bookings yet. Start exploring!</p>
                                    <button style={{ ...S.btn, ...S.btnPrimary, marginTop: "1rem" }} onClick={() => setPage("search")}>Search Flights</button>
                                </div>
                            );
                            return (
                                <div style={{ display: "grid", gap: "1rem" }}>
                                    {bk.map(b => (
                                        <div key={b.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{b.flight.name}</div>
                                                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{b.flight.source} → {b.flight.destination} · {b.flight.date}</div>
                                                <div style={{ fontSize: "0.75rem", color: "#a5b4fc", marginTop: "4px", fontFamily: "monospace" }}>PNR: {b.pnr}</div>
                                            </div>
                                            <span style={S.pillSuccess}>Confirmed</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </main>
        </div>
    );
}
