import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export default function AdminThermo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [formData, setFormData] = useState({
    diagnostician_name: "",
    diagnostician_qualification: "",
    camera_model: "",
    camera_manufacturer: "",
    calibration_date: "",
    technicians: [],
  });

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => base44.entities.Company.list("name"),
    enabled: !!user,
  });

  const companies = React.useMemo(() => {
    if (!user) return [];
    if (user.user_type === "superAdmin") return allCompanies;
    if (user.user_type === "admin") {
      return allCompanies.filter(c => user.assigned_company_ids?.includes(c.id));
    }
    return [];
  }, [allCompanies, user]);

  // Determine which company to edit
  useEffect(() => {
    if (user && companies.length > 0 && !selectedCompanyId) {
      // If user has a primary company_id and it's in the list, use it
      if (user.company_id && companies.some(c => c.id === user.company_id)) {
        setSelectedCompanyId(user.company_id);
      } else {
        // Otherwise select the first available company
        setSelectedCompanyId(companies[0].id);
      }
    }
  }, [user, companies, selectedCompanyId]);

  const { data: settings } = useQuery({
    queryKey: ["thermoSettings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await base44.entities.ThermoSettings.filter({ company_id: selectedCompanyId });
      return res[0] || null;
    },
    enabled: !!selectedCompanyId,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (settings) {
      let formattedDate = "";
      if (settings.calibration_date) {
        try {
          formattedDate = format(new Date(settings.calibration_date), 'yyyy-MM-dd');
        } catch (e) {
          console.error("Invalid date format:", settings.calibration_date);
          formattedDate = settings.calibration_date; // Fallback
        }
      }

      setFormData({
        diagnostician_name: settings.diagnostician_name || "",
        diagnostician_qualification: settings.diagnostician_qualification || "",
        camera_model: settings.camera_model || "",
        camera_manufacturer: settings.camera_manufacturer || "",
        calibration_date: formattedDate,
        technicians: settings.technicians || [],
      });
    } else {
      setFormData({
        diagnostician_name: "",
        diagnostician_qualification: "",
        camera_model: "",
        camera_manufacturer: "",
        calibration_date: "",
        technicians: [],
      });
    }
  }, [settings, selectedCompanyId]);

  const addTechnician = () => {
    setFormData({
      ...formData,
      technicians: [...(formData.technicians || []), { name: "", qualification: "" }]
    });
  };

  const removeTechnician = (index) => {
    const newTechnicians = [...(formData.technicians || [])];
    newTechnicians.splice(index, 1);
    setFormData({
      ...formData,
      technicians: newTechnicians
    });
  };

  const updateTechnician = (index, field, value) => {
    const newTechnicians = [...(formData.technicians || [])];
    newTechnicians[index] = { ...newTechnicians[index], [field]: value };
    setFormData({
      ...formData,
      technicians: newTechnicians
    });
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Clean data - remove empty strings for date fields and optional fields to avoid validation errors
      const cleanData = { ...data };
      
      if (!cleanData.calibration_date) {
        delete cleanData.calibration_date;
      }
      
      // Clean other optional fields if they are empty strings, just in case
      if (cleanData.diagnostician_name === "") delete cleanData.diagnostician_name;
      if (cleanData.diagnostician_qualification === "") delete cleanData.diagnostician_qualification;
      if (cleanData.camera_model === "") delete cleanData.camera_model;
      if (cleanData.camera_manufacturer === "") delete cleanData.camera_manufacturer;

      if (settings) {
        return base44.entities.ThermoSettings.update(settings.id, cleanData);
      } else {
        return base44.entities.ThermoSettings.create({ ...cleanData, company_id: selectedCompanyId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thermoSettings"] });
      toast({
        title: "Nastavení uloženo",
        description: "Změny v nastavení termodiagnostiky byly úspěšně uloženy.",
        className: "bg-green-50 border-green-200 text-green-900",
        duration: 2000,
      });
    },
    onError: (error) => {
      console.error("Chyba při ukládání nastavení:", error);
      toast({
        title: "Chyba při ukládání",
        description: "Nepodařilo se uložit nastavení: " + (error.message || "Neznámá chyba"),
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    if (!selectedCompanyId) return;
    mutation.mutate(formData);
  };

  if (!user) return null;

  const canSelectCompany = user.user_type === "superAdmin" || (user.user_type === "admin" && companies.length > 0);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(createPageUrl("Settings"))} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Zpět na nastavení
        </Button>

        <h1 className="text-3xl font-bold text-slate-900 mb-6">Nastavení Termodiagnostiky</h1>

        <Card>
          <CardHeader>
            <CardTitle>Výchozí hodnoty pro měření</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {canSelectCompany && (
              <div>
                <Label>Podnik</Label>
                <Select value={selectedCompanyId || ""} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte podnik" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Jméno termodiagnostika</Label>
                <Input 
                  value={formData.diagnostician_name} 
                  onChange={e => setFormData({...formData, diagnostician_name: e.target.value})} 
                  placeholder="např. Jan Novák"
                />
              </div>
              <div>
                <Label>Kvalifikace</Label>
                <Input 
                  value={formData.diagnostician_qualification} 
                  onChange={e => setFormData({...formData, diagnostician_qualification: e.target.value})} 
                  placeholder="např. Level II"
                />
              </div>
              <div>
                <Label>Výrobce IR kamery</Label>
                <Input 
                  value={formData.camera_manufacturer} 
                  onChange={e => setFormData({...formData, camera_manufacturer: e.target.value})} 
                  placeholder="např. FLIR"
                />
              </div>
              <div>
                <Label>Model IR kamery</Label>
                <Input 
                  value={formData.camera_model} 
                  onChange={e => setFormData({...formData, camera_model: e.target.value})} 
                  placeholder="např. T540"
                />
              </div>
              <div>
                <Label>Datum kalibrace</Label>
                <Input 
                  type="date"
                  value={formData.calibration_date} 
                  onChange={e => setFormData({...formData, calibration_date: e.target.value})} 
                />
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Seznam techniků</h3>
                <Button type="button" variant="outline" size="sm" onClick={addTechnician}>
                  + Přidat technika
                </Button>
              </div>
              
              <div className="space-y-3">
                {formData.technicians?.map((tech, index) => (
                  <div key={index} className="flex gap-3 items-end p-3 bg-slate-50 rounded-lg border">
                    <div className="flex-1">
                      <Label className="text-xs mb-1 block">Jméno</Label>
                      <Input 
                        value={tech.name} 
                        onChange={(e) => updateTechnician(index, "name", e.target.value)}
                        placeholder="Jméno technika"
                        className="h-9"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs mb-1 block">Kvalifikace</Label>
                      <Input 
                        value={tech.qualification} 
                        onChange={(e) => updateTechnician(index, "qualification", e.target.value)}
                        placeholder="Kvalifikace"
                        className="h-9"
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => removeTechnician(index)}
                    >
                      <Loader2 className="h-4 w-4 hidden" /> 
                      <span className="text-lg">×</span>
                    </Button>
                  </div>
                ))}
                {(!formData.technicians || formData.technicians.length === 0) && (
                  <p className="text-sm text-slate-500 italic text-center py-4">Zatím žádní technici v seznamu.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={mutation.isLoading || !selectedCompanyId} className="bg-blue-600 hover:bg-blue-700">
                {mutation.isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Uložit nastavení
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}