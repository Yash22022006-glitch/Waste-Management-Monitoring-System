import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Gemini SDK lazily if Key exists
let aiClient: GoogleGenAI | null = null;
const API_KEY = process.env.GEMINI_API_KEY;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && API_KEY && API_KEY !== "MY_GEMINI_API_KEY" && API_KEY.trim() !== "") {
    try {
      aiClient = new GoogleGenAI({
        apiKey: API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      console.log("Successfully initialized Gemini SDK for AI Waste Segregation.");
    } catch (err) {
      console.error("Failed to initialize Gemini SDK:", err);
    }
  }
  return aiClient;
}

// Interfaces
import { Bin, Notification, WasteLog, Collector, ModelPrediction } from "./src/types";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body size limit to support rich base64 image uploads from camera
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // Shared Server State (In-Memory Database)
  let bins: Bin[] = [
    {
      bin_id: "BIN-001",
      waste_type: "Plastic",
      fill_level: 45,
      status: "Normal",
      location: "Building A - Ground Floor Chute",
      capacity_kg: 50,
      last_updated: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    },
    {
      bin_id: "BIN-002",
      waste_type: "Metal",
      fill_level: 18,
      status: "Normal",
      location: "Building A - Ground Floor Chute",
      capacity_kg: 75,
      last_updated: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      bin_id: "BIN-003",
      waste_type: "Paper",
      fill_level: 85,
      status: "Almost Full",
      location: "Building B - Library Lobby",
      capacity_kg: 40,
      last_updated: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      bin_id: "BIN-004",
      waste_type: "Organic",
      fill_level: 32,
      status: "Normal",
      location: "Cafeteria - Food Prep Bay",
      capacity_kg: 60,
      last_updated: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      bin_id: "BIN-005",
      waste_type: "Residual",
      fill_level: 68,
      status: "Normal",
      location: "Building A - Ground Floor Chute",
      capacity_kg: 80,
      last_updated: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
  ];

  let collectors: Collector[] = [
    {
      id: "COL-001",
      name: "Rajesh Kumar",
      status: "Idle",
      contact: "+91 98765 43210",
      vehicle_no: "TN-07-BY-1234",
    },
    {
      id: "COL-002",
      name: "Priya Nair",
      status: "En Route",
      contact: "+91 98123 45678",
      vehicle_no: "TN-07-CZ-5678",
    },
    {
      id: "COL-003",
      name: "Amit Patel",
      status: "Busy",
      contact: "+91 99456 78901",
      vehicle_no: "TN-07-DA-9012",
    },
  ];

  let notifications: Notification[] = [
    {
      notification_id: "NOT-001",
      message: "Bin-003 (Paper) has reached 85% fill level. Collector alerted.",
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      bin_id: "BIN-003",
      assigned_to: "Priya Nair (En Route)",
      status: "Unresolved",
      priority: "Medium",
    },
    {
      notification_id: "NOT-002",
      message: "Bin-004 (Organic) was successfully emptied by Rajesh Kumar.",
      timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      bin_id: "BIN-004",
      assigned_to: "Rajesh Kumar",
      status: "Resolved",
      priority: "Low",
    },
    {
      notification_id: "NOT-003",
      message: "Metal Sensor Alert: Non-recyclable composite found in Metal Chute. Refused redirection.",
      timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      bin_id: "BIN-002",
      status: "Resolved",
      priority: "Low",
    }
  ];

  // Past 7 Days Historical Data
  let wasteLogs: WasteLog[] = [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Seed historical segregation events
  const wasteTypes: ('Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual')[] = [
    "Plastic", "Metal", "Paper", "Organic", "Residual"
  ];
  const weights = { Plastic: 45, Metal: 120, Paper: 80, Organic: 250, Residual: 180 };
  const instructions = {
    Plastic: "Direct servo 45deg to Plastic recycling silo",
    Metal: "Activate pneumatic sweep left to metal chute",
    Paper: "Direct servo 90deg to paper press compactor",
    Organic: "Open base trapdoor to biometric digester",
    Residual: "Maintain direct fall vertical to incinerator stack"
  };

  // Generate 40 historical entries across past 7 days
  for (let i = 0; i < 40; i++) {
    const dayOffset = Math.floor(i / 6); // 0 to 6 days ago
    const hour = 8 + (i % 6) * 2; // daytime hours
    const date = new Date(Date.now() - 1000 * 60 * 60 * 24 * dayOffset);
    date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

    const type = wasteTypes[Math.floor(Math.random() * wasteTypes.length)];
    wasteLogs.push({
      id: `LOG-${1000 + i}`,
      timestamp: date.toISOString(),
      waste_type: type,
      confidence: parseFloat((0.82 + Math.random() * 0.17).toFixed(2)),
      instruction: instructions[type],
      weight_g: Math.round(weights[type] * (0.6 + Math.random() * 0.8)),
    });
  }

  // Helper helper to update stats & check threshold alerts
  const checkAggregates = (bin: Bin) => {
    if (bin.fill_level >= 90) {
      bin.status = "Full";
      // Trigger notification if not already notified
      const exists = notifications.some(
        n => n.bin_id === bin.bin_id && n.status === "Unresolved" && n.message.includes("Full")
      );
      if (!exists) {
        // Assign a collector
        const idleCollector = collectors.find(c => c.status === "Idle") || collectors[0];
        idleCollector.status = "En Route";

        notifications.unshift({
          notification_id: `NOT-${Date.now()}`,
          message: `CRITICAL ALERT: Bin ${bin.bin_id} (${bin.waste_type}) is critically full (${bin.fill_level}%). Immediate pickup required.`,
          timestamp: new Date().toISOString(),
          bin_id: bin.bin_id,
          assigned_to: `${idleCollector.name} (En Route)`,
          status: "Unresolved",
          priority: "High",
        });
      }
    } else if (bin.fill_level >= 75) {
      bin.status = "Almost Full";
    } else if (bin.fill_level > 5) {
      bin.status = "Normal";
    } else {
      bin.status = "Empty";
    }
  };

  // 1. API Endpoints
  app.get("/api/bins", (req, res) => {
    res.json({ success: true, bins });
  });

  app.get("/api/collectors", (req, res) => {
    res.json({ success: true, collectors });
  });

  app.get("/api/notifications", (req, res) => {
    res.json({ success: true, notifications });
  });

  app.get("/api/logs", (req, res) => {
    // Return sorted waste logs
    const sorted = [...wasteLogs].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json({ success: true, logs: sorted });
  });

  // Resolve Alert Notification
  app.post("/api/notifications/resolve", (req, res) => {
    const { notification_id } = req.body;
    const item = notifications.find(n => n.notification_id === notification_id);
    if (item) {
      item.status = "Resolved";
      return res.json({ success: true, notification: item });
    }
    res.status(404).json({ success: false, message: "Alert not found." });
  });

  // IoT sensor webhook simulation (Simulating Ultrasonic readings from ESP32)
  app.post("/api/bins/update-fill", (req, res) => {
    const { bin_id, fill_level } = req.body;
    
    if (bin_id === undefined || fill_level === undefined) {
      return res.status(400).json({ success: false, message: "Missing bin_id or fill_level" });
    }

    const numericLevel = parseInt(fill_level, 10);
    if (isNaN(numericLevel) || numericLevel < 0 || numericLevel > 100) {
      return res.status(400).json({ success: false, message: "fill_level must be between 0 and 100" });
    }

    const binIndex = bins.findIndex(b => b.bin_id === bin_id);
    if (binIndex === -1) {
      return res.status(404).json({ success: false, message: "Bin not found" });
    }

    bins[binIndex].fill_level = numericLevel;
    bins[binIndex].last_updated = new Date().toISOString();
    checkAggregates(bins[binIndex]);

    res.json({
      success: true,
      message: "IoT payload processed",
      updated_bin: bins[binIndex]
    });
  });

  // Clear / Empty a bin (Garbage pickup request)
  app.post("/api/bins/clear", (req, res) => {
    const { bin_id } = req.body;
    const binIndex = bins.findIndex(b => b.bin_id === bin_id);
    
    if (binIndex === -1) {
      return res.status(404).json({ success: false, message: "Bin not found" });
    }

    const bin = bins[binIndex];
    const previousFill = bin.fill_level;
    
    bin.fill_level = 0;
    bin.status = "Empty";
    bin.last_updated = new Date().toISOString();

    // Mark current active unresolved alerts for this bin as resolved
    notifications.forEach(n => {
      if (n.bin_id === bin_id && n.status === "Unresolved") {
        n.status = "Resolved";
      }
    });

    // Reset collector workloads if any
    collectors.forEach(c => {
      if (c.status === "En Route") c.status = "Idle";
    });

    const newNotification: Notification = {
      notification_id: `NOT-${Date.now()}`,
      message: `Scheduled Collection complete: Bin ${bin_id} (${bin.waste_type}) emptied. Cleaned: ${previousFill}% capacity.`,
      timestamp: new Date().toISOString(),
      bin_id: bin_id,
      status: "Resolved",
      priority: "Low"
    };
    notifications.unshift(newNotification);

    res.json({
      success: true,
      message: "Collection marked as complete. Bin cleared to 0%.",
      bin,
      notifications
    });
  });

  // AI Classification API Handler using server-side Gemini SDK or fallback
  app.post("/api/predict", async (req, res) => {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: "Missing base64 image data" });
    }

    // Clean base64 header if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const client = getGeminiClient();

    if (client) {
      console.log("Processing base64 with genuine Gemini API model 'gemini-3.5-flash'...");
      try {
        const prompt = "Analyze the item in this image. Classify it as one of these standard segregation categories: " +
          "Plastic, Metal, Paper, Organic, or Residual. Also assign a confidence index (0-1.0), and write a short technical actuator direction command (e.g. 'Redirect servo right 45deg to Plastic sorting chute') and a short educational fact about recycling this type of item.";

        const imagePart = {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data,
          },
        };

        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            { text: prompt },
            imagePart
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                class: {
                  type: Type.STRING,
                  description: "Must be exactly one of: Plastic, Metal, Paper, Organic, Residual",
                },
                confidence: {
                  type: Type.NUMBER,
                  description: "Confidence percentage represented as scalar (e.g. 0.95)",
                },
                segregation_instruction: {
                  type: Type.STRING,
                  description: "A hardware-friendly instruction line for microcontrollers/servos",
                },
                fun_recycling_fact: {
                  type: Type.STRING,
                  description: "An inspiring sustainability nugget or statistic",
                },
              },
              required: ["class", "confidence", "segregation_instruction"],
            },
          },
        });

        const textOutput = response.text;
        if (textOutput) {
          const parsed: ModelPrediction = JSON.parse(textOutput.trim());
          
          // Match capitalization
          const mappedClass = parsed.class.charAt(0).toUpperCase() + parsed.class.slice(1).toLowerCase();
          const validClasses = ["Plastic", "Metal", "Paper", "Organic", "Residual"];
          let finalClass: 'Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual' = "Residual";
          if (validClasses.includes(mappedClass)) {
            finalClass = mappedClass as any;
          }

          const responseData: ModelPrediction = {
            class: finalClass,
            confidence: parsed.confidence || 0.94,
            segregation_instruction: parsed.segregation_instruction || `Actuate step gear clockwise to ${finalClass} channel`,
            fun_recycling_fact: parsed.fun_recycling_fact || "Recycling helps avoid greenhouse emission scales.",
          };

          return res.json({ success: true, prediction: responseData, source: "live-gemini-model" });
        }
      } catch (err: any) {
        console.error("Gemini live call error, falling back to simulated inference. Error:", err?.message || err);
        // Fall back to robust simulation mock described below
      }
    } else {
      console.log("No valid GEMINI_API_KEY detected. Utilizing preloaded model heuristics for local simulations.");
    }

    // Smart simulated inference fallback based on files/names or pure probability
    const filenameLower = (filename || "").toLowerCase();
    let predictedType: 'Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual' = "Residual";
    let explanationMsg = "";
    let recyclingFact = "";

    if (filenameLower.includes("bottle") || filenameLower.includes("plastic") || filenameLower.includes("pet")) {
      predictedType = "Plastic";
      explanationMsg = "Direct servo angle 35 degrees left (Plastic Chute)";
      recyclingFact = "Recycling 1 ton of plastic saves 5,774 kWh of energy and 16.3 barrels of oil!";
    } else if (filenameLower.includes("can") || filenameLower.includes("soda") || filenameLower.includes("metal") || filenameLower.includes("tin") || filenameLower.includes("aluminum")) {
      predictedType = "Metal";
      explanationMsg = "Deploy pneumatic sweep left to Metal Collection Bay";
      recyclingFact = "Aluminum cans can be recycled and back on grocery sheves in as little as 60 days!";
    } else if (filenameLower.includes("paper") || filenameLower.includes("box") || filenameLower.includes("card") || filenameLower.includes("news")) {
      predictedType = "Paper";
      explanationMsg = "Direct servo angle 90 degrees center (Paper Press Block)";
      recyclingFact = "Recycling 1 ton of paper saves 17 trees, 7,000 gallons of water, and 3 cubic yards of landfill space.";
    } else if (filenameLower.includes("fruit") || filenameLower.includes("apple") || filenameLower.includes("food") || filenameLower.includes("banana") || filenameLower.includes("organic") || filenameLower.includes("leaf")) {
      predictedType = "Organic";
      explanationMsg = "Retract solenoid door trap vertically (Biocomposter Pit)";
      recyclingFact = "Organic waste in composting facilities naturally generates nitrogen-rich nutrients and curbs methane!";
    } else {
      // Pick a random smart category
      const rndIndex = Math.floor(Math.random() * 5);
      const types: ('Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual')[] = ["Plastic", "Metal", "Paper", "Organic", "Residual"];
      predictedType = types[rndIndex];
      const itemsInstructions = {
        Plastic: "Direct servo angle 35 degrees left (Plastic Chute)",
        Metal: "Deploy pneumatic sweep left to Metal Collection Bay",
        Paper: "Direct servo angle 90 degrees center (Paper Press Block)",
        Organic: "Retract solenoid door trap vertically (Biocomposter Pit)",
        Residual: "Open central drop panel (Residual Thermal Stack)"
      };
      const facts = {
        Plastic: "Plastic products take up to 1000 years to decompose in landfills.",
        Metal: "Recycling steel saves 74% of the energy needed to produce virgin steel from ore.",
        Paper: "Nearly 67% of paper used in public offices is recycled every single year.",
        Organic: "Composting food waste prevents landfills from letting anaerobic bacteria emit heavy CO2.",
        Residual: "Residual items must be handled safely to protect municipal ecosystems."
      };
      explanationMsg = itemsInstructions[predictedType];
      recyclingFact = facts[predictedType];
    }

    const dummyPrediction: ModelPrediction = {
      class: predictedType,
      confidence: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)),
      segregation_instruction: explanationMsg,
      fun_recycling_fact: recyclingFact
    };

    // Fast reply
    setTimeout(() => {
      res.json({
        success: true,
        prediction: dummyPrediction,
        source: "simulated-heuristic-inference"
      });
    }, 1200); // 1.2s realistic processing delay
  });

  // Segregate and update system log endpoint (Simulation of waste dropping)
  app.post("/api/bins/segregate-item", (req, res) => {
    const { prediction, weight_g } = req.body;
    if (!prediction || !prediction.class) {
      return res.status(400).json({ success: false, message: "Missing prediction output" });
    }

    const type: 'Plastic' | 'Metal' | 'Paper' | 'Organic' | 'Residual' = prediction.class;
    const finalWeight = parseInt(weight_g, 10) || Math.round(50 + Math.random() * 300);

    // Find the associated bin to increase its level
    const binIndex = bins.findIndex(b => b.waste_type === type);
    if (binIndex !== -1) {
      const b = bins[binIndex];
      // Increment level based on weights: higher weight = more volume filled
      const increment = Math.max(2, Math.ceil((finalWeight / 1000) * 8)); // 2% to 6%
      b.fill_level = Math.min(100, b.fill_level + increment);
      b.last_updated = new Date().toISOString();
      checkAggregates(b);
    }

    // Add entry to Logs
    const newLog: WasteLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      waste_type: type,
      confidence: prediction.confidence,
      instruction: prediction.segregation_instruction,
      weight_g: finalWeight,
    };
    wasteLogs.unshift(newLog);

    res.json({
      success: true,
      log: newLog,
      bins,
      notifications
    });
  });

  // Handle Vite in Development Mode, Static files in Production Mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Loaded Vite Middleware for Dev Mode Hot Reloading simulation.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log(`Serving static files in Production Mode from ${distPath}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
