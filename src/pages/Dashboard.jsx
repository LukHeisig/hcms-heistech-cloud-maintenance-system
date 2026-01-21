import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useViewMode } from "@/components/ViewModeContext";
import {
  AlertTriangle,
  Droplet,
  ClipboardCheck,
  Wrench,
  Activity,
  ArrowRight,
  ChevronRight,
  Clock,
  ArrowLeft,
  Building2,
  Factory,
  FileText,
  Image as ImageIcon,
  Camera,
  Upload,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import LineSelection from "../components/dashboard/LineSelection";
import MachineSelection from "../components/dashboard/MachineSelection";
import PointsList from "../components/dashboard/PointsList";

const formatInterval = (hours) => {
  if (!hours) return "-";
  if (hours % 730 === 0) {
    const months = hours / 730;
    return `${months} ${months === 1 ? 'měsíc' : months < 5 ? 'měsíce' : 'měsíců'}`;
  }
  if (hours % 168 === 0) {
    const weeks = hours / 168;
    return `${weeks} ${weeks === 1 ? 'týden' : weeks < 5 ? 'týdny' : 'týdnů'}`;
  }
  return `${hours} ${hours === 1 ? 'hodina' : hours < 5 ? 'hodiny' : 'hodin'}`;
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("lubrication");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const location = useLocation();

  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedCompany = urlParams.get('company');
  const selectedLine = urlParams.get('line');
  const selectedMachine = urlParams.get('machine');

  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [issuePhoto, setIssuePhoto] = useState(null);
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const issuePhotoInputRef = useRef(null);
  const issueCameraInputRef = useRef(null);

  const [showDocPreviewDialog, setShowDocPreviewDialog] = useState(false);
  const [selectedDocPreview, setSelectedDocPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [showEditPointDialog, setShowEditPointDialog] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [nfcChipId, setNfcChipId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);

  const [isConfirmingControl, setIsConfirmingControl] = useState(false);

  const selectedPoint = urlParams.get('point');
  const nfcScanned = urlParams.get('nfc_scanned') === 'true';

  useEffect(() => {
    loadUser();
    if ('NDEFReader' in window) {
      setNfcSupported(true);
    }
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name", 1000),
    enabled: user?.user_type === "admin" || user?.user_type === "superAdmin",
  });

  const { data: userCompany } = useQuery({
    queryKey: ["userCompany", user?.company_id],
    queryFn: () => base44.entities.Company.filter({ id: user.company_id }).then(res => res[0]),
    enabled: !!user?.company_id && user?.user_type !== "admin" && user?.user_type !== "superAdmin",
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(null, 1000),
  });

  const userMap = React.useMemo(() => {
    return allUsers.reduce((acc, u) => {
      acc[u.email] = u;
      return acc;
    }, {});
  }, [allUsers]);

  const getUserDisplayName = (email) => {
    const u = userMap[email];
    return u ? (u.custom_display_name || u.full_name || u.email) : email;
  };

  const companies = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "superAdmin") return allCompanies;
    if (user.user_type === "admin") {
      return allCompanies.filter(c =>
        user.assigned_company_ids?.includes(c.id)
      );
    }
    return [];
  }, [allCompanies, user]);

  const { data: lines = [], isLoading: isLoadingLines } = useQuery({
    queryKey: ["lines", user?.company_id],
    queryFn: () =>
      user?.company_id
        ? base44.entities.Line.filter({ company_id: user.company_id }, "order_index")
        : [],
    enabled: !!user?.company_id && user?.user_type !== "admin" && user?.user_type !== "superAdmin",
  });

  const { data: allLines = [], isLoading: isLoadingAllLines } = useQuery({
    queryKey: ["allLines"],
    queryFn: () => base44.entities.Line.list(null, 1000),
  });

  const { data: allMachines = [], isLoading: isLoadingMachines } = useQuery({
    queryKey: ["allMachines"],
    queryFn: () => base44.entities.Machine.list("order_index", 1000),
    enabled: !!user,
  });

  // Filtrovat stroje podle company_id pro non-admin uživatele
  const machines = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "admin" || user.user_type === "superAdmin") {
      return allMachines;
    }
    // Pro manager/technician vrátit pouze stroje z jejich podniku
    const userLineIds = lines.map(l => l.id);
    return allMachines.filter(m => userLineIds.includes(m.line_id));
  }, [user, allMachines, lines]);

  const { data: allControlPoints = [], isLoading: isLoadingControlPoints } = useQuery({
    queryKey: ["allControlPoints"],
    queryFn: () => base44.entities.ControlPoint.list(null, 1000),
    enabled: !!user,
  });

  // Filtrovat kontrolní body podle company_id pro non-admin uživatele
  const controlPoints = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "admin" || user.user_type === "superAdmin") {
      return allControlPoints;
    }
    // Pro manager/technician vrátit pouze body z jejich strojů
    const userMachineIds = machines.map(m => m.id);
    return allControlPoints.filter(cp => userMachineIds.includes(cp.machine_id));
  }, [user, allControlPoints, machines]);

  const { data: allRecords = [] } = useQuery({
    queryKey: ["allRecords"],
    queryFn: () => base44.entities.ControlRecord.list("-performed_at", 100),
    enabled: !!user,
  });

  // Filtrovat záznamy podle company_id pro non-admin uživatele
  const records = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "admin" || user.user_type === "superAdmin") {
      return allRecords;
    }
    // Pro manager/technician vrátit pouze záznamy z jejich bodů
    const userPointIds = controlPoints.map(p => p.id);
    return allRecords.filter(r => userPointIds.includes(r.control_point_id));
  }, [user, allRecords, controlPoints]);

  const { data: allIssues = [] } = useQuery({
    queryKey: ["allIssues"],
    queryFn: () => base44.entities.Issue.filter({ status: "reported" }, null, 1000),
    enabled: !!user,
  });

  // Filtrovat závady podle company_id pro non-admin uživatele
  const issues = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "admin" || user.user_type === "superAdmin") {
      return allIssues;
    }
    // Pro manager/technician vrátit pouze závady z jejich bodů
    const userPointIds = controlPoints.map(p => p.id);
    const userMachineIds = machines.map(m => m.id);
    return allIssues.filter(issue =>
      (issue.control_point_id && userPointIds.includes(issue.control_point_id)) ||
      (issue.machine_id && userMachineIds.includes(issue.machine_id))
    );
  }, [user, allIssues, controlPoints, machines]);

  const { data: documentation = [] } = useQuery({
    queryKey: ["documentation", selectedPoint],
    queryFn: () => base44.entities.Documentation.filter({ control_point_id: selectedPoint }),
    enabled: !!selectedPoint && viewMode === 'demip',
  });

  useEffect(() => {
    if (user && !user.company_id && user.user_type !== "admin" && user.user_type !== "superAdmin") {
      navigate(createPageUrl("PendingApproval"));
    }
  }, [user, navigate]);

  // Automaticky nastavit activeTab podle parametru v URL nebo maintenance_category stroje
  useEffect(() => {
    const categoryParam = urlParams.get('category');
    if (categoryParam) {
      setActiveTab(categoryParam);
      return;
    }

    if (selectedMachine && allMachines.length > 0) {
      // Filtrovat body pro vybraný stroj
      const machinePoints = controlPoints.filter(p => p.machine_id === selectedMachine);
      
      const counts = {
        lubrication: machinePoints.filter(p => p.type === 'lubrication').length,
        inspection: machinePoints.filter(p => p.type === 'inspection').length,
        auto_lubricator: machinePoints.filter(p => p.type === 'auto_lubricator').length,
        prevention: machinePoints.filter(p => p.type === 'prevention').length
      };

      // 1. Priorita: Mazání, pokud existuje
      if (counts.lubrication > 0) {
        setActiveTab("lubrication");
      } else {
        // 2. Najít kategorii s nejvíce body
        const maxCategory = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        
        if (counts[maxCategory] > 0) {
           setActiveTab(maxCategory);
        } else {
           // 3. Fallback pokud nejsou žádné body
           const machine = allMachines.find(m => m.id === selectedMachine);
           if (machine?.maintenance_category === "prevention") {
             setActiveTab("prevention");
           } else {
             setActiveTab("lubrication");
           }
        }
      }
    }
  }, [selectedMachine, allMachines, urlParams, controlPoints]);

  const getPointStatus = useCallback((point) => {
    const pointRecords = records.filter((r) => r.control_point_id === point.id);
    
    // Check company settings
    const machine = allMachines.find(m => m.id === point.machine_id);
    const line = allLines.find(l => l.id === machine?.line_id);
    const company = allCompanies.find(c => c.id === line?.company_id);
    
    const vizType = company?.overdue_visualization_type || "two_colors";
    const tolerance = company?.overdue_tolerance_percent || 4;

    const interval = point.interval_hours || 0;

    let lastPerformed;
    if (pointRecords.length > 0) {
        lastPerformed = new Date(pointRecords[0].performed_at);
    } else if (point.first_confirmation_date) {
        lastPerformed = new Date(point.first_confirmation_date);
    } else {
        // Never performed and no start date
        return vizType === "traffic_light" ? "critical" : "warning"; 
    }

    const now = new Date();
    const hoursSince = (now - lastPerformed) / (1000 * 60 * 60);

    if (hoursSince <= interval) return "ok";
    
    if (vizType === "two_colors") {
        return "warning"; // Yellow for overdue
    } else {
        // traffic_light
        const overduePercent = ((hoursSince - interval) / interval) * 100;
        if (overduePercent <= tolerance) {
            return "warning"; // Yellow
        } else {
            return "critical"; // Red
        }
    }
  }, [records, allMachines, allLines, allCompanies]);

  const getNextControlDate = useCallback((point) => {
    const pointRecords = records.filter(r => r.control_point_id === point.id);
    if (!point.interval_hours) return null;

    let lastPerformed;
    if (pointRecords.length > 0) {
        lastPerformed = new Date(pointRecords[0].performed_at);
    } else if (point.first_confirmation_date) {
        lastPerformed = new Date(point.first_confirmation_date);
    } else {
        return null;
    }

    const nextDate = new Date(lastPerformed.getTime() + point.interval_hours * 60 * 60 * 1000);
    return nextDate;
  }, [records]);

  const activeCompanies = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      return companies.filter(c =>
        c.is_active !== false &&
        !c.name.toLowerCase().includes('demo')
      );
    }
    return companies;
  }, [companies, user]);

  const activeCompanyIds = React.useMemo(() => activeCompanies.map(c => c.id), [activeCompanies]);

  const totalLinesCount = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      return allLines.filter(l => activeCompanyIds.includes(l.company_id)).length;
    }
    return lines.length;
  }, [user, allLines, lines, activeCompanyIds]);

  const activeControlPoints = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      const activeLinesIds = allLines
        .filter(l => activeCompanyIds.includes(l.company_id))
        .map(l => l.id);
      const activeMachineIds = machines // This `machines` is the useMemo, which for admins is `allMachines`. Correct.
        .filter(m => activeLinesIds.includes(m.line_id))
        .map(m => m.id);
      return controlPoints.filter(cp => activeMachineIds.includes(cp.machine_id)); // This `controlPoints` is the useMemo, which for admins is `allControlPoints`. Correct.
    }
    return controlPoints;
  }, [user, allLines, machines, controlPoints, activeCompanyIds]);

  const overduePointsCount = React.useMemo(() => {
    return activeControlPoints.filter(
      (point) => {
          const status = getPointStatus(point);
          return status === "overdue" || status === "warning" || status === "critical";
      }
    ).length;
  }, [activeControlPoints, getPointStatus]);

  const activeRecords = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      const activePointIds = activeControlPoints.map(p => p.id);
      return allRecords.filter(r => activePointIds.includes(r.control_point_id)); // Changed from records to allRecords, as records is now filtered.
    }
    return records;
  }, [user, records, activeControlPoints, allRecords]);

  const totalRecordsThisMonthCount = React.useMemo(() => {
    return activeRecords.filter((r) => {
      const date = new Date(r.performed_at);
      const now = new Date();
      return (
        date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [activeRecords]);

  const activeIssues = React.useMemo(() => {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      const activePointIds = activeControlPoints.map(p => p.id);
      const activeMachineIds = machines
        .filter(m => {
          const line = allLines.find(l => l.id === m.line_id);
          return line && activeCompanyIds.includes(line.company_id);
        })
        .map(m => m.id);
      return allIssues.filter(issue => // Changed from issues to allIssues
        (issue.control_point_id && activePointIds.includes(issue.control_point_id)) ||
        (issue.machine_id && activeMachineIds.includes(issue.machine_id))
      );
    }
    return issues;
  }, [user, issues, activeControlPoints, allIssues, machines, allLines, activeCompanyIds]);

  const issueMutation = useMutation({
    mutationFn: async (data) => {
      // Nahrát fotku, pokud existuje
      let photoUrl = null;
      if (data.photo) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: data.photo });
        photoUrl = file_url;
      }

      // Vytvořit závadu s photo_url nebo machine_id
      const issue = await base44.entities.Issue.create({
        control_point_id: data.control_point_id || null,
        machine_id: data.machine_id || null, // Allow machine_id
        description: data.description,
        photo_url: photoUrl,
        status: "reported",
      });

      // Poslat notifikace manažerům
      // Determine company_id first
      let companyIdToNotify = user?.company_id;
      
      // If issue is tied to a specific machine or control point, try to find its company_id
      if (!companyIdToNotify && (issue.machine_id || issue.control_point_id)) {
        let machineIdForLookup = issue.machine_id;
        
        if (!machineIdForLookup && issue.control_point_id) {
          const point = allControlPoints.find(p => p.id === issue.control_point_id); // Use allControlPoints for lookup
          machineIdForLookup = point?.machine_id;
        }
        
        if (machineIdForLookup) {
          const machine = allMachines.find(m => m.id === machineIdForLookup); // Use allMachines for lookup
          if (machine) {
            const line = allLines.find(l => l.id === machine.line_id);
            if (line) {
              companyIdToNotify = line.company_id;
            }
          }
        }
      }
      
      // If we found a company_id, notify relevant users
      if (companyIdToNotify) {
        const managersAndAdmins = allUsers.filter(u => 
          ((u.user_type === "manager" && u.company_id === companyIdToNotify) ||
           (u.user_type === "admin" && u.assigned_company_ids?.includes(companyIdToNotify)))
        );
        
        // Zjistit detaily pro email
        let locationInfo = "";
        if (issue.control_point_id) { // Prioritize control point detail
          const point = allControlPoints.find(p => p.id === issue.control_point_id); // Use allControlPoints for lookup
          if (point) {
            const machine = allMachines.find(m => m.id === point.machine_id); // Use allMachines for lookup
            if (machine) {
              const line = allLines.find(l => l.id === machine.line_id);
              locationInfo = `Kontrolní bod: ${point.name} na stroji ${machine.name}${line ? ` (Linka: ${line.name})` : ""}`;
            }
          }
        } else if (issue.machine_id) { // Fallback to machine detail if no control point
          const machine = allMachines.find(m => m.id === issue.machine_id); // Use allMachines for lookup
          if (machine) {
            const line = allLines.find(l => l.id === machine.line_id);
            locationInfo = `Stroj: ${machine.name}${line ? ` (Linka: ${line.name})` : ""}`;
          }
        }
        
        // Poslat email každému manažerovi/adminovi
        for (const manager of managersAndAdmins) {
          try {
            await base44.integrations.Core.SendEmail({
              to: manager.email,
              subject: `[HCMS] Nová závada nahlášena`,
              body: `Dobrý den,\n\nByla nahlášena nová závada v systému HCMS:\n\n${locationInfo}\n\nPopis závady:\n${issue.description}\n\nNahlásil: ${getUserDisplayName(user.email)}\n\nProsím přihlaste se do systému pro více informací a možnost vyřešení závady.\n\nS pozdravem,\nHCMS systém`,
            });
          } catch (error) {
            console.error(`Chyba při odesílání notifikace pro ${manager.email}:`, error);
          }
        }
      }

      return issue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allIssues"] }); // Invalidate allIssues
      setShowIssueDialog(false);
      setIssueDescription("");
      setIssuePhoto(null); // Clear issue photo
      setIsReportingIssue(false);
    },
    onError: () => {
      setIsReportingIssue(false);
      alert("Chyba při nahlášení závady.");
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ file, pointId }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      let detectedFileType = "other_file";
      if (file.type.startsWith("image/")) {
        detectedFileType = "photo";
      }

      return base44.entities.Documentation.create({
        control_point_id: pointId,
        file_url,
        file_name: file.name,
        file_type: detectedFileType,
        category: "other",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
      alert("Chyba při nahrávání souboru");
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id) => base44.entities.Documentation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentation"] });
      setDeleteDocId(null);
      setSelectedDocPreview(null);
    },
    onError: () => {
      alert("Chyba při mazání dokumentu.");
    },
  });

  const updateControlPointMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ControlPoint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allControlPoints"] }); // Invalidate allControlPoints
      setShowEditPointDialog(false);
      setEditingPoint(null);
      setNfcChipId("");
    },
    onError: (error) => {
      console.error("Error updating control point:", error);
      alert("Chyba při ukládání kontrolního bodu: " + (error.message || "Neznámá chyba"));
    },
  });

  const createControlRecordMutation = useMutation({
    mutationFn: (data) => base44.entities.ControlRecord.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allRecords"] }); // Invalidate allRecords
      queryClient.invalidateQueries({ queryKey: ["allControlPoints"] }); // Invalidate allControlPoints
      setIsConfirmingControl(false);

      const newSearch = window.location.search.replace(/[?&]nfc_scanned=true/, '');
      const newUrl = window.location.pathname + (newSearch.startsWith('&') ? '?' + newSearch.substring(1) : newSearch);

      window.history.replaceState({}, '', newUrl);
    },
    onError: () => {
      setIsConfirmingControl(false);
      alert("Chyba při potvrzení kontroly");
    },
  });

  const handleReportIssue = async (pointId, machineId) => { // Added machineId
    if (!issueDescription.trim()) return;
    setIsReportingIssue(true);

    await issueMutation.mutateAsync({
      control_point_id: pointId || null,
      machine_id: machineId || null, // Pass machineId
      description: issueDescription,
      photo: issuePhoto, // Pass issuePhoto
    });
  };

  const handleFileSelect = async (event, pointId) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    await uploadDocumentMutation.mutateAsync({ file, pointId });
  };

  const handleCameraCapture = async (event, pointId) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    await uploadDocumentMutation.mutateAsync({ file, pointId });
  };

  const handleEditPoint = (point) => {
    setEditingPoint(point);
    setNfcChipId(point.nfc_chip_id || "");
    setShowEditPointDialog(true);
  };

  const handleSavePoint = async () => {
    if (!editingPoint) return;

    await updateControlPointMutation.mutateAsync({
      id: editingPoint.id,
      data: {
        nfc_chip_id: nfcChipId.trim() ? nfcChipId.trim() : null,
      },
    });
  };

  const handleNfcScan = async () => {
    if (!nfcSupported) {
      alert("NFC není podporováno v tomto prohlížeči. Použijte prosím Chrome na Androidu.");
      return;
    }

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      const abortController = new AbortController();
      
      await ndef.scan({ signal: abortController.signal });

      const timeoutId = setTimeout(() => {
        abortController.abort();
        alert("Časový limit čtení NFC vypršel (10s).");
        setIsScanning(false);
      }, 10000);

      ndef.addEventListener("reading", ({ serialNumber }) => {
        clearTimeout(timeoutId);
        setNfcChipId(serialNumber);
        setIsScanning(false);
        abortController.abort();
      }, { signal: abortController.signal });

      ndef.addEventListener("readingerror", (event) => {
        clearTimeout(timeoutId);
        console.error("NFC reading error:", event);
        alert("Chyba při čtení NFC čipu.");
        setIsScanning(false);
        abortController.abort();
      }, { signal: abortController.signal });

    } catch (error) {
      console.error("NFC scan initiation error:", error);
      alert("Chyba při spuštění skenování NFC: " + (error.message || "Neznámá chyba"));
      setIsScanning(false);
    }
  };

  const handleConfirmControl = async (point) => {
    if (!point) return;
    setIsConfirmingControl(true);

    const recordType = point.type === "auto_lubricator" 
      ? "lubricator_change" 
      : point.type === "inspection" 
      ? "inspection" 
      : point.type === "prevention" 
      ? "prevention" 
      : "lubrication";

    await createControlRecordMutation.mutateAsync({
      control_point_id: point.id,
      record_type: recordType,
      performed_at: new Date().toISOString(),
    });
  };



  const handleImageError = (docId) => {
    setImageErrors(prev => ({ ...prev, [docId]: true }));
  };

  const demipCompanies = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeCompanies
    : [];

  const demipAllLines = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? allLines
    : lines;

  const demipMachines = useMemo(() => machines, [machines]); // Use the useMemo 'machines' which is already filtered correctly by role.

  const demipControlPoints = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeControlPoints
    : controlPoints; // Use the useMemo 'controlPoints' which is already filtered correctly by role.

  const demipIssues = (user?.user_type === "admin" || user?.user_type === "superAdmin")
    ? activeIssues
    : issues; // Use the useMemo 'issues' which is already filtered correctly by role.

  if (viewMode === 'demip') {
    if (selectedPoint) {
      const currentPoint = demipControlPoints.find(p => p.id === selectedPoint);
      
      if (!currentPoint) {
        const isDataLoading = isLoadingAllLines || isLoadingMachines || isLoadingControlPoints || (user?.user_type !== "admin" && user?.user_type !== "superAdmin" && isLoadingLines);
        
        if (isDataLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          );
        }

        return (
          <div className="p-8">
            <div className="bg-red-100 border-2 border-red-600 rounded-lg p-4 mb-4">
              <h3 className="text-red-900 font-bold text-lg mb-2">❌ KONTROLNÍ BOD NENALEZEN</h3>
              <p className="text-slate-600">Kontrolní bod s tímto ID nebyl nalezen.</p>
            </div>
          </div>
        );
      }

      const currentMachineForPoint = demipMachines.find(m => m.id === currentPoint.machine_id);
      const currentLineForPoint = demipAllLines.find(l => l.id === currentMachineForPoint?.line_id);
      
      const pointRecords = records.filter(r => r.control_point_id === selectedPoint);
      const pointIssues = demipIssues.filter(i => i.control_point_id === selectedPoint);
      const status = getPointStatus(currentPoint);
      const nextDate = getNextControlDate(currentPoint);
      const lastRecord = pointRecords[0];
      const isOverdue = status === "overdue";

      const canEdit = user?.user_type === "manager" || user?.user_type === "admin" || user?.user_type === "superAdmin";
      
      const activeCompanySettings = user?.user_type === "admin" || user?.user_type === "superAdmin"
        ? allCompanies.find(c => c.id === currentLineForPoint?.company_id)
        : userCompany;

      const manualConfirmationAllowed = activeCompanySettings?.allow_manual_confirmation !== false;

      // Určit, zda zobrazit tlačítko potvrzení
      // Pro prevention s ručním potvrzením - zobrazit vždy (pokud je povoleno globálně)
      // Pro prevention s NFC nebo jiné typy bodů - zobrazit pouze po NFC skenu
      const shouldShowConfirmButton = 
        (currentPoint.type === "prevention" && currentPoint.prevention_confirmation_method === "manual" && manualConfirmationAllowed) || 
        nfcScanned;

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
            <div className="max-w-5xl mx-auto p-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const category = urlParams.get('category') || activeTab;
                  const url = selectedCompany
                    ? `Dashboard?company=${selectedCompany}&line=${selectedLine}&machine=${selectedMachine}&category=${category}`
                    : `Dashboard?line=${selectedLine}&machine=${selectedMachine}&category=${category}`;
                  navigate(createPageUrl(url));
                }}
                className="text-white hover:bg-white/20 mb-3"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zpět na kontrolní body
              </Button>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-xl font-bold leading-tight mb-1">
                    {currentPoint.number && `${currentPoint.number} - `}
                    {currentPoint.name}
                  </h1>
                  <div className="flex items-center gap-2 text-xs text-blue-100 mt-1 mb-2 opacity-90">
                    <span>{currentLineForPoint?.name || "Neznámá linka"}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span>{currentMachineForPoint?.name || "Neznámý stroj"}</span>
                  </div>
                  {currentPoint.description && (
                    <p className="text-sm text-blue-100 opacity-90">
                      {currentPoint.description}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditPoint(currentPoint)}
                    className="text-white hover:bg-white/20 flex-shrink-0"
                  >
                    <Pencil className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto p-3 md:p-6 space-y-3 md:space-y-4">
            <Card className="shadow-lg">
              <CardContent className="p-3 md:p-6 space-y-2">
                {currentPoint.type === "lubrication" && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-600">Typ maziva:</span>
                      <span className="font-semibold text-slate-900">{currentPoint.lubricant_type || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-600">Množství pro doplnění:</span>
                      <span className="font-semibold text-slate-900">
                        {currentPoint.lubricant_amount ? `${currentPoint.lubricant_amount} g` : "-"}
                      </span>
                    </div>
                  </>
                )}
                {currentPoint.type === "inspection" && currentPoint.inspection_tasks && (
                  <div className="py-2 border-b border-slate-200">
                    <p className="text-sm text-slate-600 mb-1">Inspekční úkoly:</p>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{currentPoint.inspection_tasks}</p>
                  </div>
                )}
                {currentPoint.type === "prevention" && (
                  <>
                    {currentPoint.inspection_tasks && (
                      <div className="py-2 border-b border-slate-200">
                        <p className="text-sm text-slate-600 mb-1">Preventivní úkoly:</p>
                        <p className="text-sm text-slate-900 whitespace-pre-wrap">{currentPoint.inspection_tasks}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-600">Časový interval:</span>
                      <span className="font-semibold text-slate-900">
                        {formatInterval(currentPoint.interval_hours)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">
                    Naposledy {currentPoint.type === "lubrication" ? "mazáno" : "kontrolováno"}:
                  </span>
                  <span className="font-semibold text-slate-900 text-right">
                    {lastRecord
                      ? format(new Date(lastRecord.performed_at), "d.M.yyyy HH:mm", { locale: cs })
                      : "Dosud neprovedeno"
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Interval:</span>
                  <span className="font-semibold text-slate-900">
                    {formatInterval(currentPoint.interval_hours)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-slate-600">Datum další kontroly:</span>
                  <div className="text-right">
                    <span className={`font-bold text-lg ${isOverdue ? "text-red-600" : "text-green-600"}`}>
                      {nextDate ? format(nextDate, "d.M.yyyy", { locale: cs }) : "-"}
                    </span>
                    {isOverdue && (
                      <Badge className="ml-2 bg-red-600 text-white text-xs">Po termínu</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {shouldShowConfirmButton && (
              <Button
                onClick={() => handleConfirmControl(currentPoint)}
                disabled={isConfirmingControl}
                className="w-full h-14 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-xl text-lg font-semibold"
              >
                {isConfirmingControl ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Potvrzování...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-6 h-6 mr-2" />
                    Potvrdit kontrolu
                  </>
                )}
              </Button>
            )}

            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base md:text-lg">
                  Historie {currentPoint.type === "lubrication" ? "mazání" : "kontrol"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {pointRecords.length === 0 ? (
                  <p className="text-center text-slate-500 py-6 text-sm">Zatím nejsou žádné záznamy</p>
                ) : (
                  <div className="space-y-2">
                    {pointRecords.map((record) => (
                      <div key={record.id} className="bg-slate-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900 text-sm">
                            {format(new Date(record.performed_at), "d.M.yyyy HH:mm", { locale: cs })}
                          </span>
                          <span className="text-xs text-slate-600">
                            {getUserDisplayName(record.created_by)}
                          </span>
                        </div>
                        {record.note && (
                          <p className="text-sm text-slate-600">{record.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {pointIssues.length > 0 && (
              <Card className="shadow-lg border-2 border-orange-300 bg-orange-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base md:text-lg text-orange-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                    Aktivní závady ({pointIssues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {pointIssues.map((issue) => (
                    <div key={issue.id} className="bg-white p-3 rounded-lg border border-orange-200">
                      <p className="text-sm text-slate-900 mb-1">{issue.description}</p>
                      {issue.photo_url && (
                        <div className="mt-2">
                          <img src={issue.photo_url} alt="Závada" className="max-h-24 object-contain rounded-md" />
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        {format(new Date(issue.created_date), "d.M.yyyy HH:mm", { locale: cs })} • {getUserDisplayName(issue.created_by)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                    Fotodokumentace
                  </CardTitle>
                  <div className="flex gap-2">
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleCameraCapture(e, selectedPoint)}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isUploading}
                      className="h-8 px-2 md:px-3"
                    >
                      <Camera className="w-4 h-4 md:mr-1" />
                      <span className="hidden md:inline">Vyfotit</span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e, selectedPoint)}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="h-8 px-2 md:px-3"
                    >
                      <Upload className="w-4 h-4 md:mr-1" />
                      <span className="hidden md:inline">Nahrát</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {isUploading && (
                  <div className="flex items-center justify-center py-6 bg-slate-50 rounded-lg mb-3">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
                    <span className="text-sm text-slate-600">Nahrávání...</span>
                  </div>
                )}
                {documentation.length === 0 && !isUploading ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Zatím není žádná dokumentace</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                    {documentation.map((doc) => (
                      <div
                        key={doc.id}
                        className="group relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedDocPreview(doc);
                          setShowDocPreviewDialog(true);
                        }}
                      >
                        {doc.file_type === "photo" && !imageErrors[doc.id] ? (
                          <img
                            src={doc.file_url}
                            alt={doc.file_name || "Dokumentace"}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={() => handleImageError(doc.id)}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full bg-slate-100">
                            <FileText className="w-8 h-8 text-slate-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDocId(doc.id);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={() => setShowIssueDialog(true)}
              className="w-full h-12 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg"
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              Nahlásit závadu
            </Button>
          </div>

          <Dialog open={showDocPreviewDialog} onOpenChange={setShowDocPreviewDialog}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-4 border-b">
                <DialogTitle>{selectedDocPreview?.file_name}</DialogTitle>
                <DialogDescription>
                  {selectedDocPreview && format(new Date(selectedDocPreview.created_date), "d.M.yyyy HH:mm", { locale: cs })}
                  {selectedDocPreview?.created_by && ` • ${getUserDisplayName(selectedDocPreview.created_by)}`}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-slate-50">
                {selectedDocPreview?.file_type === "photo" ? (
                  <img
                    src={selectedDocPreview.file_url}
                    alt={selectedDocPreview.file_name}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                <div style={{ display: selectedDocPreview?.file_type !== "photo" ? 'block' : 'none' }} className="text-center">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">Náhled není dostupný</p>
                </div>
              </div>
              <DialogFooter className="p-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => selectedDocPreview?.file_url && window.open(selectedDocPreview.file_url, "_blank")}
                >
                  Otevřít v nové záložce
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDocPreviewDialog(false);
                    setDeleteDocId(selectedDocPreview?.id);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Smazat
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Opravdu smazat fotografii?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce je nevratná. Fotografie bude trvale odstraněna.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteDocumentMutation.mutate(deleteDocId)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Smazat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={showEditPointDialog} onOpenChange={setShowEditPointDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-blue-600" />
                  Upravit kontrolní bod
                </DialogTitle>
                <DialogDescription>
                  {editingPoint?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="nfc_chip_id">NFC čip ID</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="nfc_chip_id"
                      value={nfcChipId}
                      onChange={(e) => setNfcChipId(e.target.value)}
                      placeholder="Zadejte nebo naskenujte ID čipu"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleNfcScan}
                      disabled={isScanning || !nfcSupported}
                      variant="outline"
                      className="flex-shrink-0"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Skenování...
                        </>
                      ) : (
                        <>
                          <Activity className="w-4 h-4 mr-2" />
                          Skenovat
                        </>
                      )}
                    </Button>
                  </div>
                  {!nfcSupported && (
                    <p className="text-xs text-orange-600 mt-2">
                      NFC není podporováno v tomto prohlížeči. Použijte Chrome na Androidu.
                    </p>
                  )}
                  {isScanning && (
                    <p className="text-xs text-blue-600 mt-2">
                      Přiložte NFC čip k zařízení...
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditPointDialog(false);
                    setEditingPoint(null);
                    setNfcChipId("");
                  }}
                  disabled={updateControlPointMutation.isLoading}
                >
                  Zrušit
                </Button>
                <Button
                  onClick={handleSavePoint}
                  disabled={updateControlPointMutation.isLoading}
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                >
                  {updateControlPointMutation.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Ukládání...
                    </>
                  ) : (
                    "Uložit"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showIssueDialog} onOpenChange={(isOpen) => {
            setShowIssueDialog(isOpen);
            if (!isOpen) { // Clear on close
              setIssueDescription("");
              setIssuePhoto(null);
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="w-5 h-5" />
                  Nahlásit závadu
                </DialogTitle>
                <DialogDescription>
                  Popište zjištěnou závadu{selectedPoint ? " na kontrolním bodě" : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="description">Popis závady *</Label>
                  <Textarea
                    id="description"
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Popište podrobně zjištěnou závadu..."
                    rows={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="issue_photo">Fotografie závady (volitelné)</Label>
                  <div className="flex gap-2 mt-2">
                    <input
                      ref={issuePhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setIssuePhoto(file);
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => issuePhotoInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {issuePhoto ? issuePhoto.name : "Nahrát fotku"}
                    </Button>
                    <input
                      ref={issueCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setIssuePhoto(file);
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => issueCameraInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                    {issuePhoto && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setIssuePhoto(null)}
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                  {issuePhoto && (
                    <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-600">Vybraná fotka: {issuePhoto.name}</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowIssueDialog(false);
                    setIssueDescription("");
                    setIssuePhoto(null);
                  }}
                  disabled={isReportingIssue}
                >
                  Zrušit
                </Button>
                <Button
                  onClick={() => handleReportIssue(selectedPoint, null)}
                  disabled={!issueDescription.trim() || isReportingIssue}
                  className="bg-gradient-to-r from-orange-600 to-orange-700"
                >
                  {isReportingIssue ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Ukládání...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Nahlásit závadu
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        );
        }
        }

        if (viewMode === 'demip') {

    const companyId = selectedCompany || user?.company_id;
    const currentCompany = allCompanies.find(c => c.id === companyId);
    const companyLines = demipAllLines.filter(l => l.company_id === companyId);

    const currentLine = demipAllLines.find(l => l.id === selectedLine);
    const lineMachines = demipMachines.filter(m => m.line_id === selectedLine);

    const currentMachine = demipMachines.find(m => m.id === selectedMachine);
    const machinePoints = demipControlPoints.filter(p => p.machine_id === selectedMachine);

    return (
      <div className="relative">
        <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
          {((user?.user_type === "admin" || user?.user_type === "superAdmin") && !selectedCompany) && (
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-6">Výběr podniku - DEMIP</h1>
              <div className="space-y-2">
                {demipCompanies.map((company) => {
                  const companyLines = demipAllLines.filter(l => l.company_id === company.id);
                  const companyLineIds = companyLines.map(l => l.id);
                  const companyMachines = demipMachines.filter(m => companyLineIds.includes(m.line_id));
                  const companyMachineIds = companyMachines.map(m => m.id);
                  const companyPoints = demipControlPoints.filter(p => companyMachineIds.includes(p.machine_id));
                  const companyOverdue = companyPoints.filter(p => getPointStatus(p) === "overdue").length;

                  return (
                    <div
                      key={company.id}
                      className="group relative bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all cursor-pointer"
                      onClick={() => navigate(createPageUrl(`Dashboard?company=${company.id}`))}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-blue-200 shadow-lg text-white">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-slate-900 text-lg">{company.name}</h3>
                            {companyOverdue > 0 && (
                              <div className="flex items-center justify-center px-2 py-1 bg-red-100 rounded-full">
                                <span className="text-xs font-bold text-red-600">{companyOverdue} !</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 font-medium">
                            {companyLines.length} linek • {companyPoints.length} bodů
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(!selectedLine && !(user?.user_type === "admin" || user?.user_type === "superAdmin")) && (
            <LineSelection
              user={user}
              selectedCompany={selectedCompany}
              currentCompany={currentCompany}
              companyLines={companyLines}
              demipMachines={demipMachines}
              demipControlPoints={demipControlPoints}
              getPointStatus={getPointStatus}
            />
          )}

          {((user?.user_type === "admin" || user?.user_type === "superAdmin") && selectedCompany && !selectedLine) && (
            <LineSelection
              user={user}
              selectedCompany={selectedCompany}
              currentCompany={currentCompany}
              companyLines={companyLines}
              demipMachines={demipMachines}
              demipControlPoints={demipControlPoints}
              getPointStatus={getPointStatus}
            />
          )}

          {(selectedLine && !selectedMachine) && (
            <MachineSelection
              selectedCompany={selectedCompany}
              selectedLine={selectedLine}
              currentLine={currentLine}
              lineMachines={lineMachines}
              demipControlPoints={demipControlPoints}
              getPointStatus={getPointStatus}
            />
          )}

          {(selectedMachine && !selectedPoint) && (
            <PointsList
              selectedCompany={selectedCompany}
              selectedLine={selectedLine}
              selectedMachine={selectedMachine}
              currentLine={currentLine}
              currentMachine={currentMachine}
              machinePoints={machinePoints}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              records={records}
              demipIssues={demipIssues}
              getPointStatus={getPointStatus}
              getNextControlDate={getNextControlDate}
            />
          )}
        </div>


      </div>
      );
      }

      if (viewMode === 'maintenance') {
    if (user?.user_type === "admin" || user?.user_type === "superAdmin") {
      return (
        <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
              <p className="text-slate-600">
                {user?.user_type === "superAdmin"
                  ? "Přehled všech podniků v systému"
                  : `Přehled vašich ${activeCompanies.length} přiřazených podniků`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium mb-1">Aktivní podniky</p>
                      <p className="text-4xl font-bold">{activeCompanies.length}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Wrench className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium mb-1">Celkem linek</p>
                      <p className="text-4xl font-bold">{totalLinesCount}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-red-100 text-sm font-medium mb-1">Po termínu</p>
                      <p className="text-4xl font-bold">{overduePointsCount}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium mb-1">Záznamů tento měsíc</p>
                      <p className="text-4xl font-bold">{totalRecordsThisMonthCount}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <ClipboardCheck className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="border-none shadow-lg">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Activity className="w-5 h-5 text-slate-600" />
                        Přehled výroby - Linky
                      </CardTitle>
                      {user?.user_type === "superAdmin" && (
                        <Button
                          onClick={() => navigate(createPageUrl("Admin"))}
                          size="sm"
                          variant="outline"
                        >
                          <ArrowRight className="w-4 h-4 mr-2" />
                          Správa struktury
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {activeCompanies.length === 0 ? (
                      <div className="text-center py-12">
                        <Factory className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          {user?.user_type === "superAdmin"
                            ? "Zatím nemáte žádné aktivní podniky"
                            : "Nemáte přiřazené žádné aktivní podniky"}
                        </h3>
                        <p className="text-slate-500 mb-6">
                          {user?.user_type === "superAdmin"
                            ? "Začněte vytvořením prvního podniku"
                            : "Kontaktujte superAdmina pro přiřazení podniků"}
                        </p>
                        {user?.user_type === "superAdmin" && (
                          <Button
                            onClick={() => navigate(createPageUrl("Admin"))}
                            className="bg-gradient-to-r from-red-600 to-red-700"
                          >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Správa struktury
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {activeCompanies.map((company) => {
                          const companyLines = allLines.filter((l) => l.company_id === company.id);
                          const companyMachines = allMachines.filter((m) =>
                            companyLines.some((l) => l.id === m.line_id)
                          );
                          const companyPoints = allControlPoints.filter((point) =>
                            companyMachines.some((m) => m.id === point.machine_id)
                          );
                          const companyOverdue = companyPoints.filter(
                            (point) => getPointStatus(point) === "overdue"
                          ).length;
                          const companyIssues = allIssues.filter((issue) =>
                            companyPoints.some((point) => point.id === issue.control_point_id)
                          ).length;

                          return (
                            <div key={company.id} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                                    <Building2 className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold text-slate-900">{company.name}</h3>
                                    <p className="text-sm text-slate-600">{companyLines.length} linek</p>
                                  </div>
                                </div>
                                <Button
                                  onClick={() => navigate(createPageUrl(`Admin`))}
                                  size="sm"
                                  variant="ghost"
                                >
                                  Spravovat
                                </Button>
                              </div>

                              <div className="grid gap-3 pl-13">
                                {companyLines.map((line) => {
                                  const lineMachines = allMachines.filter((m) => m.line_id === line.id);
                                  const linePoints = allControlPoints.filter((point) =>
                                    lineMachines.some((m) => m.id === point.machine_id)
                                  );
                                  const lineOverdue = linePoints.filter((point) => getPointStatus(point) === "overdue").length;
                                  const lineIssues = allIssues.filter((issue) =>
                                    linePoints.some((point) => point.id === issue.control_point_id)
                                  ).length;

                                  return (
                                    <div
                                      key={line.id}
                                      onClick={() => navigate(createPageUrl(`LineDetail?id=${line.id}&company=${company.id}`))}
                                      className="cursor-pointer"
                                    >
                                      <Card className="hover:shadow-md transition-all border border-slate-200 hover:border-slate-300">
                                        <CardContent className="p-4">
                                          <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3 flex-1">
                                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Factory className="w-4 h-4 text-slate-600" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <h4 className="font-semibold text-slate-900 text-sm">{line.name}</h4>
                                                  {lineOverdue > 0 && (
                                                    <Badge variant="destructive" className="gap-1 text-xs">
                                                      <AlertTriangle className="w-3 h-3" />
                                                      {lineOverdue}
                                                    </Badge>
                                                  )}
                                                  {lineIssues > 0 && (
                                                    <Badge className="bg-orange-100 text-orange-700 gap-1 text-xs">
                                                      <AlertTriangle className="w-3 h-3" />
                                                      {lineIssues}
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                                  <span>{lineMachines.length} strojů</span>
                                                  <span>·</span>
                                                  <span>{linePoints.length} bodů</span>
                                                </div>
                                              </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 ml-2" />
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-none shadow-lg">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="w-5 h-5 text-slate-600" />
                      Poslední záznamy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {activeRecords.length === 0 ? (
                      <p className="text-center text-slate-500 py-8 text-sm">Zatím nejsou žádné záznamy</p>
                    ) : (
                      <div className="space-y-3">
                        {activeRecords.slice(0, 5).map((record) => {
                          const point = allControlPoints.find((cp) => cp.id === record.control_point_id); // Use allControlPoints for lookup
                          return (
                            <div key={record.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                              <div className="flex-shrink-0 mt-1">
                                {record.record_type === "lubrication" ? (
                                  <Droplet className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ClipboardCheck className="w-4 h-4 text-purple-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{point?.name || "Neznámý bod"}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {format(new Date(record.performed_at), "d. M. yyyy HH:mm", { locale: cs })}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">{getUserDisplayName(record.created_by)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {activeIssues.length > 0 && (
                  <Card className="border-none shadow-lg border-l-4 border-l-orange-500">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
                        <AlertTriangle className="w-5 h-5" />
                        Aktivní závady
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {activeIssues.slice(0, 3).map((issue) => {
                          const point = allControlPoints.find((cp) => cp.id === issue.control_point_id); // Use allControlPoints for lookup
                          return (
                            <div key={issue.id} className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                              <p className="text-sm font-medium text-slate-900 mb-1">{point?.name || "Neznámý bod"}</p>
                              <p className="text-xs text-slate-600 line-clamp-2">{issue.description}</p>
                              {issue.photo_url && (
                                <div className="mt-2">
                                  <img src={issue.photo_url} alt="Závada" className="max-h-20 object-contain rounded-md" />
                                </div>
                              )}
                              <p className="text-xs text-slate-500 mt-2">
                                {format(new Date(issue.created_date), "d. M. yyyy", { locale: cs })} • {getUserDisplayName(issue.created_by)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {activeIssues.length > 3 && (
                        <Link to={createPageUrl("IssueApproval")} className="block text-center text-sm text-orange-700 hover:text-orange-800 font-medium mt-4">
                          Zobrazit všechny závady →
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (lines.length === 0 && user?.company_id) {
      return (
        <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
          <div className="max-w-3xl mx-auto">
            <Card className="shadow-xl">
              <CardContent className="p-12 text-center">
                <Activity className="w-20 h-20 text-slate-300 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Začněte s HCMS</h2>
                <p className="text-slate-600 mb-8">
                  Zatím nemáte vytvořené žádné linky. Vytvořte demo data nebo začněte s vlastní strukturou.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => navigate(createPageUrl("Setup"))} className="bg-gradient-to-r from-red-600 to-red-700">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Vytvořit demo data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
            <p className="text-slate-600">Přehled stavu mazacích a inspekčních plánů</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium mb-1">Celkem linek</p>
                    <p className="text-4xl font-bold">{totalLinesCount}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium mb-1">Kontrolní body</p>
                    <p className="text-4xl font-bold">{controlPoints.length}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Droplet className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium mb-1">Po termínu</p>
                    <p className="text-4xl font-bold">{overduePointsCount}</p>
                    </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium mb-1">Záznamů tento měsíc</p>
                    <p className="text-4xl font-bold">{totalRecordsThisMonthCount}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Activity className="w-5 h-5 text-slate-600" />
                    Přehled výroby - Linky
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-4">
                    {lines.map((line) => {
                      const lineMachines = machines.filter((m) => m.line_id === line.id);
                      const linePoints = controlPoints.filter((point) =>
                        lineMachines.some((m) => m.id === point.machine_id)
                      );
                      const lineOverdue = linePoints.filter((point) => getPointStatus(point) === "overdue").length;
                      const lineIssues = issues.filter((issue) =>
                        linePoints.some((point) => point.id === issue.control_point_id)
                      ).length;

                      return (
                        <div
                          key={line.id}
                          onClick={() => navigate(createPageUrl(`LineDetail?id=${line.id}`))}
                          className="cursor-pointer"
                        >
                          <Card className="hover:shadow-md transition-all border border-slate-200 hover:border-slate-300">
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-bold text-slate-900">{line.name}</h3>
                                    {lineOverdue > 0 && (
                                      <Badge variant="destructive" className="gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {lineOverdue}
                                      </Badge>
                                    )}
                                    {lineIssues > 0 && (
                                      <Badge className="bg-orange-100 text-orange-700 gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {lineIssues}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-slate-600">
                                    <span className="flex items-center gap-1">
                                      <Activity className="w-4 h-4" />
                                      {lineMachines.length} strojů
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Droplet className="w-4 h-4" />
                                      {linePoints.length} bodů
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  {lineOverdue > 0 ? (
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                  ) : (
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-lg">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="w-5 h-5 text-slate-600" />
                    Poslední záznamy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {records.length === 0 ? (
                    <p className="text-center text-slate-500 py-8 text-sm">Zatím nejsou žádné záznamy</p>
                  ) : (
                    <div className="space-y-3">
                      {records.slice(0, 5).map((record) => {
                        const point = controlPoints.find((cp) => cp.id === record.control_point_id);
                        return (
                          <div key={record.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex-shrink-0 mt-1">
                              {record.record_type === "lubrication" ? (
                                <Droplet className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ClipboardCheck className="w-4 h-4 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{point?.name || "Neznámý bod"}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {format(new Date(record.performed_at), "d. M. yyyy HH:mm", { locale: cs })}
                              </p>
                              <p className="text-xs text-slate-600 mt-1">{getUserDisplayName(record.created_by)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {issues.length > 0 && user?.user_type !== "technician" && (
                <Card className="border-none shadow-lg border-l-4 border-l-orange-500">
                  <CardHeader className="border-b border-slate-100">
                    <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
                      <AlertTriangle className="w-5 h-5" />
                      Aktivní závady
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {issues.slice(0, 3).map((issue) => {
                        const point = controlPoints.find((cp) => cp.id === issue.control_point_id);
                        return (
                          <div key={issue.id} className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                            <p className="text-sm font-medium text-slate-900 mb-1">{point?.name || "Neznámý bod"}</p>
                            <p className="text-xs text-slate-600 line-clamp-2">{issue.description}</p>
                            {issue.photo_url && (
                              <div className="mt-2">
                                <img src={issue.photo_url} alt="Závada" className="max-h-20 object-contain rounded-md" />
                              </div>
                            )}
                            <p className="text-xs text-slate-500 mt-2">
                              {format(new Date(issue.created_date), "d. M. yyyy", { locale: cs })} • {getUserDisplayName(issue.created_by)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {issues.length > 3 && (
                      <Link to={createPageUrl("IssueApproval")} className="block text-center text-sm text-orange-700 hover:text-orange-800 font-medium mt-4">
                        Zobrazit všechny závady →
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div className="p-8">Dashboard - DEMIP režim je ve vývoji</div>;
}