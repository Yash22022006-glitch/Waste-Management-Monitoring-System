import { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  BarChart3, 
  RefreshCw, 
  FileText, 
  MapPin, 
  Truck, 
  Cpu, 
  Layers, 
  Sparkles, 
  ChevronRight,
  Info
} from "lucide-react";
import { Bin, Notification, WasteLog, Collector, ModelPrediction } from "./types";

// Predefined waste samples for simulation that users can select
interface PresetSample {
  name: string;
  category: 'Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual';
  image_url: string;
  weight: number;
}

const PRESET_SAMPLES: PresetSample[] = [
  {
    name: "PET Mineral Water Bottle",
    category: "Plastic",
    image_url: "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    weight: 28
  },
  {
    name: "Crushed Soft Drink Can",
    category: "Metal",
    image_url: "https://images.unsplash.com/photo-1525498128493-380d1990a112?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    weight: 15
  },
  {
    name: "Corrugated Cardboard Box",
    category: "Paper",
    image_url: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    weight: 240
  },
  {
    name: "Discarded Banana Peel",
    category: "Organic",
    image_url: "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    weight: 110
  },
  {
    name: "Soiled Takeout Container",
    category: "Residual",
    image_url: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    weight: 75
  }
];

export default function App() {
  // Bins and notifications state
  const [bins, setBins] = useState<Bin[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loadingBins, setLoadingBins] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Active Prediction Sandbox State
  const [activeTab, setActiveTab] = useState<'camera' | 'presets'>('presets');
  const [selectedPreset, setSelectedPreset] = useState<PresetSample>(PRESET_SAMPLES[0]);
  const [predictionResult, setPredictionResult] = useState<ModelPrediction | null>(null);
  const [scanning, setScanning] = useState(false);
  const [itemWeight, setItemWeight] = useState<number>(30);
  const [actuatorState, setActuatorState] = useState<'idle' | 'scanning' | 'aligning' | 'segregated'>('idle');
  const [mechanicalAngle, setMechanicalAngle] = useState(0); // visual servo motor rotation angle

  // Camera Refs and constraints
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Interval timer for real-time telemetry polling simulation
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchBinsAndAlertsSilent();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Set default weights based on selection
  useEffect(() => {
    if (activeTab === 'presets') {
      setItemWeight(selectedPreset.weight);
    }
  }, [selectedPreset, activeTab]);

  const fetchDashboardData = async () => {
    setLoadingBins(true);
    try {
      const [binsRes, alertRes, logsRes, colRes] = await Promise.all([
        fetch("/api/bins"),
        fetch("/api/notifications"),
        fetch("/api/logs"),
        fetch("/api/collectors")
      ]);

      const binsData = await binsRes.json();
      const alertsData = await alertRes.json();
      const logsData = await logsRes.json();
      const colsData = await colRes.json();

      if (binsData.success) setBins(binsData.bins);
      if (alertsData.success) setNotifications(alertsData.notifications);
      if (logsData.success) setLogs(logsData.logs);
      if (colsData.success) setCollectors(colsData.collectors);
    } catch (e) {
      console.error("Error fetching telemetry state:", e);
    } finally {
      setLoadingBins(false);
    }
  };

  const fetchBinsAndAlertsSilent = async () => {
    try {
      const [binsRes, alertRes, logsRes] = await Promise.all([
        fetch("/api/bins"),
        fetch("/api/notifications"),
        fetch("/api/logs")
      ]);
      const binsData = await binsRes.json();
      const alertsData = await alertRes.json();
      const logsData = await logsRes.json();

      if (binsData.success) setBins(binsData.bins);
      if (alertsData.success) setNotifications(alertsData.notifications);
      if (logsData.success) setLogs(logsData.logs);
    } catch (err) {
      console.error("Background telemetry update failed:", err);
    }
  };

  const manualSync = async () => {
    setSyncing(true);
    await fetchDashboardData();
    setTimeout(() => {
      setSyncing(false);
    }, 800);
  };

  // Start Camera feed
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera permissions not granted or available:", err);
      setCameraError("Webcam not accessible inside this frame. Please use the 'Predefined Samples' gallery to simulate!");
      setActiveTab('presets');
    }
  };

  // Stop Camera Feed
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Switch tabs
  const handleTabChange = (tab: 'camera' | 'presets') => {
    setActiveTab(tab);
    if (tab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Classify Waste action
  const handleAnalyzeAndSegregate = async () => {
    setScanning(true);
    setPredictionResult(null);
    setActuatorState('scanning');
    setMechanicalAngle(0);

    try {
      let imageBase64 = "";
      let filename = "";

      if (activeTab === 'presets') {
        filename = `${selectedPreset.name}.jpg`;
        // Convert static Unsplash image to Base64 via client canvas or send image URL context proxy
        // Since CORS blocks canvas on random domains, we will fetch base64 from a helper or let server know the filename directly
        // We can generate base64 easily, or we can send the local sample attributes directly
        // Let's draw a nice pixelated block or pass a dummy image to trigger server heuristic
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = 160;
          canvas.height = 120;
          ctx.fillStyle = "#10b981";
          ctx.fillRect(0, 0, 160, 120);
          ctx.fillStyle = "#020617";
          ctx.font = "10px sans-serif";
          ctx.fillText(selectedPreset.name, 10, 60);
          imageBase64 = canvas.toDataURL("image/jpeg");
        }
      } else {
        // Use Webcam capture
        if (videoRef.current) {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, 640, 480);
            imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
            filename = "live_camera_capture.jpg";
          }
        }
      }

      // 1. Prediction API request
      const predictRes = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64, filename })
      });

      const predictData = await predictRes.json();
      if (!predictData.success) {
        throw new Error(predictData.message || "ML prediction failed");
      }

      const prediction: ModelPrediction = predictData.prediction;

      // 2. Begin Actuator Gate Alignment Animation
      setActuatorState('aligning');
      
      // Calculate a visual angle for the servo motor indicator depending on type
      const angles = {
        Plastic: -55,
        Metal: -25,
        Paper: 0,
        Organic: 35,
        Residual: 70
      };
      
      const targetAngle = angles[prediction.class] || 0;
      
      // Animate rotation steps in UI
      setTimeout(() => {
        setMechanicalAngle(targetAngle);
        setActuatorState('segregated');
        setPredictionResult(prediction);
        setScanning(false);

        // 3. Confirm segregation to physical bins inside Express server
        segregateOnServer(prediction, itemWeight);
      }, 1500);

    } catch (err) {
      console.error("Segregation routine intercepted:", err);
      alert("Verification Error: Could not reach segregation controller.");
      setScanning(false);
      setActuatorState('idle');
    }
  };

  const segregateOnServer = async (prediction: ModelPrediction, weight: number) => {
    try {
      const res = await fetch("/api/bins/segregate-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction, weight_g: weight })
      });
      const data = await res.json();
      if (data.success) {
        setBins(data.bins);
        setNotifications(data.notifications);
        // refresh log feeds
        const logRes = await fetch("/api/logs");
        const logData = await logRes.json();
        if (logData.success) setLogs(logData.logs);
      }
    } catch (e) {
      console.error("Failed to commit telemetry weights:", e);
    }
  };

  // Empty Bin Action
  const handleEmptyBin = async (binId: string) => {
    if (!confirm(`Are you sure you want to mark Bin ${binId} as emptied? This simulates physical garbage truck collection.`)) {
      return;
    }
    
    try {
      const res = await fetch("/api/bins/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bin_id: binId })
      });
      const data = await res.json();
      if (data.success) {
        setBins(prev => prev.map(b => b.bin_id === binId ? data.bin : b));
        setNotifications(data.notifications);
        manualSync();
      }
    } catch (e) {
      console.error("Bin clear failed:", e);
    }
  };

  // Resolve Alert Action
  const handleResolveAlert = async (id: string) => {
    try {
      const res = await fetch("/api/notifications/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: id })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, status: "Resolved" } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mock IoT direct telemetry injector
  const [targetBinId, setTargetBinId] = useState("BIN-001");
  const [injectorLevel, setInjectorLevel] = useState(92);
  const [injectorLoading, setInjectorLoading] = useState(false);

  const simulateIoTPayload = async () => {
    setInjectorLoading(true);
    try {
      const res = await fetch("/api/bins/update-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bin_id: targetBinId, fill_level: injectorLevel })
      });
      const data = await res.json();
      if (data.success) {
        setBins(prev => prev.map(b => b.bin_id === targetBinId ? data.updated_bin : b));
        manualSync();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInjectorLoading(false);
    }
  };

  // Math aggregates for stats
  const totalWeightRecycled = logs
    .filter(l => l.waste_type !== "Residual")
    .reduce((sum, item) => sum + item.weight_g, 0);

  const totalWasteProcessed = logs.reduce((sum, item) => sum + item.weight_g, 0);
  const diversionRate = totalWasteProcessed > 0 
    ? Math.round((totalWeightRecycled / totalWasteProcessed) * 100) 
    : 84; // Benchmark default

  // Group logs by types for SVG Bar Chart
  const logsDistribution = bins.map(b => {
    const totalG = logs.filter(l => l.waste_type === b.waste_type).reduce((s, i) => s + i.weight_g, 0);
    return { type: b.waste_type, weight: totalG };
  });

  const maxWeightDistribution = Math.max(...logsDistribution.map(d => d.weight), 1);

  return (
    <div className="min-h-screen bg-[#020d1a] text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-900 relative overflow-hidden" id="main_viewport">
      {/* Mesh Gradient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/15 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* Top Professional App Bar Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-40 transition-all duration-200" id="top_app_header">
        <div className="max-w-7xl mx-auto px-4 py-3.5 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.45)] text-white">
              <Layers className="h-5.5 w-5.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-lg text-white font-display">BinVision</span>
                <span className="text-[10px] font-mono tracking-widest bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded uppercase font-semibold">Technologies</span>
              </div>
              <p className="text-[11px] text-slate-400">Waste Segregation & Fleet Collector Operations</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-mono text-emerald-400 font-semibold">IoT Active</span>
              <span className="text-white/10">|</span>
              <span className="text-slate-400 font-mono">Gemini 3.5 Flash Inference</span>
            </div>

            <button 
              id="header_refresh_btn"
              onClick={manualSync} 
              disabled={syncing}
              className="px-3.5 py-1.5 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-all duration-150 border border-white/10 flex items-center space-x-1.5 text-xs font-semibold disabled:opacity-50 bg-white/5 backdrop-blur-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Telemetry Sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 relative z-10" id="dashboard_main_layout">
        
        {/* Core Aggregate Analytics widgets */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="stats_aggregate_grid">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4.5 flex items-center space-x-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.15)] hover:border-white/20 transition-all duration-300">
            <div className="p-3 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-xl shadow-[0_0_12px_rgba(59,130,246,0.15)]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">IoT Dustbins</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">5 / 5 Units</span>
              <span className="text-[10px] text-emerald-400 block font-mono font-medium">● Connected</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4.5 flex items-center space-x-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.15)] hover:border-white/20 transition-all duration-300">
            <div className="p-3 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Diversion Efficiency</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tracking-tight">{diversionRate}%</span>
              <span className="text-[10px] text-emerald-400 block font-mono">SDG 11 & 12 Target</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4.5 flex items-center space-x-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.15)] hover:border-white/20 transition-all duration-300">
            <div className="p-3 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-xl shadow-[0_0_12px_rgba(99,102,241,0.15)]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Auto-Sorted Weight</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">{(totalWasteProcessed / 1000).toFixed(2)} kg</span>
              <span className="text-[10px] text-indigo-400 block font-mono">Simulated history</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4.5 flex items-center space-x-3.5 shadow-[0_4px_30px_rgba(0,0,0,0.15)] hover:border-white/20 transition-all duration-300">
            <div className="p-3 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-xl shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Pending Alerts</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                {notifications.filter(n => n.status === "Unresolved").length}
              </span>
              <span className="text-[10px] text-amber-500 block font-mono">Threshold triggers</span>
            </div>
          </div>
        </section>

        {/* SECTION 1: SMART BINS MONITOR WITH REAL-TIME WATER FILL LEVEL ANIMATION */}
        <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]" id="bins_monitoring_facility">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 select-none gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-display">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]"></span>
                <span>Smart Dustbins Real-Time Telemetry</span>
              </h2>
              <p className="text-xs text-slate-300">Continuous ultrasonic level assessment of localized separation capsules</p>
            </div>
            <div className="mt-2.5 sm:mt-0 text-[11px] bg-white/10 border border-white/10 px-3 py-1 font-mono text-slate-200 rounded-lg backdrop-blur-sm">
              Updated every 5 seconds from IoT controller boards
            </div>
          </div>

          {loadingBins ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3" id="bins_loader_state">
              <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
              <span className="text-sm font-medium text-slate-300">Polling bin metrics...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5" id="smart_bins_grid">
              {bins.map((bin) => {
                // Determine styling parameters depending on waste class and status
                const isCritical = bin.fill_level >= 90;
                const isWarning = bin.fill_level >= 75 && bin.fill_level < 90;
                
                let barColor = "bg-emerald-500";
                let waveColor = "rgba(16, 185, 129, 0.15)";
                let shadowColor = "hover:border-emerald-500/40 shadow-sm";
                let textBadge = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";

                if (bin.waste_type === "Plastic") {
                  barColor = "bg-sky-500";
                  waveColor = "rgba(14, 165, 233, 0.15)";
                  textBadge = "bg-sky-500/15 text-sky-450 border-sky-500/30";
                } else if (bin.waste_type === "Metal") {
                  barColor = "bg-purple-500";
                  waveColor = "rgba(168, 85, 247, 0.15)";
                  textBadge = "bg-purple-500/15 text-purple-300 border-purple-500/30";
                } else if (bin.waste_type === "Paper") {
                  barColor = "bg-amber-500";
                  waveColor = "rgba(245, 158, 11, 0.15)";
                  textBadge = "bg-amber-500/15 text-amber-300 border-amber-500/30";
                } else if (bin.waste_type === "Organic") {
                  barColor = "bg-emerald-500";
                  waveColor = "rgba(16, 185, 129, 0.15)";
                  textBadge = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
                } else {
                  barColor = "bg-slate-500";
                  waveColor = "rgba(100, 116, 139, 0.15)";
                  textBadge = "bg-slate-500/15 text-slate-300 border-slate-500/30";
                }

                if (isCritical) {
                  barColor = "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]";
                  waveColor = "rgba(239, 68, 68, 0.25)";
                  shadowColor = "hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] border-red-500/50 ring-1 ring-red-500/20";
                  textBadge = "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse font-bold";
                } else if (isWarning) {
                  barColor = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]";
                  waveColor = "rgba(245, 158, 11, 0.2)";
                  shadowColor = "hover:border-amber-500/40 shadow-sm border-amber-500/30";
                  textBadge = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                }

                return (
                  <div 
                    key={bin.bin_id} 
                    id={`bin_card_${bin.bin_id}`}
                    className={`bg-white/5 border border-white/10 rounded-2xl p-4.5 transition-all duration-300 hover:-translate-y-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.15)] hover:bg-white/10 hover:border-white/20 relative overflow-hidden flex flex-col justify-between ${shadowColor}`}
                  >
                    {/* Tank Background wave visualization */}
                    <div 
                      className="absolute left-0 right-0 bottom-0 pointer-events-none transition-all duration-1000 ease-in-out" 
                      style={{ 
                        height: `${bin.fill_level}%`, 
                        backgroundColor: waveColor,
                      }} 
                    />

                    {/* Content */}
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-mono tracking-wider text-slate-450 block uppercase">{bin.bin_id}</span>
                          <h3 className="font-bold text-white text-base leading-none mt-1 font-display">{bin.waste_type} Bin</h3>
                        </div>
                        <span className={`text-[10px] font-medium tracking-tight px-2 py-0.5 rounded-full border ${textBadge}`}>
                          {bin.status}
                        </span>
                      </div>

                      {/* Dynamic water level tank graphic representation */}
                      <div className="w-full h-24 bg-black/40 rounded-xl border border-white/5 relative overflow-hidden flex items-end">
                        <div 
                          className={`w-full transition-all duration-1000 ease-out relative ${barColor}`}
                          style={{ height: `${bin.fill_level}%` }}
                        >
                          {/* Liquid glass light reflection */}
                          <div className="absolute top-0 left-0 right-0 h-1 bg-white/25" />
                        </div>
                        
                        {/* Centered large fluid indicator */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 mix-blend-difference">
                          <span className="text-2xl font-bold font-mono tracking-tight text-white">{bin.fill_level}%</span>
                          <span className="text-[9px] text-gray-300 font-mono">{(bin.capacity_kg * bin.fill_level / 100).toFixed(1)} / {bin.capacity_kg} kg</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center text-slate-300">
                          <MapPin className="h-3 w-3 shrink-0 mr-1.5 text-slate-400" />
                          <span className="truncate" title={bin.location}>{bin.location}</span>
                        </div>
                        <div className="flex items-center text-slate-400 text-[10px]">
                          <span>Telemetry: {new Date(bin.last_updated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</span>
                        </div>
                      </div>
                    </div>

                    {/* Operational action trigger */}
                    <div className="relative z-10 pt-4 mt-2 border-t border-white/10">
                      <button
                        align-id={`empty_trigger_${bin.bin_id}`}
                        onClick={() => handleEmptyBin(bin.bin_id)}
                        className={`w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border uppercase tracking-wider font-mono hover:scale-[1.02] active:scale-[0.98] ${
                          isCritical 
                            ? 'bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]' 
                            : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/15'
                        }`}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Empty Bin</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 2: THE Segregator simulation AND IoT PLAYGROUND */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="interactive_arenas_wrapper">
          
          {/* LEFT: AI Waste Classification Camera Arena (Column: 7) */}
          <div className="lg:col-span-7 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 md:p-6 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.2)]" id="ai_classification_sandbox">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 select-none">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-display">
                    <Sparkles className="h-5 w-5 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)] animate-pulse" />
                    <span>AI Waste Recognition & Conveyor Gate Arena</span>
                  </h2>
                  <p className="text-xs text-slate-300">Simulate placing waste into the smart dustbin and watch the neural network segregate it</p>
                </div>
                
                {/* Method Tabs */}
                <div className="bg-black/35 p-0.5 rounded-xl border border-white/10 flex backdrop-blur-sm shadow-inner">
                  <button 
                    onClick={() => handleTabChange('presets')}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'presets' ? 'bg-white/10 text-white border border-white/10 shadow-[0_2px_8px_rgba(255,255,255,0.05)]' : 'text-slate-400 hover:text-white'}`}
                  >
                    Preset Samples
                  </button>
                  <button 
                    onClick={() => handleTabChange('camera')}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'camera' ? 'bg-white/10 text-white border border-white/10 shadow-[0_2px_8px_rgba(255,255,255,0.05)]' : 'text-slate-400 hover:text-white'}`}
                  >
                    Webcam Mode
                  </button>
                </div>
              </div>

              {/* TAB 1: Preset Gallery Pickers */}
              {activeTab === 'presets' && (
                <div className="space-y-4" id="samples_tabs_panel">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" id="sample_items_grid">
                    {PRESET_SAMPLES.map((sample) => {
                      const isSelected = selectedPreset.name === sample.name;
                      return (
                        <button
                          key={sample.name}
                          id={`preset_btn_${sample.category}`}
                          onClick={() => {
                            setSelectedPreset(sample);
                            setPredictionResult(null);
                            setActuatorState('idle');
                          }}
                          className={`flex flex-col text-left p-2 rounded-xl transition-all border outline-none group text-xs cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/20' 
                              : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                          }`}
                        >
                          <img 
                            src={sample.image_url} 
                            alt={sample.name} 
                            className="w-full h-16 rounded-lg object-cover mb-2 border border-white/10 group-hover:opacity-90"
                            referrerPolicy="no-referrer"
                          />
                          <span className={`font-semibold block truncate transition-colors ${isSelected ? 'text-emerald-400' : 'text-gray-200'}`}>{sample.name}</span>
                          <span className="text-[10px] text-slate-300 mt-0.5">{sample.category} • {sample.weight}g</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center border border-white/10 bg-black/45 rounded-2xl overflow-hidden p-4 space-y-4 sm:space-y-0 sm:space-x-4 shadow-inner">
                    <img 
                      src={selectedPreset.image_url} 
                      alt="Selected item" 
                      className="w-full sm:w-44 h-32 rounded-xl object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 space-y-2.5 w-full">
                      <div>
                        <span className="text-[9px] font-mono font-semibold uppercase bg-white/10 px-2.5 py-0.5 rounded text-gray-200 border border-white/5">Active Test Payload</span>
                        <h4 className="font-bold text-white text-base mt-1.5 font-display">{selectedPreset.name}</h4>
                        <p className="text-xs text-slate-300">Standard material class: <span className="font-semibold text-white">{selectedPreset.category}</span></p>
                      </div>

                      {/* Weight Config for simulation */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-slate-300">Simulation Object Weight</span>
                          <span className="text-emerald-400 font-semibold">{itemWeight} kg (grams equivalence)</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="800" 
                          value={itemWeight}
                          onChange={(e) => setItemWeight(parseInt(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5 bg-white/5 rounded-lg cursor-pointer border border-white/5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Camera Live Stream View */}
              {activeTab === 'camera' && (
                <div className="space-y-4" id="webcam_tabs_panel">
                  {cameraError ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start space-x-3 text-xs text-amber-300">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      <div>
                        <span className="font-semibold block mb-0.5">Hardware Constraints Enabled</span>
                        <p>{cameraError}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden aspect-video border border-white/10 bg-black/50 flex flex-col items-center justify-center shadow-inner">
                      <video 
                        ref={videoRef} 
                        className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                      />
                      
                      {!cameraActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-10">
                          <div className="p-4 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                            <Camera className="h-8 w-8 animate-pulse text-emerald-400" />
                          </div>
                          <span className="text-xs text-slate-300">Access webcam device stream</span>
                          <button 
                            onClick={startCamera} 
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition duration-150 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                          >
                            Enable Camera
                          </button>
                        </div>
                      )}

                      {cameraActive && (
                        <div className="absolute bottom-4 left-4 z-20 flex items-center space-x-2 bg-black/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-[10px]">
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                          <span className="font-mono text-gray-200">LIVE FEED</span>
                        </div>
                      )}
                    </div>
                  )}

                  {cameraActive && (
                    <div className="space-y-2 bg-black/45 p-4 border border-white/5 rounded-2xl">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-300">Simulate Object Weight</span>
                        <span className="text-emerald-400 font-semibold">{itemWeight} grams</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="800" 
                        value={itemWeight}
                        onChange={(e) => setItemWeight(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 h-1.5 bg-white/5 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Control Center and Prediction triggers */}
            <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between border-t border-white/10 pt-6 gap-4">
              
              {/* Actuator motor routing visual indicator */}
              <div className="flex items-center space-x-3.5 bg-black/40 border border-white/10 p-3.5 rounded-2xl w-full md:w-auto">
                {/* Servo Dial Illustration */}
                <div className="h-14 w-14 bg-black/60 rounded-full border border-white/10 relative flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {/* Angle Marks */}
                  <div className="absolute inset-1 border border-dotted border-white/10 rounded-full" />
                  
                  {/* Animated Servo Pointer */}
                  <div 
                    className="absolute w-1 h-7 bg-emerald-400 rounded-full bottom-1/2 left-[calc(50%-2px)] origin-bottom transition-transform duration-1000 ease-out shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    style={{ transform: `rotate(${mechanicalAngle}deg)` }}
                  />
                  {/* Center Hub */}
                  <div className="h-3 w-3 bg-white rounded-full z-10 border border-slate-900" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono font-medium">ESP32 Actuator Gate</span>
                  <span className="text-xs font-bold text-white block uppercase font-display">
                    {actuatorState === 'idle' && 'Servo Dormant (0°)'}
                    {actuatorState === 'scanning' && 'Scanning Object...'}
                    {actuatorState === 'aligning' && `Aligning: ${mechanicalAngle}°`}
                    {actuatorState === 'segregated' && `Locked at ${mechanicalAngle}°`}
                  </span>
                  <span className="text-[9px] text-slate-400 block line-clamp-1 italic">
                    {actuatorState === 'segregated' ? 'Pneumatic divert complete' : 'Ready for test item'}
                  </span>
                </div>
              </div>

              {/* Fire pred action */}
              <button
                onClick={handleAnalyzeAndSegregate}
                disabled={scanning || (activeTab === 'camera' && !cameraActive)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:bg-white/5 disabled:border-white/5 disabled:text-slate-500 font-bold px-6 py-4 rounded-xl transition-all duration-150 shadow-[0_0_20px_rgba(16,185,129,0.35)] flex items-center justify-center space-x-2 text-sm uppercase cursor-pointer tracking-wider hover:scale-[1.02] active:scale-[0.98]"
              >
                {scanning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing Waste...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="h-4 w-4" />
                    <span>Analyze & Segregate</span>
                  </>
                )}
              </button>
            </div>

            {/* Prediction Output Overlay Sheet */}
            {predictionResult && (
              <div className="mt-5 bg-gradient-to-r from-emerald-500/15 to-indigo-500/15 border border-emerald-500/35 backdrop-blur-md rounded-2xl p-4.5 animate-fadeIn shadow-[0_4px_24px_rgba(0,0,0,0.15)]">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-semibold flex items-center space-x-1">
                      <Sparkles className="h-3 w-3 shrink-0 inline mr-1 text-emerald-400 animate-pulse" />
                      <span>Inference Classification Completed</span>
                    </span>
                    <h4 className="text-xl font-bold text-white mt-1 uppercase tracking-tight font-display">{predictionResult.class} Category</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-350 font-medium">Confidence Met</span>
                    <span className="block text-xl font-mono font-bold text-emerald-300">{(predictionResult.confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-mono text-[10px] block uppercase">Physical Actuator Instruction</span>
                    <p className="font-semibold text-white mt-1 flex items-center">
                      <ChevronRight className="h-3 w-3 text-emerald-400 mr-1.5 shrink-0" />
                      {predictionResult.segregation_instruction}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-mono text-[10px] block uppercase">Eco Impact Fact</span>
                    <p className="text-slate-300 mt-1 leading-relaxed bg-black/35 p-2.5 rounded-xl border border-white/5 flex items-start shadow-inner">
                      <Info className="h-4.5 w-4.5 text-indigo-400 mr-1.5 shrink-0 mt-0.5" />
                      <span>{predictionResult.fun_recycling_fact}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Webhook Injector, Fleet collectors, active alerts feed (Column: 5) */}
          <div className="lg:col-span-5 space-y-6" id="dashboard_telemetry_sidebar">
            
            {/* 1. IoT Simulation Webhook Console */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)]" id="iot_sensor_webhook_simulator">
              <h2 className="text-sm font-bold text-slate-200 select-none flex items-center space-x-1.5 uppercase tracking-wider font-display">
                <Cpu className="h-4 w-4 text-indigo-400" />
                <span>ESP32 Physical IoT Webhook Simulator</span>
              </h2>
              <p className="text-xs text-slate-350 mt-0.5">Emulate raw Ultrasonic payload triggers sent directly from edge microcontrollers to the service database</p>

              <div className="mt-4 grid grid-cols-2 gap-3" id="webhook_inputs_grid">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-300 uppercase font-semibold">Target Device</label>
                  <select 
                    value={targetBinId} 
                    onChange={(e) => setTargetBinId(e.target.value)}
                    className="w-full bg-black/45 text-white rounded-xl border border-white/10 p-2.5 text-xs focus:outline-none focus:border-indigo-500/50"
                  >
                    {bins.map(b => (
                      <option key={b.bin_id} value={b.bin_id} className="bg-[#020d1a]">{b.bin_id} ({b.waste_type})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-300 uppercase font-semibold">Sensor Fill Level (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={injectorLevel} 
                    onChange={(e) => setInjectorLevel(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full bg-black/45 text-white rounded-xl border border-white/10 p-2.5 text-xs text-center font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* cURL Display */}
              <div className="mt-3 bg-black/35 p-2.5 rounded-xl border border-white/5 text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-nowrap">
                <span>POST /api/bins/update-fill</span>
                <span className="text-indigo-400 font-bold text-right block pr-1">Content: {"{"}"bin_id": "{targetBinId}", "fill_level": {injectorLevel}{"}"}</span>
              </div>

              <button
                onClick={simulateIoTPayload}
                disabled={injectorLoading}
                className="w-full mt-3.5 bg-indigo-650/80 hover:bg-indigo-600 text-white hover:scale-[1.01] active:scale-[0.99] border border-indigo-500/35 font-semibold text-xs py-2.5 px-4 rounded-xl shadow-[0_0_12px_rgba(99,102,241,0.2)] transition-all flex items-center justify-center space-x-1.5 uppercase tracking-wider font-mono cursor-pointer"
              >
                {injectorLoading ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : <Layers className="h-4.5 w-4.5" />}
                <span>Transmit IoT Webhook</span>
              </button>
            </div>

            {/* 2. Fleet Collector Dispatch Logs */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)]" id="fleet_operational_drivers">
              <h2 className="text-sm font-bold text-slate-200 select-none flex items-center space-x-1.5 uppercase tracking-wider font-display">
                <Truck className="h-4 w-4 text-emerald-400" />
                <span>Active Sustainability Fleet Collectors</span>
              </h2>
              <p className="text-xs text-slate-350 mt-0.5">Municipal garbage trucks assigned for smart routing collection</p>

              <div className="mt-4 space-y-3" id="collectors_fleet_list">
                {collectors.map((col) => {
                  return (
                    <div key={col.id} className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center justify-between text-xs hover:bg-white/10 hover:border-white/10 transition-all">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 flex items-center justify-center">
                          <Truck className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white">{col.name}</span>
                            <span className="text-[9px] font-mono text-slate-400 uppercase">{col.id}</span>
                          </div>
                          <span className="text-[10px] text-slate-300 block mt-0.5">{col.vehicle_no} • {col.contact}</span>
                        </div>
                      </div>

                      <span className={`text-[9px] font-semibold font-mono uppercase px-2.5 py-1 rounded border ${
                        col.status === 'Idle' ? 'bg-white/5 border-white/10 text-slate-400' :
                        col.status === 'En Route' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                        'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      }`}>
                        {col.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Real-Time System alerts/notifications */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 flex flex-col justify-between max-h-[350px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]" id="realtime_system_alerts">
              <div>
                <h3 className="text-sm font-bold text-slate-200 select-none flex items-center space-x-1.5 uppercase tracking-wider font-display">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                  <span>Structural Alerts & Notifications Feed</span>
                </h3>
                <p className="text-xs text-slate-350 mt-0.5">Automated threshold triggers, sensor violations, and pickup schedule logs</p>
              </div>

              <div className="mt-4 overflow-y-auto pr-1 space-y-2.5 flex-1 max-h-[200px]" id="notifications_feed_list">
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-slate-450 text-xs italic">
                    No active system alerts detected. Bins are clear.
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isHigh = notif.priority === "High";
                    const isResolved = notif.status === "Resolved";
                    return (
                      <div 
                        key={notif.notification_id} 
                        className={`p-3 rounded-2xl border text-xs space-y-2 select-none transition-all ${
                          isResolved 
                            ? 'bg-white/5 border-white/5 opacity-50' 
                            : isHigh 
                              ? 'bg-red-500/10 border-red-500/40 shadow-sm shadow-red-500/5' 
                              : 'bg-amber-500/10 border-amber-500/30 font-medium'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="space-y-1">
                            <p className={`font-semibold leading-relaxed ${isResolved ? 'text-slate-500 line-through' : 'text-gray-105'}`}>
                              {notif.message}
                            </p>
                            {notif.assigned_to && (
                              <div className="flex items-center text-[10px] text-emerald-400 font-mono font-semibold">
                                <Truck className="h-3.5 w-3.5 mr-1" />
                                <span>Driver Active: {notif.assigned_to}</span>
                              </div>
                            )}
                          </div>
                          
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded text-white font-bold uppercase shrink-0 ${
                            isResolved ? 'bg-white/10 text-slate-300 border border-white/5' : isHigh ? 'bg-red-500' : 'bg-amber-500'
                          }`}>
                            {notif.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] border-t border-white/10 pt-2 text-slate-400">
                          <span>{new Date(notif.timestamp).toLocaleString()}</span>
                          {!isResolved && (
                            <button
                              onClick={() => handleResolveAlert(notif.notification_id)}
                              className="text-emerald-400 hover:text-emerald-300 font-semibold uppercase font-mono tracking-wider text-[9px] cursor-pointer"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 3: ANALYTICS VISUALIZATION INDEX & HISTORY LOGS (Full Grid) */}
        <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]" id="analytics_overview_logs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* L: SVG Interactive Recycling Weights Graph (Col: 6) */}
            <div className="lg:col-span-6 space-y-4" id="visual_recharging_chart">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-1.5 font-display">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                  <span>Segregated Material Composition by Weight</span>
                </h3>
                <p className="text-xs text-slate-350">Aggregated weight measurements parsed across simulated separation logs</p>
              </div>

              {/* Custom SVG Responsive Bar Chart */}
              <div className="bg-black/35 p-5 border border-white/10 rounded-2xl shadow-inner">
                <svg viewBox="0 0 500 240" className="w-full h-auto text-xs" id="svg_graph_grid">
                  {/* Axis Grid lines */}
                  <line x1="50" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="50" y1="70" x2="480" y2="70" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="50" y1="120" x2="480" y2="120" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="50" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="50" y1="210" x2="480" y2="210" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

                  {/* Y Axis Labels */}
                  <text x="15" y="25" fill="#94a3b8" className="font-mono text-[9px]">100%</text>
                  <text x="15" y="75" fill="#94a3b8" className="font-mono text-[9px]">75%</text>
                  <text x="15" y="125" fill="#94a3b8" className="font-mono text-[9px]">50%</text>
                  <text x="15" y="175" fill="#94a3b8" className="font-mono text-[9px]">25%</text>
                  <text x="15" y="215" fill="#94a3b8" className="font-mono text-[9px]">0%</text>

                  {/* Render Columns */}
                  {logsDistribution.map((item, index) => {
                    const colWidth = 45;
                    const spacing = 80;
                    const x = 70 + index * spacing;
                    
                    // Height proportion
                    const maxColHeight = 185;
                    const colHeight = Math.max(12, Math.round((item.weight / maxWeightDistribution) * maxColHeight));
                    const y = 210 - colHeight;

                    // Bar coloring
                    let fill = "#10b981";
                    if (item.type === "Plastic") fill = "#0ea5e9";
                    else if (item.type === "Metal") fill = "#a855f7";
                    else if (item.type === "Paper") fill = "#f59e0b";
                    else if (item.type === "Organic") fill = "#10b981";
                    else fill = "#64748b";

                    return (
                      <g key={item.type}>
                        {/* Hover Tooltip/Title helper on rect */}
                        <title>{`${item.type}: ${(item.weight / 1000).toFixed(2)} kg`}</title>
                        <rect 
                          x={x} 
                          y={y} 
                          width={colWidth} 
                          height={colHeight} 
                          rx="6" 
                          fill={fill} 
                          className="transition-all duration-500 hover:opacity-85 cursor-pointer" 
                        />
                        <text x={x + colWidth/2} y={y - 6} textAnchor="middle" fill="#f1f5f9" className="font-mono text-[10px] font-bold">
                          {item.weight >= 1000 ? `${(item.weight / 1000).toFixed(1)}k` : `${item.weight}g`}
                        </text>
                        {/* X Axis label */}
                        <text x={x + colWidth/2} y={226} textAnchor="middle" fill="#cbd5e1" className="font-semibold text-[9px]">
                          {item.type}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="flex justify-center items-center space-x-4 mt-2 select-none text-[10px] text-slate-300">
                  <div className="flex items-center"><span className="h-2 w-2 rounded bg-sky-500 mr-1.5" /> Plastic</div>
                  <div className="flex items-center"><span className="h-2 w-2 rounded bg-purple-500 mr-1.5" /> Metal</div>
                  <div className="flex items-center"><span className="h-2 w-2 rounded bg-amber-500 mr-1.5" /> Paper</div>
                  <div className="flex items-center"><span className="h-2 w-2 rounded bg-emerald-500 mr-1.5" /> Organic</div>
                  <div className="flex items-center"><span className="h-2 w-2 rounded bg-slate-500 mr-1.5" /> Residual</div>
                </div>
              </div>
            </div>

            {/* R: Recent Segregation Log list (Col: 6) */}
            <div className="lg:col-span-6 space-y-4" id="waste_logs_history_widget">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white flex items-center space-x-1.5 font-display">
                  <FileText className="h-5 w-5 text-indigo-400" />
                  <span>Real-Time Segregation Chronology Log</span>
                </h3>
                <span className="text-[10px] font-mono tracking-tighter bg-white/10 border border-white/10 text-slate-200 px-2.5 py-0.5 rounded font-semibold">
                  {logs.length} Total Events
                </span>
              </div>

              {/* Transactions List */}
              <div className="bg-black/30 rounded-2xl border border-white/10 max-h-[240px] overflow-y-auto p-2 shadow-inner" id="logs_container">
                {logs.length === 0 ? (
                  <p className="p-10 text-center text-xs text-slate-400 italic">No historical transactions sorted.</p>
                ) : (
                  <div className="space-y-1.5">
                    {logs.map((log) => {
                      let tagColor = "border-sky-500 text-sky-400 bg-sky-500/5";
                      if (log.waste_type === "Plastic") tagColor = "border-sky-500/30 text-sky-300 bg-sky-500/10";
                      else if (log.waste_type === "Metal") tagColor = "border-purple-500/30 text-purple-300 bg-purple-500/15";
                      else if (log.waste_type === "Paper") tagColor = "border-amber-500/30 text-amber-300 bg-amber-500/10";
                      else if (log.waste_type === "Organic") tagColor = "border-emerald-500/30 text-emerald-300 bg-emerald-500/10";
                      else tagColor = "border-slate-550/30 text-slate-300 bg-slate-500/10";

                      return (
                        <div 
                          key={log.id} 
                          id={`log_item_${log.id}`}
                          className="p-3 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-xl flex items-center justify-between text-xs transition duration-150"
                        >
                          <div className="flex items-center space-x-3">
                            <span className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded border ${tagColor}`}>
                              {log.waste_type}
                            </span>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-white">{log.id}</span>
                                <span className="text-[10px] text-slate-350 font-mono font-medium">{(log.confidence * 100).toFixed(0)}% Match</span>
                              </div>
                              <span className="text-[10px] text-slate-300 block truncate max-w-[200px] sm:max-w-xs">{log.instruction}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono text-slate-100 font-bold block">{log.weight_g}g</span>
                            <span className="text-[9px] text-slate-400 block">
                              {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* Sustainable Smart City Footnote Banner */}
      <footer className="border-t border-white/10 bg-white/5 backdrop-blur-md py-6 text-center text-xs text-slate-450 relative select-none mt-12 z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.1)]" id="footer_footnote">
        <p>© 2026 BinVision Technologies. Supporting UN SDGs 11 (Sustainable Cities), 12 (Responsible Consumption & Production) & 13 (Climate Action).</p>
        <p className="mt-1 font-mono text-[10px] text-slate-500">Enterprise IoT Stack Firmware V4.1.20-Chennai-Sector3</p>
      </footer>
    </div>
  );
}
