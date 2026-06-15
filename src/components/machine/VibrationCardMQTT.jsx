import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea
} from "recharts";
import { Activity, RefreshCw, ZoomOut, Settings2, Camera, Loader2, TrendingUp, BarChart2, ArrowUp, ArrowDown, Minus, Sparkles, Search, Plus, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import VibrationTrendChart, { METRIC_DEFS } from "@/components/machine/VibrationTrendChart";
import VibrationAIAnalysis, { LimitEvaluationPanel } from "@/components/machine/VibrationAIAnalysis";
import SensorDSPPanel from "@/components/machine/SensorDSPPanel";

// Zobrazujeme created_date (UTC ISO z DB) v pražském čase (CEST/CET).
function formatSensorTs(created_date, opts = {}) {
  if (!created_date) return null;
  // Pokud string neobsahuje timezone info (žádné Z, +, nebo posledních chars), přidáme Z = UTC
  const s = String(created_date);
  const utcStr = /[Zz]$|[+-]\d{2}:\d{2}$/.test(s) ? s : s + "Z";
  return new Date(utcStr).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", ...opts });
}

// Šipka trendu
function TrendArrow({ direction }) {
  if (!direction || direction === "stable") return <Minus className="w-3 h-3 text-slate-400 inline ml-0.5" />;
  if (direction === "up") return <ArrowUp className="w-3 h-3 text-red-500 inline ml-0.5" />;
  return <ArrowDown className="w-3 h-3 text-green-500 inline ml-0.5" />;
}



// Dialog pro přiřazení senzoru + normy k řádku
function AssignSensorDialog({ open, onClose, rowIndex, rowLabel, currentAssignment, onAssign }) {
  const current = currentAssignment || {};
  const [selectedSensor, setSelectedSensor] = useState(current.sensorId || "");
  const [selectedVelStandard, setSelectedVelStandard] = useState(current.velStandardId || "");
  const [selectedAccStandard, setSelectedAccStandard] = useState(current.accStandardId || "");
  const [selectedTempStandard, setSelectedTempStandard] = useState(current.tempStandardId || "");
  const [selectedBearing, setSelectedBearing] = useState(current.bearingId || "");
  const [scanningPhoto, setScanningPhoto] = useState(false);
  const [scanError, setScanError] = useState(null);
  const cameraInputRef = useRef(null);

  // Vyhledávání ložiska pomocí AI
  const [bearingSearchInput, setBearingSearchInput] = useState("");
  const [bearingSearching, setBearingSearching] = useState(false);
  const [bearingSearchResult, setBearingSearchResult] = useState(null);
  const [bearingSearchError, setBearingSearchError] = useState(null);
  const [bearingSaved, setBearingSaved] = useState(false);
  const [bearingManualMode, setBearingManualMode] = useState(false);
  const [bearingManualData, setBearingManualData] = useState({ nb: "", bd: "", pd: "", contact_angle_deg: 0, designation: "", manufacturer: "" });

  const handleCameraScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningPhoto(true);
    setScanError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Na tomto obrázku je štítek nebo potisk vibračního senzoru Aissens. 
Najdi ID senzoru — typicky vypadá takto: začíná "S9IMP" nebo "S9" a následují čísla a písmena, celkem cca 15-20 znaků (např. S9IMP600001265H).
Vrať POUZE samotné ID senzoru bez jakéhokoliv jiného textu. Pokud ID nenajdeš, vrať prázdný řetězec.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: { sensor_id: { type: "string" } }
        }
      });
      const detectedId = result?.sensor_id?.trim();
      if (detectedId) {
        setSelectedSensor(detectedId);
        setScanError(null);
      } else {
        setScanError("ID senzoru nebylo nalezeno. Zkuste přiblížit štítek senzoru.");
      }
    } catch (err) {
      setScanError("Chyba při rozpoznávání. Zkuste to znovu.");
    } finally {
      setScanningPhoto(false);
      // Reset input pro opakované skenování
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  // Reset při otevření
  useEffect(() => {
    if (open) {
      setSelectedSensor(current.sensorId || "");
      setSelectedVelStandard(current.velStandardId || "");
      setSelectedAccStandard(current.accStandardId || "");
      setSelectedTempStandard(current.tempStandardId || "");
      setSelectedBearing(current.bearingId || "");
      setBearingSearchInput("");
      setBearingSearchResult(null);
      setBearingSearchError(null);
      setBearingSaved(false);
      setBearingManualMode(false);
      setBearingManualData({ nb: "", bd: "", pd: "", contact_angle_deg: 0, designation: "", manufacturer: "" });
    }
  }, [open]);

  // Výpočet koeficientů defektních frekvencí z geometrie (deleguje na sdílenou funkci)
  const calcDefectCoefs = (nb, bd, pd, alpha_deg) => calcBearingDefectCoefs(nb, bd, pd, alpha_deg);

  // Ověřená katalogová databáze ložisek (SKF, FAG, NSK — přesné hodnoty)
  // Zdroj: SKF Interactive Engineering Catalogue, FAG WL 41520, NSK Bearing Catalogue
  const BEARING_DB = {
    // === DEEP GROOVE BALL BEARINGS — série 62xx ===
    "6200": { nb:10, bd:3.969,  pd:20.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 10mm" },
    "6201": { nb:10, bd:4.762,  pd:24.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 12mm" },
    "6202": { nb:10, bd:4.762,  pd:26.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 15mm" },
    "6203": { nb:8,  bd:6.350,  pd:28.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 17mm" },
    "6204": { nb:8,  bd:7.938,  pd:33.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 20mm" },
    "6205": { nb:9,  bd:7.938,  pd:38.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 25mm" },
    "6206": { nb:9,  bd:9.525,  pd:46.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 30mm" },
    "6207": { nb:9,  bd:11.112, pd:53.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 35mm" },
    "6208": { nb:9,  bd:11.112, pd:52.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 40mm" },
    "6209": { nb:9,  bd:12.303, pd:58.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 45mm" },
    "6210": { nb:10, bd:12.700, pd:65.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 50mm" },
    "6211": { nb:10, bd:14.288, pd:71.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 55mm" },
    "6212": { nb:10, bd:14.288, pd:76.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 60mm" },
    "6213": { nb:10, bd:15.875, pd:83.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 65mm" },
    "6214": { nb:10, bd:15.875, pd:90.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 70mm" },
    "6215": { nb:10, bd:17.463, pd:95.25, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 75mm" },
    "6216": { nb:10, bd:19.050, pd:101.6, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 80mm" },
    "6217": { nb:10, bd:19.050, pd:109.5, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 85mm" },
    "6218": { nb:10, bd:19.050, pd:115.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 90mm" },
    "6219": { nb:10, bd:20.638, pd:122.5, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 95mm" },
    "6220": { nb:10, bd:22.225, pd:130.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 100mm" },
    "6221": { nb:10, bd:23.812, pd:137.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 105mm" },
    "6222": { nb:10, bd:25.400, pd:144.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 110mm" },
    "6224": { nb:10, bd:28.575, pd:157.5, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 120mm" },
    "6226": { nb:10, bd:30.162, pd:171.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 130mm" },
    "6228": { nb:10, bd:31.750, pd:183.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 140mm" },
    "6230": { nb:10, bd:34.925, pd:196.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing, bore 150mm" },
    // === DEEP GROOVE BALL BEARINGS — série 63xx ===
    "6300": { nb:8,  bd:5.953,  pd:21.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 10mm" },
    "6301": { nb:8,  bd:6.350,  pd:25.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 12mm" },
    "6302": { nb:8,  bd:7.938,  pd:30.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 15mm" },
    "6303": { nb:8,  bd:7.938,  pd:33.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 17mm" },
    "6304": { nb:8,  bd:9.525,  pd:37.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 20mm" },
    "6305": { nb:7,  bd:10.319, pd:42.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 25mm" },
    "6306": { nb:8,  bd:11.112, pd:47.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 30mm" },
    "6307": { nb:8,  bd:12.700, pd:54.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 35mm" },
    "6308": { nb:8,  bd:14.288, pd:57.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 40mm" },
    "6309": { nb:8,  bd:15.875, pd:65.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 45mm" },
    "6310": { nb:8,  bd:17.463, pd:72.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 50mm" },
    "6311": { nb:8,  bd:19.050, pd:78.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 55mm" },
    "6312": { nb:8,  bd:19.050, pd:82.5,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 60mm" },
    "6313": { nb:8,  bd:20.638, pd:90.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 65mm" },
    "6314": { nb:8,  bd:22.225, pd:97.0,  a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 70mm" },
    "6315": { nb:8,  bd:23.812, pd:104.5, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 75mm" },
    "6316": { nb:8,  bd:25.400, pd:111.5, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 80mm" },
    "6318": { nb:8,  bd:28.575, pd:126.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 90mm" },
    "6320": { nb:8,  bd:31.750, pd:140.0, a:0, mfr:"SKF/FAG", note:"Deep groove ball bearing 63xx, bore 100mm" },
    // === ANGULAR CONTACT BALL BEARINGS — série 72xx (α=40°) ===
    "7204": { nb:13, bd:6.350,  pd:32.0,  a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 20mm, 40°" },
    "7205": { nb:13, bd:7.144,  pd:38.0,  a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 25mm, 40°" },
    "7206": { nb:13, bd:7.938,  pd:45.0,  a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 30mm, 40°" },
    "7207": { nb:13, bd:9.525,  pd:52.0,  a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 35mm, 40°" },
    "7208": { nb:13, bd:10.319, pd:57.5,  a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 40mm, 40°" },
    "7210": { nb:14, bd:11.112, pd:65.0,  a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 50mm, 40°" },
    "7212": { nb:14, bd:12.700, pd:76.5,  a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 60mm, 40°" },
    "7214": { nb:14, bd:15.875, pd:90.0,  a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 70mm, 40°" },
    "7216": { nb:14, bd:17.463, pd:103.0, a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 80mm, 40°" },
    "7218": { nb:14, bd:19.050, pd:115.0, a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 90mm, 40°" },
    "7220": { nb:14, bd:20.638, pd:125.0, a:40, mfr:"SKF", note:"Angular contact ball bearing, bore 100mm, 40°" },
    // === SPHERICAL ROLLER BEARINGS — série 222xx ===
    "22205": { nb:16, bd:6.5,   pd:34.5,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 25mm" },
    "22206": { nb:16, bd:8.0,   pd:41.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 30mm" },
    "22207": { nb:16, bd:9.0,   pd:47.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 35mm" },
    "22208": { nb:16, bd:10.0,  pd:53.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 40mm" },
    "22209": { nb:16, bd:11.0,  pd:58.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 45mm" },
    "22210": { nb:16, bd:12.0,  pd:65.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 50mm" },
    "22211": { nb:16, bd:13.0,  pd:70.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 55mm" },
    "22212": { nb:16, bd:13.5,  pd:75.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 60mm" },
    "22213": { nb:18, bd:13.0,  pd:80.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 65mm" },
    "22214": { nb:18, bd:14.0,  pd:87.5,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 70mm" },
    "22215": { nb:18, bd:15.0,  pd:95.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 75mm" },
    "22216": { nb:18, bd:16.0,  pd:101.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 80mm" },
    "22217": { nb:18, bd:17.0,  pd:107.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 85mm" },
    "22218": { nb:18, bd:18.0,  pd:113.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 90mm" },
    "22220": { nb:20, bd:18.0,  pd:126.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 100mm" },
    "22222": { nb:20, bd:20.0,  pd:139.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 110mm" },
    "22224": { nb:20, bd:22.0,  pd:151.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing, bore 120mm" },
    "22308": { nb:14, bd:14.0,  pd:60.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing 223xx, bore 40mm" },
    "22310": { nb:14, bd:16.0,  pd:72.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing 223xx, bore 50mm" },
    "22312": { nb:14, bd:19.0,  pd:87.0,  a:12, mfr:"SKF/FAG", note:"Spherical roller bearing 223xx, bore 60mm" },
    "22314": { nb:14, bd:22.0,  pd:100.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing 223xx, bore 70mm" },
    "22315": { nb:14, bd:24.0,  pd:110.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing 223xx, bore 75mm" },
    "22316": { nb:14, bd:25.0,  pd:116.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing 223xx, bore 80mm" },
    "22318": { nb:14, bd:28.0,  pd:130.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing 223xx, bore 90mm" },
    "22320": { nb:14, bd:31.0,  pd:144.0, a:12, mfr:"SKF/FAG", note:"Spherical roller bearing 223xx, bore 100mm" },
    // === CYLINDRICAL ROLLER BEARINGS — série NUxx ===
    "NU204": { nb:13, bd:6.0,   pd:32.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 20mm" },
    "NU205": { nb:13, bd:7.0,   pd:38.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 25mm" },
    "NU206": { nb:13, bd:8.0,   pd:45.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 30mm" },
    "NU207": { nb:13, bd:9.0,   pd:52.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 35mm" },
    "NU208": { nb:13, bd:10.0,  pd:57.5,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 40mm" },
    "NU209": { nb:14, bd:11.0,  pd:62.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 45mm" },
    "NU210": { nb:14, bd:12.0,  pd:68.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 50mm" },
    "NU211": { nb:14, bd:13.0,  pd:74.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 55mm" },
    "NU212": { nb:14, bd:13.0,  pd:78.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 60mm" },
    "NU214": { nb:14, bd:15.0,  pd:90.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 70mm" },
    "NU216": { nb:14, bd:17.0,  pd:103.0, a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 80mm" },
    "NU218": { nb:14, bd:19.0,  pd:115.0, a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 90mm" },
    "NU220": { nb:14, bd:20.0,  pd:126.0, a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing, bore 100mm" },
    "NU2205": { nb:15, bd:8.0,  pd:40.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing NU22xx, bore 25mm" },
    "NU2206": { nb:15, bd:9.0,  pd:47.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing NU22xx, bore 30mm" },
    "NU2208": { nb:15, bd:11.0, pd:57.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing NU22xx, bore 40mm" },
    "NU2210": { nb:15, bd:13.0, pd:68.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing NU22xx, bore 50mm" },
    "NU2212": { nb:15, bd:15.0, pd:80.0,  a:0, mfr:"SKF/FAG", note:"Cylindrical roller bearing NU22xx, bore 60mm" },
  };

  // Normalizace vstupu pro vyhledávání v DB
  const normalizeBearingId = (input) => {
    return input.toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[/\\].*$/, "")
      .replace(/C[234]$/, "")
      .replace(/^(SKF|FAG|NSK|NTN|INA)\s*/i, "");
  };

  const handleBearingManualCalc = () => {
    const nb = parseFloat(bearingManualData.nb);
    const bd = parseFloat(bearingManualData.bd);
    const pd = parseFloat(bearingManualData.pd);
    const a = parseFloat(bearingManualData.contact_angle_deg) || 0;
    if (!nb || !bd || !pd) {
      setBearingSearchError("Vyplňte Nb, Bd a Pd pro výpočet.");
      return;
    }
    const coefs = calcDefectCoefs(nb, bd, pd, a);
    setBearingSearchResult({
      designation: bearingManualData.designation || "Vlastní",
      manufacturer: bearingManualData.manufacturer || "",
      note: "Ručně zadané parametry",
      nb, bd, pd,
      contact_angle_deg: a,
      source: "manual",
      ...coefs,
    });
    setBearingSearchError(null);
  };

  const handleBearingAISearch = async () => {
    const query = bearingSearchInput.trim();
    if (!query) return;
    setBearingSearching(true);
    setBearingSearchResult(null);
    setBearingSearchError(null);
    setBearingSaved(false);
    setBearingManualMode(false);

    // 1. Přesná shoda v lokální katalogové DB — žádné AI odhady
    const key = normalizeBearingId(query);
    const dbEntry = BEARING_DB[key];
    if (dbEntry) {
      const coefs = calcDefectCoefs(dbEntry.nb, dbEntry.bd, dbEntry.pd, dbEntry.a);
      setBearingSearchResult({
        designation: key,
        manufacturer: dbEntry.mfr,
        note: dbEntry.note,
        nb: dbEntry.nb,
        bd: dbEntry.bd,
        pd: dbEntry.pd,
        contact_angle_deg: dbEntry.a,
        source: "catalog",
        ...coefs,
      });
      setBearingSearching(false);
      return;
    }

    // 2. Ložisko není v DB — nabídni ruční zadání geometrie
    setBearingSearchError(`Ložisko "${query}" není v katalogu. Zadejte geometrii ručně:`);
    setBearingManualMode(true);
    setBearingManualData({ nb: "", bd: "", pd: "", contact_angle_deg: 0, designation: key, manufacturer: "" });
    setBearingSearching(false);
    return;

  };

  const handleSaveBearingToDb = async () => {
    if (!bearingSearchResult) return;
    try {
      const newBearing = await base44.entities.BearingType.create({
        designation: bearingSearchResult.designation,
        manufacturer: bearingSearchResult.manufacturer || null,
        nb: bearingSearchResult.nb,
        bd: bearingSearchResult.bd,
        pd: bearingSearchResult.pd,
        contact_angle_deg: bearingSearchResult.contact_angle_deg || 0,
        notes: bearingSearchResult.note || null,
      });
      setSelectedBearing(newBearing.id);
      setBearingSaved(true);
    } catch (e) {
      setBearingSearchError("Chyba při ukládání ložiska.");
    }
  };

  const { data: registeredSensors = [], isLoading } = useQuery({
    queryKey: ["aissens_sensors"],
    queryFn: () => base44.entities.AissensSensor.list(null, 500),
    enabled: open,
    staleTime: 60000,
  });

  const { data: recentSensorData = [] } = useQuery({
    queryKey: ["recentSensorDataIds"],
    queryFn: async () => {
      const records = await base44.entities.SensorData.list("-created_date", 200);
      return [...new Set(records.map(r => r.sensor_id).filter(Boolean))].sort();
    },
    enabled: open,
    staleTime: 60000,
  });

  const { data: allStandards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    enabled: open,
    staleTime: 60000,
  });

  const velStandards = useMemo(() => allStandards.filter(s => !s.limit_type || s.limit_type === "velocity"), [allStandards]);
  const accStandards = useMemo(() => allStandards.filter(s => s.limit_type === "acceleration"), [allStandards]);
  const tempStandards = useMemo(() => allStandards.filter(s => s.limit_type === "temperature"), [allStandards]);

  const { data: bearingTypes = [] } = useQuery({
    queryKey: ["bearingTypes"],
    queryFn: () => base44.entities.BearingType.list(null, 500),
    enabled: open,
    staleTime: 60000,
  });

  const allSensorIds = useMemo(() => {
    const registeredIds = registeredSensors.map(s => s.sensor_id);
    return [...new Set([...registeredIds, ...recentSensorData])].sort();
  }, [registeredSensors, recentSensorData]);

  const getSensorName = (sid) => registeredSensors.find(s => s.sensor_id === sid)?.name || null;

  const handleSave = () => {
    onAssign(rowIndex, {
      sensorId: selectedSensor || null,
      velStandardId: selectedVelStandard || null,
      accStandardId: selectedAccStandard || null,
      tempStandardId: selectedTempStandard || null,
      bearingId: selectedBearing || null,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konfigurace měřicího místa — {rowLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Senzor */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">ID senzoru</label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Select value={selectedSensor || "__none__"} onValueChange={v => setSelectedSensor(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="— bez senzoru —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— bez senzoru —</SelectItem>
                    {isLoading ? (
                      <SelectItem value="__loading__" disabled>Načítám...</SelectItem>
                    ) : allSensorIds.map(sid => (
                      <SelectItem key={sid} value={sid}>
                        <span className="font-mono text-blue-700">{sid}</span>
                        {getSensorName(sid) && <span className="text-slate-500 ml-2 text-xs">— {getSensorName(sid)}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 flex-shrink-0 border-blue-300 text-blue-600 hover:bg-blue-50"
                title="Vyfotit štítek senzoru a automaticky přečíst ID"
                disabled={scanningPhoto}
                onClick={() => cameraInputRef.current?.click()}
              >
                {scanningPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraScan}
              />
            </div>
            {scanningPhoto && (
              <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Rozpoznávám ID senzoru z fotografie...
              </p>
            )}
            {scanError && (
              <p className="text-xs text-red-500 mt-1.5">{scanError}</p>
            )}
            {selectedSensor && !scanningPhoto && (
              <p className="text-xs text-slate-400 mt-1">
                Aktuálně: <span className="font-mono text-blue-600">{selectedSensor}</span>
              </p>
            )}
          </div>

          {/* Norma pro rychlost */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Norma pro rychlost vibrací <span className="normal-case font-normal text-blue-600">[mm/s]</span>
            </label>
            <Select value={selectedVelStandard || "__none__"} onValueChange={v => setSelectedVelStandard(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="— bez normy —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— bez normy —</SelectItem>
                {velStandards.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-slate-400 ml-2 text-xs">A/B: {s.limit_ab} · B/C: {s.limit_bc} · C/D: {s.limit_cd} mm/s</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Norma pro zrychlení/obálku */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Norma pro zrychlení a obálku <span className="normal-case font-normal text-green-600">[g]</span>
            </label>
            <Select value={selectedAccStandard || "__none__"} onValueChange={v => setSelectedAccStandard(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="— bez normy —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— bez normy —</SelectItem>
                {accStandards.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-slate-400 ml-2 text-xs">A/B: {s.acc_limit_ab} · B/C: {s.acc_limit_bc} · C/D: {s.acc_limit_cd} g</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Norma pro teplotu */}
          <div>
            <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide block mb-1.5">
              Norma pro teplotu <span className="normal-case font-normal text-purple-500">[°C]</span>
            </label>
            <Select value={selectedTempStandard || "__none__"} onValueChange={v => setSelectedTempStandard(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="— bez normy —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— bez normy —</SelectItem>
                {tempStandards.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-slate-400 ml-2 text-xs">A/B: {s.temp_limit_ab} · B/C: {s.temp_limit_bc} · C/D: {s.temp_limit_cd} °C</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Typ ložiska */}
          <div>
            <label className="text-xs font-semibold text-orange-600 uppercase tracking-wide block mb-1.5">
              Typ ložiska <span className="normal-case font-normal text-slate-500">(pro výpočet BPFO/BPFI/BSF/FTF)</span>
            </label>

            {/* Výběr z existujících */}
            <Select value={selectedBearing || "__none__"} onValueChange={v => setSelectedBearing(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="— bez ložiska —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— bez ložiska —</SelectItem>
                {bearingTypes.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    <span className="font-medium">{b.designation}</span>
                    {b.manufacturer && <span className="text-slate-400 ml-2 text-xs">{b.manufacturer}</span>}
                    <span className="text-slate-400 ml-2 text-xs">Nb={b.nb} Bd={b.bd}mm Pd={b.pd}mm</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Defektní frekvence pro vybrané ložisko z dropdownu */}
            {(() => {
              const selBearing = selectedBearing && selectedBearing !== "__none__" ? bearingTypes.find(b => b.id === selectedBearing) : null;
              if (!selBearing || bearingSearchResult) return null;

              // Priorita: uložené koeficienty v DB → výpočet z geometrie
              const hasStoredCoefs = selBearing.bpfo_coef != null && selBearing.bpfi_coef != null;
              const hasGeometry = selBearing.nb != null && selBearing.bd != null && selBearing.pd != null;
              if (!hasStoredCoefs && !hasGeometry) return null;

              const coefs = hasStoredCoefs
                ? { bpfo: selBearing.bpfo_coef, bpfi: selBearing.bpfi_coef, bsf: selBearing.bsf_coef, ftf: selBearing.ftf_coef }
                : calcDefectCoefs(selBearing.nb, selBearing.bd, selBearing.pd, selBearing.contact_angle_deg || 0);

              return (
                <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide mb-2">
                    Defektní frekvence — {selBearing.designation}
                    {selBearing.manufacturer && <span className="text-slate-400 ml-1">({selBearing.manufacturer})</span>}
                    {hasStoredCoefs && <span className="ml-2 text-[9px] bg-orange-200 text-orange-700 rounded px-1">uložené koef.</span>}
                  </p>
                  {hasGeometry && !hasStoredCoefs && (
                    <div className="grid grid-cols-4 gap-1 text-center mb-2">
                      {[
                        { label: "Nb", value: selBearing.nb },
                        { label: "Bd", value: `${selBearing.bd} mm` },
                        { label: "Pd", value: `${selBearing.pd} mm` },
                        { label: "α", value: `${selBearing.contact_angle_deg ?? 0}°` },
                      ].map(item => (
                        <div key={item.label} className="bg-white border border-orange-200 rounded p-1">
                          <div className="text-[9px] text-orange-500 font-bold">{item.label}</div>
                          <div className="text-xs font-mono font-semibold text-slate-700">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-orange-100">
                        <th className="border border-orange-200 px-2 py-1 text-left font-semibold text-orange-700">Frekvence</th>
                        <th className="border border-orange-200 px-2 py-1 text-center font-semibold text-orange-700">Koef.</th>
                        <th className="border border-orange-200 px-2 py-1 text-left text-[10px] font-normal text-orange-600">Popis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "BPFO", coef: coefs.bpfo, desc: "Vnější kroužek" },
                        { name: "BPFI", coef: coefs.bpfi, desc: "Vnitřní kroužek" },
                        { name: "BSF",  coef: coefs.bsf,  desc: "Valivý element" },
                        { name: "FTF",  coef: coefs.ftf,  desc: "Klec (FTF)" },
                      ].map(row => (
                        <tr key={row.name} className="hover:bg-orange-50">
                          <td className="border border-orange-200 px-2 py-1 font-bold text-slate-700">{row.name}</td>
                          <td className="border border-orange-200 px-2 py-1 text-center font-mono font-semibold text-orange-800">{row.coef != null ? `${row.coef}×` : "—"}</td>
                          <td className="border border-orange-200 px-2 py-1 text-slate-500 text-[10px]">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[9px] text-slate-400 mt-1">Koeficienty platí při 1 Hz (= 60 RPM). Při 1500 RPM násobte ×25.</p>
                </div>
              );
            })()}


          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Zrušit</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Uložit</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Výpočet koeficientů defektních frekvencí (sdílená utilita)
function calcBearingDefectCoefs(nb, bd, pd, alpha_deg) {
  const alpha = (alpha_deg || 0) * Math.PI / 180;
  const ratio = (bd / pd) * Math.cos(alpha);
  return {
    bpfo: +(0.5 * nb * (1 - ratio)).toFixed(4),
    bpfi: +(0.5 * nb * (1 + ratio)).toFixed(4),
    bsf:  +(0.5 * (pd / bd) * (1 - ratio * ratio)).toFixed(4),
    ftf:  +(0.5 * (1 - ratio)).toFixed(4),
  };
}

// Badge + rozbalovací panel s defektními frekvencemi pro řádek tabulky
function BearingFreqBadge({ bearing }) {
  const [open, setOpen] = useState(false);
  const coefs = calcBearingDefectCoefs(bearing.nb, bearing.bd, bearing.pd, bearing.contact_angle_deg || 0);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="text-[9px] bg-orange-50 text-orange-700 border border-orange-300 rounded px-1 hover:bg-orange-100 font-semibold"
        title="Zobrazit defektní frekvence ložiska"
      >
        ⚙ {bearing.designation}
      </button>
      {open && (
        <div
          className="absolute z-50 top-5 left-0 w-64 bg-white border border-orange-200 rounded-lg shadow-xl p-3 text-xs"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-orange-700">{bearing.designation}</span>
            {bearing.manufacturer && <span className="text-slate-400 text-[10px]">{bearing.manufacturer}</span>}
          </div>
          <div className="grid grid-cols-4 gap-1 text-center mb-2">
            {[
              { label: "Nb", value: bearing.nb },
              { label: "Bd", value: `${bearing.bd}` },
              { label: "Pd", value: `${bearing.pd}` },
              { label: "α", value: `${bearing.contact_angle_deg ?? 0}°` },
            ].map(item => (
              <div key={item.label} className="bg-orange-50 border border-orange-100 rounded p-1">
                <div className="text-[8px] text-orange-500 font-bold">{item.label}</div>
                <div className="text-[10px] font-mono font-semibold text-slate-700">{item.value}</div>
              </div>
            ))}
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-orange-100">
                <th className="border border-orange-200 px-1.5 py-0.5 text-left font-semibold text-orange-700 text-[10px]">Frekvence</th>
                <th className="border border-orange-200 px-1.5 py-0.5 text-center font-semibold text-orange-700 text-[10px]">Koef. (při 1 Hz / 60 RPM)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "BPFO", coef: coefs.bpfo, desc: "Vnější kroužek" },
                { name: "BPFI", coef: coefs.bpfi, desc: "Vnitřní kroužek" },
                { name: "BSF",  coef: coefs.bsf,  desc: "Valivý element" },
                { name: "FTF",  coef: coefs.ftf,  desc: "Klec" },
              ].map(row => (
                <tr key={row.name} className="hover:bg-orange-50">
                  <td className="border border-orange-200 px-1.5 py-0.5 font-bold text-slate-700 text-[10px]">{row.name}<span className="text-[8px] text-slate-400 ml-1">({row.desc})</span></td>
                  <td className="border border-orange-200 px-1.5 py-0.5 text-center font-mono font-bold text-orange-800 text-[10px]">{row.coef} Hz</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[9px] text-slate-400 mt-1.5 text-center">Pro jiné otáčky: Hz = koef × (RPM / 60)</p>
        </div>
      )}
    </span>
  );
}

// Hlavní komponenta — Vibrační karta MQTT
export default function VibrationCardMQTT({ machine, enablePredictive }) {
  const machineId = machine?.id;
  const queryClient = useQueryClient();

  // Real-time subscribe — při nových datech ze senzorů okamžitě invalidujeme cache
  useEffect(() => {
    const unsubSensorData = base44.entities.SensorData.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["latestSensorData"] });
    });
    const unsubSensors = base44.entities.AissensSensor.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["aissens_sensors_all"] });
    });
    return () => {
      unsubSensorData();
      unsubSensors();
    };
  }, [queryClient]);

  // Načteme schéma přiřazené ke stroji
  const { data: vibrationSchema, isLoading: isLoadingSchema } = useQuery({
    queryKey: ["vibrationSchema", machine?.vibration_schema_id],
    queryFn: async () => {
      if (!machine?.vibration_schema_id) return null;
      const schemas = await base44.entities.VibrationSchema.filter({ id: machine.vibration_schema_id });
      return schemas[0] || null;
    },
    enabled: !!machine?.vibration_schema_id,
    staleTime: 300000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  // Načteme všechny registrované senzory (pro teplotu, baterii, signál)
  const { data: sensors = [], refetch: refetchSensors } = useQuery({
    queryKey: ["aissens_sensors_all"],
    queryFn: () => base44.entities.AissensSensor.list(null, 500),
    staleTime: 0,
    refetchInterval: 30000,
  });

  // Parsování řádků ze schématu
  const schemaRows = useMemo(() => {
    if (!vibrationSchema?.rows_definition) return [];
    try {
      return JSON.parse(vibrationSchema.rows_definition);
    } catch (e) { return []; }
  }, [vibrationSchema]);

  // Přiřazení senzorů — načítáme z DB (sdílené mezi všemi uživateli)
  const { data: dbAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["vibrationSensorAssignments", machineId],
    queryFn: () => base44.entities.VibrationSensorAssignment.filter({ machine_id: machineId }, null, 200),
    enabled: !!machineId,
    staleTime: 30000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  // Převod pole DB záznamů na { [rowIndex]: { sensorId, velStandardId, accStandardId, tempStandardId, _dbId } }
  const rowAssignments = useMemo(() => {
    const out = {};
    for (const rec of dbAssignments) {
      out[rec.schema_row_index] = {
        sensorId: rec.sensor_id || null,
        velStandardId: rec.vel_standard_id || null,
        accStandardId: rec.acc_standard_id || null,
        tempStandardId: rec.temp_standard_id || null,
        bearingId: rec.bearing_id || null,
        _dbId: rec.id,
      };
    }
    return out;
  }, [dbAssignments]);

  // Zpětná kompatibilita — rowSensors[idx] = sensorId (string)
  const rowSensors = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(rowAssignments)) {
      out[k] = v?.sensorId || null;
    }
    return out;
  }, [rowAssignments]);

  const assignSensor = async (rowIndex, assignment) => {
    const existing = rowAssignments[rowIndex];
    const payload = {
      machine_id: machineId,
      schema_row_index: rowIndex,
      sensor_id: assignment.sensorId || null,
      vel_standard_id: assignment.velStandardId || null,
      acc_standard_id: assignment.accStandardId || null,
      temp_standard_id: assignment.tempStandardId || null,
      bearing_id: assignment.bearingId || null,
    };
    if (existing?._dbId) {
      await base44.entities.VibrationSensorAssignment.update(existing._dbId, payload);
    } else {
      await base44.entities.VibrationSensorAssignment.create(payload);
    }
    refetchAssignments();
  };

  // Načtení norem pro zobrazení limitů
  const { data: allStandards = [] } = useQuery({
    queryKey: ["vibrationStandards"],
    queryFn: () => base44.entities.VibrationStandard.list(null, 500),
    staleTime: 120000,
  });
  const standardsById = useMemo(() => Object.fromEntries(allStandards.map(s => [s.id, s])), [allStandards]);

  const { data: allBearingTypes = [] } = useQuery({
    queryKey: ["bearingTypes"],
    queryFn: () => base44.entities.BearingType.list(null, 500),
    staleTime: 300000,
  });
  const bearingsById = useMemo(() => Object.fromEntries(allBearingTypes.map(b => [b.id, b])), [allBearingTypes]);

  // Helper: vrátí CSS třídu pro barevné pásmo limitu
  const getLimitClass = (value, limitA, limitB, limitC) => {
    if (value == null || limitA == null) return "";
    if (value < limitA) return "text-green-600 font-semibold";
    if (value < limitB) return "text-green-800 font-semibold";
    if (value < limitC) return "text-yellow-600 font-semibold";
    return "text-red-600 font-bold";
  };

  // Helper: vrátí úroveň závažnosti 0=ok, 1=warning, 2=alarm, 3=kritická — pro semafor puntík
  const getLimitLevel = (value, limitA, limitB, limitC) => {
    if (value == null || limitA == null) return -1; // bez normy
    if (value < limitA) return 0;
    if (value < limitB) return 1;
    if (value < limitC) return 2;
    return 3;
  };

  // Vypočítá nejhorší úroveň ze všech hodnot v řádku (semafor)
  const getRowAlertLevel = (latest, velStd, accStd, tempStd, temp) => {
    if (!latest) return -1;
    const levels = [
      getLimitLevel(latest.vel_rms_x_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.vel_rms_y_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.vel_rms_z_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd),
      getLimitLevel(latest.oa_acc_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd),
      getLimitLevel(latest.env_rms_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd),
      getLimitLevel(temp, tempStd?.temp_limit_ab, tempStd?.temp_limit_bc, tempStd?.temp_limit_cd),
    ].filter(l => l >= 0);
    if (levels.length === 0) return -1;
    return Math.max(...levels);
  };

  const alertDotStyle = (level) => {
    if (level < 0) return "bg-slate-300"; // bez dat / bez normy
    if (level === 0) return "bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.4)]";
    if (level === 1) return "bg-green-700 shadow-[0_0_6px_2px_rgba(21,128,61,0.4)]";
    if (level === 2) return "bg-yellow-500 shadow-[0_0_6px_2px_rgba(234,179,8,0.5)]";
    return "bg-red-600 shadow-[0_0_8px_3px_rgba(220,38,38,0.6)] animate-pulse";
  };

  // Defaultně vyber první řádek, který má přiřazený senzor
  const firstAssignedIdx = useMemo(() => {
    return schemaRows.findIndex((_, idx) => !!rowSensors[idx]);
  }, [schemaRows, rowSensors]);

  const [selectedRow, setSelectedRow] = useState(null);
  const activeRowIdx = selectedRow !== null ? selectedRow : firstAssignedIdx;

  // Mapování metric_key z alarmu na interní metricKey trendu
  const ALERT_METRIC_TO_TREND_METRIC = {
    vel_rms_x_mm_s: "vel_x",
    vel_rms_y_mm_s: "vel_y",
    vel_rms_z_mm_s: "vel_z",
    rms_z_g: "acc_z",
    oa_acc_z: "acc_z",
    env_rms_z: "env_z",
    temperature: "temperature",
  };

  // Detekce URL parametru open_trend (z alarmu)
  const urlOpenTrend = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const metricKey = params.get("open_trend");
    return metricKey ? (ALERT_METRIC_TO_TREND_METRIC[metricKey] || "vel_xyz") : null;
  }, []);

  // Trend: { sensorId, metricKey }
  const defaultTrendSensorId = useMemo(() => rowSensors[firstAssignedIdx] || null, [firstAssignedIdx, rowSensors]);
  const [trendConfig, setTrendConfig] = useState(null); // null = použij default
  const activeTrendSensorId = trendConfig?.sensorId ?? defaultTrendSensorId;
  const activeTrendMetric = trendConfig?.metricKey ?? "vel_xyz";

  // Vybraný sensor_data_id z kliknutí na bod trendu → předá se do SensorDSPPanel
  const [trendSelectedSensorDataId, setTrendSelectedSensorDataId] = useState(null);

  const [assignDialog, setAssignDialog] = useState(null); // { rowIndex, rowLabel }
  const [showTrend, setShowTrend] = useState(false);

  // Automatické otevření trendu z URL parametru (z kliknutí na alarm)
  useEffect(() => {
    if (urlOpenTrend && firstAssignedIdx >= 0 && defaultTrendSensorId) {
      setShowTrend(true);
      setTrendConfig({ sensorId: defaultTrendSensorId, metricKey: urlOpenTrend });
    }
  }, [urlOpenTrend, firstAssignedIdx, defaultTrendSensorId]);
  const [showDSP, setShowDSP] = useState(false);
  const [showAI, setShowAI] = useState(false);

  // Načteme poslední data pro každý přiřazený senzor (pro RMS hodnoty v tabulce)
  const assignedSensorIds = useMemo(() => {
    return [...new Set(Object.values(rowSensors).filter(Boolean))];
  }, [rowSensors]);

  // Trendy všech přiřazených senzorů — jedno query mimo map (Rules of Hooks)
  const { data: allSensorTrends = {} } = useQuery({
    queryKey: ["allSensorTrends", assignedSensorIds.join(",")],
    queryFn: async () => {
      if (assignedSensorIds.length === 0) return {};
      const result = {};
      await Promise.all(assignedSensorIds.map(async (sid) => {
        const res = await base44.functions.invoke("getSensorTrend", {
          sensor_id: sid,
          limit: 10,
          trend_only: true,
        });
        result[sid] = res.data?.trends || {};
      }));
      return result;
    },
    enabled: assignedSensorIds.length > 0,
    staleTime: 120000,
    refetchInterval: 300000,
  });

  // Načteme poslední SensorData záznam pro každý senzor — RMS hodnoty jsou předpočítány backendem
  // Bereme pouze záznamy, které mají has_fft=true A vyplněné pole vel_rms_x_mm_s (= nové DSP záznamy)
  const { data: latestSensorData = [] } = useQuery({
    queryKey: ["latestSensorData", assignedSensorIds.join(",")],
    queryFn: async () => {
      if (assignedSensorIds.length === 0) return [];
      const results = await Promise.all(assignedSensorIds.map(async (sid) => {
        // Vezmi posledních 20 záznamů s FFT a najdi první, který má vyplněné RMS (nový DSP formát)
        const recs = await base44.entities.SensorData.filter({ sensor_id: sid, has_fft: true }, "-created_date", 20);
        return recs.find(r => r.vel_rms_x_mm_s != null) ?? null;
      }));
      return results.filter(Boolean);
    },
    enabled: assignedSensorIds.length > 0,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const getSensorById = (sensorId) => sensors.find(s => s.sensor_id === sensorId);
  const getDisplayData = (sensorId) => latestSensorData.find(d => d.sensor_id === sensorId) ?? null;

  // ID záznamu pro AI analýzu — první senzor s daty
  const aiSensorDataId = useMemo(() => latestSensorData[0]?.id ?? null, [latestSensorData]);
  const aiRowIdx = useMemo(() => {
    const entry = Object.entries(rowAssignments).find(([, a]) => latestSensorData.find(d => d.sensor_id === a.sensorId));
    return entry ? Number(entry[0]) : activeRowIdx;
  }, [rowAssignments, latestSensorData, activeRowIdx]);

  const OVERALL_BAND = [
    { label: "A", desc: "OK", bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
    { label: "B", desc: "OK", bg: "bg-green-100", text: "text-green-900", border: "border-green-400" },
    { label: "C", desc: "Upozornění", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
    { label: "D", desc: "Výstraha", bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
  ];

  // Celkový stav stroje — nejhorší level ze všech senzorů
  const overallLevel = useMemo(() => {
    const levels = schemaRows.map((_, idx) => {
      const assignment = rowAssignments[idx] || {};
      const sensorId = assignment.sensorId || null;
      const velStd = standardsById[assignment.velStandardId];
      const accStd = standardsById[assignment.accStandardId];
      const tempStd = standardsById[assignment.tempStandardId];
      const latest = getDisplayData(sensorId);
      const sensorInfo = getSensorById(sensorId);
      const temp = sensorInfo?.last_temperature;
      return getRowAlertLevel(latest, velStd, accStd, tempStd, temp);
    }).filter(l => l >= 0);
    if (levels.length === 0) return -1;
    return Math.max(...levels);
  }, [schemaRows, rowAssignments, standardsById, latestSensorData, sensors]);

  // Stav vibrací stroje — nejhorší level rychlosti (vel X/Y/Z) ze všech míst
  const velLevel = useMemo(() => {
    const levels = schemaRows.map((_, idx) => {
      const assignment = rowAssignments[idx] || {};
      const velStd = standardsById[assignment.velStandardId];
      const latest = getDisplayData(assignment.sensorId || null);
      if (!latest || !velStd) return -1;
      return Math.max(
        getLimitLevel(latest.vel_rms_x_mm_s, velStd.limit_ab, velStd.limit_bc, velStd.limit_cd),
        getLimitLevel(latest.vel_rms_y_mm_s, velStd.limit_ab, velStd.limit_bc, velStd.limit_cd),
        getLimitLevel(latest.vel_rms_z_mm_s, velStd.limit_ab, velStd.limit_bc, velStd.limit_cd),
      );
    }).filter(l => l >= 0);
    if (levels.length === 0) return -1;
    return Math.max(...levels);
  }, [schemaRows, rowAssignments, standardsById, latestSensorData]);

  // Stav ložisek — nejhorší level zrychlení + obálky ze všech míst
  const bearingLevel = useMemo(() => {
    const levels = schemaRows.map((_, idx) => {
      const assignment = rowAssignments[idx] || {};
      const accStd = standardsById[assignment.accStandardId];
      const latest = getDisplayData(assignment.sensorId || null);
      if (!latest || !accStd) return -1;
      return Math.max(
        getLimitLevel(latest.rms_z_g ?? latest.oa_acc_z, accStd.acc_limit_ab, accStd.acc_limit_bc, accStd.acc_limit_cd),
        getLimitLevel(latest.env_rms_z, accStd.acc_limit_ab, accStd.acc_limit_bc, accStd.acc_limit_cd),
      );
    }).filter(l => l >= 0);
    if (levels.length === 0) return -1;
    return Math.max(...levels);
  }, [schemaRows, rowAssignments, standardsById, latestSensorData]);

  // Pokud není přiřazeno schéma, zobraz informaci
  if (!machine?.vibration_schema_id) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="p-12 text-center">
          <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium mb-1">Není přiřazeno vibrační schéma</p>
          <p className="text-sm text-slate-400">Přiřaďte schéma měření v administraci stroje.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingSchema) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="p-12 text-center">
          <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-4 animate-spin" />
          <p className="text-slate-500">Načítám vibrační schéma...</p>
        </CardContent>
      </Card>
    );
  }

  if (schemaRows.length === 0 && !isLoadingSchema) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="p-12 text-center">
          <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Schéma neobsahuje žádné řádky.</p>
          <p className="text-xs text-slate-400 mt-2">ID schématu: {machine?.vibration_schema_id}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hlavička */}
      <Card className="border-none shadow-lg">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          {/* Horní řádek: název + tlačítka */}
          <div className="flex items-center justify-between gap-2 min-w-0 mb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm min-w-0 truncate">
              <Activity className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="truncate">Vibrační karta — {machine?.name}</span>
            </CardTitle>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant={showTrend ? "default" : "outline"}
                size="sm"
                className={`gap-1 text-xs h-7 px-2 ${showTrend ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-slate-600 hover:text-blue-600"}`}
                onClick={() => setShowTrend(v => !v)}
              >
                <TrendingUp className="w-3 h-3" />
                <span className="hidden sm:inline">Trend</span>
              </Button>
              <Button
                variant={showDSP ? "default" : "outline"}
                size="sm"
                className={`gap-1 text-xs h-7 px-2 ${showDSP ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-slate-600 hover:text-blue-600"}`}
                onClick={() => setShowDSP(v => !v)}
              >
                <BarChart2 className="w-3 h-3" />
                <span className="hidden sm:inline">Spektrum</span>
              </Button>
              <Badge variant="outline" className="text-xs hidden sm:inline-flex">{schemaRows.length} míst</Badge>
            </div>
          </div>

          {/* Dolní řádek: foto + hodnocení — pouze md+ */}
          {(machine?.photo_url || overallLevel >= -1) && (
            <div className="hidden md:flex items-stretch gap-3">
              {/* Foto stroje */}
              {machine?.photo_url && (
                <img
                  src={machine.photo_url}
                  alt={machine.name}
                  className="h-20 w-32 object-cover rounded-lg border border-slate-200 shadow-sm flex-shrink-0"
                />
              )}
              {/* Hodnocení stavu — dvě dlaždice */}
              {(() => {
                const STATUS_DEFS = [
                  { dot: "bg-green-500", bg: "bg-green-50",  border: "border-green-300",  text: "text-green-800" },
                  { dot: "bg-green-700", bg: "bg-green-50",  border: "border-green-400",  text: "text-green-900" },
                  { dot: "bg-yellow-500", bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-800" },
                  { dot: "bg-red-600",    bg: "bg-red-50",    border: "border-red-300",    text: "text-red-800" },
                ];
                const noData = { dot: "bg-slate-300", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-500" };

                const VEL_LABELS  = ["Vibrace — A OK", "Vibrace — B OK", "Vibrace — C Upozornění", "Vibrace — D Výstraha"];
                const VEL_DETAILS = [
                  "Rychlost vibrací je v pásmu A. Stroj pracuje bez omezení.",
                  "Rychlost vibrací je v pásmu B. Zvýšená kontrola doporučena.",
                  "Výrazné vibrace (pásmo C). Plánujte údržbu co nejdříve.",
                  "Nebezpečné vibrace (pásmo D). Zvažte okamžité odstavení.",
                ];
                const BEAR_LABELS  = ["Ložiska — A OK", "Ložiska — B OK", "Ložiska — C Upozornění", "Ložiska — D Výstraha"];
                const BEAR_DETAILS = [
                  "Zrychlení a obálka jsou v pásmu A. Žádné poškození ložisek.",
                  "Zrychlení/obálka je v pásmu B. Sledujte trend ložisek.",
                  "Zvýšené rázové vibrace (pásmo C). Blíží se porucha ložiska.",
                  "Kritické rázové vibrace (pásmo D). Ložisko pravděpodobně poškozeno.",
                ];
                const noVel  = { label: "Stav vibrací neznámý",  detail: "Není přiřazena norma pro rychlost nebo zatím nejsou data.", ...noData };
                const noBear = { label: "Stav ložisek neznámý",  detail: "Není přiřazena norma pro zrychlení nebo zatím nejsou data.", ...noData };

                const velSt  = velLevel  >= 0 ? { label: VEL_LABELS[velLevel],   detail: VEL_DETAILS[velLevel],   ...STATUS_DEFS[velLevel]  } : noVel;
                const bearSt = bearingLevel >= 0 ? { label: BEAR_LABELS[bearingLevel], detail: BEAR_DETAILS[bearingLevel], ...STATUS_DEFS[bearingLevel] } : noBear;

                const showAIBtn = enablePredictive && (velLevel >= 2 || bearingLevel >= 2);
                return (
                  <div className="flex-1 flex flex-col gap-2">
                    {/* Stav vibrací — rychlost */}
                    <div className={`flex flex-col justify-center gap-0.5 rounded-lg border px-3 py-2 ${velSt.bg} ${velSt.border}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${velSt.dot}`} />
                        <span className={`font-semibold text-xs ${velSt.text}`}>{velSt.label}</span>
                      </div>
                      <p className={`text-[11px] ${velSt.text} opacity-75 pl-4`}>{velSt.detail}</p>
                    </div>
                    {/* Stav ložisek — zrychlení + obálka */}
                    <div className={`flex flex-col justify-center gap-0.5 rounded-lg border px-3 py-2 ${bearSt.bg} ${bearSt.border}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${bearSt.dot}`} />
                        <span className={`font-semibold text-xs ${bearSt.text}`}>{bearSt.label}</span>
                      </div>
                      <p className={`text-[11px] ${bearSt.text} opacity-75 pl-4`}>{bearSt.detail}</p>
                    </div>
                    {/* AI tlačítko — jen při stavu C nebo D */}
                    {showAIBtn && (
                      <Button
                        size="sm"
                        variant={showAI ? "default" : "outline"}
                        className={`gap-1.5 text-xs h-7 self-start ${showAI ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600" : "border-purple-400 text-purple-700 hover:bg-purple-50"}`}
                        onClick={() => setShowAI(v => !v)}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Diagnostická analýza
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </CardHeader>

        {/* Tabulka */}
        <CardContent className="p-0">
          {/* Hlavička tabulky — pouze desktop */}
           <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-0 bg-slate-100 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 uppercase tracking-wide">
             <div>Místo</div>
             <div>ID senzoru / čas měření</div>
             <div className="text-center">Vel X<br/><span className="text-xs normal-case font-normal">[mm/s]</span></div>
             <div className="text-center">Vel Y<br/><span className="text-xs normal-case font-normal">[mm/s]</span></div>
             <div className="text-center">Vel Z<br/><span className="text-xs normal-case font-normal">[mm/s]</span></div>
             <div className="text-center">Acc Z<br/><span className="text-xs normal-case font-normal">[g]</span></div>
             <div className="text-center">Obálka Z<br/><span className="text-xs normal-case font-normal">[g]</span></div>
             <div className="text-center">Teplota<br/><span className="text-xs normal-case font-normal">[°C]</span></div>
             <div className="text-center">Baterie<br/><span className="text-xs normal-case font-normal">[0-4]</span></div>
             <div className="text-center">Signál<br/><span className="text-xs normal-case font-normal">[dBm]</span></div>
             <div></div>
           </div>

          {schemaRows.map((row, idx) => {
            const assignment = rowAssignments[idx] || {};
            const sensorId = assignment.sensorId || null;
            const sensorTrends = sensorId ? (allSensorTrends[sensorId] || {}) : {};
            const velStd = standardsById[assignment.velStandardId];
            const accStd = standardsById[assignment.accStandardId];
            const tempStd = standardsById[assignment.tempStandardId];
            const latest = getDisplayData(sensorId);
            const sensorInfo = getSensorById(sensorId);
            const isSelected = activeRowIdx === idx;
            const label = row.label || row.name || `Bod ${idx + 1}`;
            const name = row.name || "";

            // Kompaktní pásmo pod hodnotou v tabulce
            const BAND_LABELS = ["A", "B", "C", "D"];
            const BAND_PILL = [
              "bg-green-100 text-green-700",
              "bg-green-100 text-green-900",
              "bg-yellow-100 text-yellow-800",
              "bg-red-100 text-red-700",
            ];
            const getBandPill = (level) => {
              if (level < 0) return null;
              return (
                <span className={`text-[8px] font-bold px-1 rounded ${BAND_PILL[level]}`}>
                  {BAND_LABELS[level]}
                </span>
              );
            };

            const batteryLevel = sensorInfo?.last_battery_level;
            const batteryColor = batteryLevel == null ? "text-slate-300" : batteryLevel >= 3 ? "text-green-600" : batteryLevel >= 2 ? "text-yellow-600" : "text-red-600";
            const rssi = sensorInfo?.last_signal_strength;
            const rssiDb = rssi != null ? -Math.abs(rssi) : null;
            const rssiColor = rssiDb == null ? "text-slate-300"
              : rssiDb >= -50 ? "text-green-600"
              : rssiDb >= -67 ? "text-blue-600"
              : rssiDb >= -80 ? "text-yellow-600"
              : "text-red-600";
            const rssiTitle = rssiDb == null ? "Neznámý signál"
              : rssiDb >= -50 ? "Vynikající signál (-30 až -50 dBm)"
              : rssiDb >= -67 ? "Dobrý signál (-60 až -67 dBm)"
              : rssiDb >= -80 ? "Slabý signál (-70 až -80 dBm)"
              : "Nepoužitelný signál (< -80 dBm)";
            const temp = sensorInfo?.last_temperature;
            const tempClass = getLimitClass(temp, tempStd?.temp_limit_ab, tempStd?.temp_limit_bc, tempStd?.temp_limit_cd);
            const velClass = (v) => getLimitClass(v, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd);
            const accClass = (v) => getLimitClass(v, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd);
            const alertLevel = getRowAlertLevel(latest, velStd, accStd, tempStd, temp);
            const alertTitle = alertLevel < 0
              ? (sensorId ? "Bez přiřazené normy" : "Bez senzoru")
              : alertLevel === 0 ? "Stav: A — OK, všechny hodnoty v pásmu A"
              : alertLevel === 1 ? "Stav: B — OK, hodnoty v pásmu B"
              : alertLevel === 2 ? "Stav: C — Upozornění, překročeno pásmo B/C"
              : "Stav: D — Výstraha, překročeno pásmo C/D";

            const handleRowClick = () => {
              if (!sensorId) return;
              setSelectedRow(idx);
              setTrendConfig({ sensorId, metricKey: "vel_xyz" });
              setTrendSelectedSensorDataId(null);
            };

            const rmsMetrics = [
              { metricKey: "vel_x", label: "Vel X", unit: "mm/s", value: latest?.vel_rms_x_mm_s, colorClass: velClass(latest?.vel_rms_x_mm_s), fallbackColor: "text-blue-700", level: getLimitLevel(latest?.vel_rms_x_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd), trendKey: "vel_rms_x_mm_s" },
              { metricKey: "vel_y", label: "Vel Y", unit: "mm/s", value: latest?.vel_rms_y_mm_s, colorClass: velClass(latest?.vel_rms_y_mm_s), fallbackColor: "text-blue-700", level: getLimitLevel(latest?.vel_rms_y_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd), trendKey: "vel_rms_y_mm_s" },
              { metricKey: "vel_z", label: "Vel Z", unit: "mm/s", value: latest?.vel_rms_z_mm_s, colorClass: velClass(latest?.vel_rms_z_mm_s), fallbackColor: "text-blue-700", level: getLimitLevel(latest?.vel_rms_z_mm_s, velStd?.limit_ab, velStd?.limit_bc, velStd?.limit_cd), trendKey: "vel_rms_z_mm_s" },
              { metricKey: "acc_z", label: "Acc Z", unit: "g", value: latest?.rms_z_g ?? latest?.oa_acc_z, colorClass: accClass(latest?.rms_z_g ?? latest?.oa_acc_z), fallbackColor: "text-green-700", level: getLimitLevel(latest?.rms_z_g ?? latest?.oa_acc_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd), trendKey: "oa_acc_z" },
              { metricKey: "env_z", label: "Obálka Z", unit: "g", value: latest?.env_rms_z, colorClass: accClass(latest?.env_rms_z), fallbackColor: "text-orange-600", level: getLimitLevel(latest?.env_rms_z, accStd?.acc_limit_ab, accStd?.acc_limit_bc, accStd?.acc_limit_cd), trendKey: "env_rms_z" },
            ];

            return (
              <div key={idx} className="border-b border-slate-100 last:border-0">
                {/* === DESKTOP ROW === */}
                <div
                  className={`hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-0 px-4 py-4 text-base transition-colors items-center ${sensorId ? "cursor-pointer hover:bg-blue-50/50" : ""} ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
                  onClick={handleRowClick}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 ${alertDotStyle(sensorId ? alertLevel : -1)}`} title={alertTitle} />
                    <div>
                    <span className={`font-semibold ${isSelected && sensorId ? "text-blue-700" : "text-slate-900"}`}>{label}</span>
                    {name && name !== label && <span className="text-slate-500 ml-1 text-xs">{name}</span>}
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                     {velStd && <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1">{velStd.name}</span>}
                     {accStd && <span className="text-[9px] bg-green-50 text-green-700 border border-green-200 rounded px-1">{accStd.name}</span>}
                     {tempStd && <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 rounded px-1">{tempStd.name}</span>}
                     {assignment.bearingId && bearingsById[assignment.bearingId] && (
                       <BearingFreqBadge bearing={bearingsById[assignment.bearingId]} />
                     )}
                    </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {sensorId ? (
                      <>
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 w-fit">{sensorId}</span>
                        {latest?.created_date && (
                          <span className="text-[10px] text-slate-400 pl-0.5">
                            {formatSensorTs(latest.created_date, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 text-xs italic">— nepřiřazen —</span>
                    )}
                  </div>
                  {rmsMetrics.map(({ metricKey, value, colorClass, fallbackColor, level, trendKey }) => {
                    const isActiveTrend = sensorId && activeTrendSensorId === sensorId && activeTrendMetric === metricKey;
                    return (
                      <div key={metricKey}
                        className={`text-center font-mono text-sm rounded transition-colors flex flex-col items-center justify-center gap-0.5 ${sensorId ? "cursor-pointer hover:bg-blue-100" : ""} ${isActiveTrend ? "bg-blue-100 ring-1 ring-blue-400" : ""}`}
                        onClick={(e) => { e.stopPropagation(); if (sensorId) setTrendConfig({ sensorId, metricKey }); }}
                        title={sensorId ? `Zobrazit trend: ${METRIC_DEFS[metricKey]?.label}` : ""}
                      >
                        {value != null
                          ? <span className={colorClass || fallbackColor}>{value.toFixed(2)}<TrendArrow direction={sensorTrends[trendKey]} /></span>
                          : <span className="text-slate-300">—</span>}
                        {value != null && getBandPill(level)}
                      </div>
                    );
                  })}
                  <div className={`text-center font-mono text-sm font-semibold flex flex-col items-center justify-center gap-0.5 ${sensorId ? "cursor-pointer hover:bg-purple-50 rounded transition-colors" : ""}`}
                    onClick={(e) => { e.stopPropagation(); if (sensorId) setTrendConfig({ sensorId, metricKey: "temperature" }); }}
                    title={sensorId ? "Zobrazit trend teploty" : ""}>
                    {temp != null ? <span className={tempClass || "text-purple-700"}>{temp.toFixed(1)}°<TrendArrow direction={sensorTrends["temperature"]} /></span> : <span className="text-slate-300">—</span>}
                    {temp != null && getBandPill(getLimitLevel(temp, tempStd?.temp_limit_ab, tempStd?.temp_limit_bc, tempStd?.temp_limit_cd))}
                  </div>
                  <div className="text-center font-mono text-sm font-semibold">
                    {batteryLevel != null ? <span className={batteryColor}>{batteryLevel}/4</span> : <span className="text-slate-300">—</span>}
                  </div>
                  <div className="text-center font-mono text-sm font-semibold">
                    {rssiDb != null ? <span className={rssiColor} title={rssiTitle}>{rssiDb}</span> : <span className="text-slate-300">—</span>}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); setAssignDialog({ rowIndex: idx, rowLabel: `${label}${name && name !== label ? ' — ' + name : ''}`, currentAssignment: rowAssignments[idx] }); }}>
                      <Settings2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* === MOBILE CARD === */}
                <div
                  className={`lg:hidden p-3 transition-colors ${sensorId ? "cursor-pointer active:bg-blue-50" : ""} ${isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}
                  onClick={handleRowClick}
                >
                  {/* Hlavička karty */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${alertDotStyle(sensorId ? alertLevel : -1)}`} title={alertTitle} />
                      <span className={`font-semibold text-sm ${isSelected && sensorId ? "text-blue-700" : "text-slate-900"}`}>{label}</span>
                      {name && name !== label && <span className="text-slate-500 text-xs">{name}</span>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); setAssignDialog({ rowIndex: idx, rowLabel: `${label}${name && name !== label ? ' — ' + name : ''}`, currentAssignment: rowAssignments[idx] }); }}>
                      <Settings2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* ID senzoru */}
                  {sensorId ? (
                    <div className="mb-2">
                      <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{sensorId}</span>
                      {latest?.created_date && (
                        <span className="text-[10px] text-slate-400 ml-2">
                          {formatSensorTs(latest.created_date, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic mb-2">Senzor nepřiřazen</div>
                  )}

                  {/* Hodnoty — grid 3 sloupce */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {rmsMetrics.map((metric) => {
                      const { metricKey, label: mLabel, unit, value, colorClass, fallbackColor, level: bandLevel } = metric;
                      const isActiveTrend = sensorId && activeTrendSensorId === sensorId && activeTrendMetric === metricKey;
                      return (
                        <div key={metricKey}
                          className={`bg-slate-50 rounded p-1.5 text-center border ${isActiveTrend ? "border-blue-400 bg-blue-50" : "border-slate-200"} ${sensorId ? "cursor-pointer active:bg-blue-100" : ""}`}
                          onClick={(e) => { e.stopPropagation(); if (sensorId) setTrendConfig({ sensorId, metricKey }); }}
                        >
                          <div className="text-[9px] text-slate-400 font-semibold uppercase">{mLabel}</div>
                          <div className="text-[10px] text-slate-300 mb-0.5">[{unit}]</div>
                          <div className="font-mono text-sm font-bold">
                            {value != null ? <span className={colorClass || fallbackColor}>{value.toFixed(2)}<TrendArrow direction={sensorTrends[metric.trendKey]} /></span> : <span className="text-slate-300">—</span>}
                          </div>
                          {value != null && <div className="flex justify-center mt-0.5">{getBandPill(bandLevel)}</div>}
                        </div>
                      );
                    })}

                    {/* Teplota */}
                    <div className={`bg-slate-50 rounded p-1.5 text-center border border-slate-200 ${sensorId ? "cursor-pointer active:bg-purple-50" : ""}`}
                      onClick={(e) => { e.stopPropagation(); if (sensorId) setTrendConfig({ sensorId, metricKey: "temperature" }); }}>
                      <div className="text-[9px] text-slate-400 font-semibold uppercase">Teplota</div>
                      <div className="text-[10px] text-slate-300 mb-0.5">[°C]</div>
                      <div className="font-mono text-sm font-bold">
                        {temp != null ? <span className={tempClass || "text-purple-700"}>{temp.toFixed(1)}°<TrendArrow direction={sensorTrends["temperature"]} /></span> : <span className="text-slate-300">—</span>}
                      </div>
                      {temp != null && <div className="flex justify-center mt-0.5">{getBandPill(getLimitLevel(temp, tempStd?.temp_limit_ab, tempStd?.temp_limit_bc, tempStd?.temp_limit_cd))}</div>}
                    </div>

                    {/* Baterie */}
                    <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-200">
                      <div className="text-[9px] text-slate-400 font-semibold uppercase">Baterie</div>
                      <div className="text-[10px] text-slate-300 mb-0.5">[0-4]</div>
                      <div className="font-mono text-sm font-bold">
                        {batteryLevel != null ? <span className={batteryColor}>{batteryLevel}/4</span> : <span className="text-slate-300">—</span>}
                      </div>
                    </div>

                    {/* Signál */}
                    <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-200">
                      <div className="text-[9px] text-slate-400 font-semibold uppercase">Signál</div>
                      <div className="text-[10px] text-slate-300 mb-0.5">[dBm]</div>
                      <div className="font-mono text-sm font-bold">
                        {rssiDb != null ? <span className={rssiColor} title={rssiTitle}>{rssiDb}</span> : <span className="text-slate-300">—</span>}
                      </div>
                    </div>
                  </div>

                  {/* Badge norem */}
                  {(velStd || accStd || tempStd) && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {velStd && <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1">{velStd.name}</span>}
                      {accStd && <span className="text-[9px] bg-green-50 text-green-700 border border-green-200 rounded px-1">{accStd.name}</span>}
                      {tempStd && <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 rounded px-1">{tempStd.name}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* AI Diagnostická analýza — zobrazí se jen při stavu C/D a po kliknutí na tlačítko */}
      {showAI && aiSensorDataId && (
        <Card className="border-none shadow-lg">
          <CardContent className="p-4">
            <VibrationAIAnalysis
              sensorDataId={aiSensorDataId}
              velStandard={standardsById[rowAssignments[aiRowIdx]?.velStandardId]}
              accStandard={standardsById[rowAssignments[aiRowIdx]?.accStandardId]}
              tempStandard={standardsById[rowAssignments[aiRowIdx]?.tempStandardId]}
              bearing={bearingsById[rowAssignments[aiRowIdx]?.bearingId]}
              machineName={machine?.name}
              measurementPoint={schemaRows[aiRowIdx]?.label || schemaRows[aiRowIdx]?.name || `Bod ${aiRowIdx + 1}`}
            />
          </CardContent>
        </Card>
      )}

      {/* Trend panel */}
      {showTrend && activeTrendSensorId && (() => {
        const trendRowIdx = Object.entries(rowSensors).find(([, sid]) => sid === activeTrendSensorId)?.[0];
        const trendRow = trendRowIdx != null ? schemaRows[trendRowIdx] : null;
        const trendLabel = trendRow?.label || trendRow?.name || activeTrendSensorId;
        const trendAssignment = trendRowIdx != null ? rowAssignments[trendRowIdx] : null;
        const trendVelStd = standardsById[trendAssignment?.velStandardId];
        const trendAccStd = standardsById[trendAssignment?.accStandardId];
        const trendTempStd = standardsById[trendAssignment?.tempStandardId];

        // Vyber správné limity dle metriky
        const trendLimits = (() => {
          const m = activeTrendMetric;
          if (m === "vel_x" || m === "vel_y" || m === "vel_z" || m === "vel_xyz") {
            return trendVelStd ? { ab: trendVelStd.limit_ab, bc: trendVelStd.limit_bc, cd: trendVelStd.limit_cd } : null;
          }
          if (m === "acc_z" || m === "env_z") {
            return trendAccStd ? { ab: trendAccStd.acc_limit_ab, bc: trendAccStd.acc_limit_bc, cd: trendAccStd.acc_limit_cd } : null;
          }
          if (m === "temperature") {
            return trendTempStd ? { ab: trendTempStd.temp_limit_ab, bc: trendTempStd.temp_limit_bc, cd: trendTempStd.temp_limit_cd } : null;
          }
          return null;
        })();

        return (
          <VibrationTrendChart
            sensorId={activeTrendSensorId}
            metricKey={activeTrendMetric}
            sensorLabel={trendLabel}
            limits={trendLimits}
            onSelectRecord={(sensorDataId) => {
              setTrendSelectedSensorDataId(sensorDataId);
              const rowIdx = Object.entries(rowSensors).find(([, sid]) => sid === activeTrendSensorId)?.[0];
              if (rowIdx != null) setSelectedRow(Number(rowIdx));
            }}
            selectedSensorDataId={trendSelectedSensorDataId}
          />
        );
      })()}

      {/* DSP panel pod tabulkou */}
      {showDSP && activeRowIdx >= 0 && rowSensors[activeRowIdx] && (() => {
        const activeSensorId = rowSensors[activeRowIdx];
        const activeLatest = getDisplayData(activeSensorId);
        const activeRow = schemaRows[activeRowIdx];
        const activeLabel = activeRow?.label || activeRow?.name || `Bod ${activeRowIdx + 1}`;
        return (
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-4">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Spektrální analýza — <span className="text-blue-700">{activeLabel}</span>
                <span className="font-mono text-xs text-slate-400 ml-1">{activeSensorId}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <SensorDSPPanel
                sensorId={activeSensorId}
                initialRecordId={trendSelectedSensorDataId || activeLatest?.id}
                velStandard={standardsById[rowAssignments[activeRowIdx]?.velStandardId]}
                accStandard={standardsById[rowAssignments[activeRowIdx]?.accStandardId]}
                tempStandard={standardsById[rowAssignments[activeRowIdx]?.tempStandardId]}
                bearing={bearingsById[rowAssignments[activeRowIdx]?.bearingId]}
                temperature={getSensorById(activeSensorId)?.last_temperature}
                machineName={machine?.name}
                measurementPoint={schemaRows[activeRowIdx]?.label || schemaRows[activeRowIdx]?.name || `Bod ${activeRowIdx + 1}`}
              />
            </CardContent>
          </Card>
        );
      })()}

      {/* Dialog přiřazení senzoru */}
      {assignDialog && (
        <AssignSensorDialog
          open={!!assignDialog}
          onClose={() => setAssignDialog(null)}
          rowIndex={assignDialog.rowIndex}
          rowLabel={assignDialog.rowLabel}
          currentAssignment={rowAssignments[assignDialog.rowIndex] || {}}
          onAssign={assignSensor}
        />
      )}
    </div>
  );
}