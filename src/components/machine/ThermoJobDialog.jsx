import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, X, Image as ImageIcon, Thermometer } from "lucide-react";
import { format } from "date-fns";

export default function ThermoJobDialog({ machine, open, onOpenChange, job = null }) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    measurement_date: new Date().toISOString().split('T')[0],
    evaluation_date: new Date().toISOString().split('T')[0],
    diagnostician_name: "",
    diagnostician_qualification: "",
    camera_model: "",
    camera_manufacturer: "",
    calibration_date: "",
    description: "",
    conclusion: ""
  });

  const [images, setImages] = useState([]); // Array of { url, description, file (if new), id (if existing) }
  const fileInputRef = useRef(null);

  // Load machine's company settings to pre-fill
  const { data: line } = useQuery({
    queryKey: ["line", machine?.line_id],
    queryFn: async () => {
        if (!machine?.line_id) return null;
        const lines = await base44.entities.Line.filter({ id: machine.line_id });
        return lines[0];
    },
    enabled: !!machine?.line_id
  });

  const { data: settings } = useQuery({
    queryKey: ["thermoSettings", line?.company_id],
    queryFn: async () => {
        if (!line?.company_id) return null;
        const s = await base44.entities.ThermoSettings.filter({ company_id: line.company_id });
        return s[0];
    },
    enabled: !!line?.company_id && !job
  });

  // Load existing images if editing
  const { data: existingImages = [] } = useQuery({
    queryKey: ["thermoImages", job?.id],
    queryFn: () => job ? base44.entities.ThermoImage.filter({ job_id: job.id }, "order_index") : [],
    enabled: !!job
  });

  useEffect(() => {
    if (job) {
      setFormData({
        measurement_date: job.measurement_date,
        evaluation_date: job.evaluation_date || new Date().toISOString().split('T')[0],
        diagnostician_name: job.diagnostician_name || "",
        diagnostician_qualification: job.diagnostician_qualification || "",
        camera_model: job.camera_model || "",
        camera_manufacturer: job.camera_manufacturer || "",
        calibration_date: job.calibration_date || "",
        description: job.description || "",
        conclusion: job.conclusion || ""
      });
    } else if (open && settings) {
      // Pre-fill from settings for new job
      setFormData(prev => ({
        ...prev,
        diagnostician_name: settings.diagnostician_name || "",
        diagnostician_qualification: settings.diagnostician_qualification || "",
        camera_model: settings.camera_model || "",
        camera_manufacturer: settings.camera_manufacturer || "",
        calibration_date: settings.calibration_date || "",
      }));
    }
  }, [job, settings, open]);

  useEffect(() => {
    if (existingImages.length > 0) {
      setImages(existingImages.map(img => ({
        id: img.id,
        url: img.image_url,
        description: img.description
      })));
    } else if (!job) {
      setImages([]);
    }
  }, [existingImages, job]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 4) {
      alert("Maximálně 4 snímky.");
      return;
    }

    // Upload immediately to get URL or store file to upload on save? 
    // Better upload immediately to keep UI simple and responsive.
    setIsUploading(true);
    try {
      const newImages = [...images];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newImages.push({
          url: file_url,
          description: "",
          isNew: true
        });
      }
      setImages(newImages);
    } catch (err) {
      console.error(err);
      alert("Chyba při nahrávání obrázku.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleImageDescChange = (index, val) => {
    const newImages = [...images];
    newImages[index].description = val;
    setImages(newImages);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      let jobId = job?.id;

      // 1. Save/Update Job
      const jobData = {
        machine_id: machine.id,
        ...formData
      };

      if (job) {
        await base44.entities.ThermoJob.update(job.id, jobData);
      } else {
        const newJob = await base44.entities.ThermoJob.create(jobData);
        jobId = newJob.id;
      }

      // 2. Handle Images
      // If editing, we should delete old ones that are removed? 
      // Or just overwrite. Simplest is to sync: delete all for this job and recreate list?
      // Or smart diff. Let's do delete/create for simplicity if editing, or just add new ones.
      
      // Actually, to handle "removed" images correctly in edit mode:
      // Get all existing IDs from `existingImages`.
      // Any ID in `existingImages` that is NOT in `images` (by id) should be deleted.
      if (job) {
        const currentIds = images.filter(i => i.id).map(i => i.id);
        const toDelete = existingImages.filter(i => !currentIds.includes(i.id));
        for (const img of toDelete) {
          await base44.entities.ThermoImage.delete(img.id);
        }
      }

      // Upsert/Create current images
      // We need to update descriptions for existing ones too.
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.id) {
          // Update existing
          await base44.entities.ThermoImage.update(img.id, {
            description: img.description,
            order_index: i
          });
        } else {
          // Create new
          await base44.entities.ThermoImage.create({
            job_id: jobId,
            image_url: img.url,
            description: img.description,
            order_index: i
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thermoJobs"] });
      queryClient.invalidateQueries({ queryKey: ["thermoImages"] });
      onOpenChange(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-orange-600" />
            {job ? "Upravit termodiagnostické měření" : "Nové termodiagnostické měření"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Levý sloupec - Info */}
          <div className="space-y-4">
            <div>
              <Label>Stroj</Label>
              <Input value={machine?.name || ""} disabled className="bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Datum měření</Label>
                <Input type="date" value={formData.measurement_date} onChange={e => setFormData({...formData, measurement_date: e.target.value})} />
              </div>
              <div>
                <Label>Datum vyhodnocení</Label>
                <Input type="date" value={formData.evaluation_date} onChange={e => setFormData({...formData, evaluation_date: e.target.value})} />
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
              <h4 className="font-semibold text-sm text-slate-700">Diagnostik a vybavení</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Jméno</Label>
                  <Input className="h-8 text-sm" value={formData.diagnostician_name} onChange={e => setFormData({...formData, diagnostician_name: e.target.value})} />
                </div>
                <div>
                  <Label className="text-xs">Kvalifikace</Label>
                  <Input className="h-8 text-sm" value={formData.diagnostician_qualification} onChange={e => setFormData({...formData, diagnostician_qualification: e.target.value})} />
                </div>
                <div>
                  <Label className="text-xs">Kamera Model</Label>
                  <Input className="h-8 text-sm" value={formData.camera_model} onChange={e => setFormData({...formData, camera_model: e.target.value})} />
                </div>
                <div>
                  <Label className="text-xs">Kamera Výrobce</Label>
                  <Input className="h-8 text-sm" value={formData.camera_manufacturer} onChange={e => setFormData({...formData, camera_manufacturer: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Datum kalibrace</Label>
                  <Input type="date" className="h-8 text-sm w-1/2" value={formData.calibration_date} onChange={e => setFormData({...formData, calibration_date: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label>Popis / Poznámky</Label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} />
            </div>
            
            <div>
              <Label>Závěr</Label>
              <Textarea value={formData.conclusion} onChange={e => setFormData({...formData, conclusion: e.target.value})} rows={3} />
            </div>
          </div>

          {/* Pravý sloupec - Obrázky */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Termosnímky (max 4)</Label>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  multiple 
                  onChange={handleFileSelect} 
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || images.length >= 4}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Nahrát
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {images.map((img, idx) => (
                <div key={idx} className="relative group border rounded-lg p-2 space-y-2 bg-white shadow-sm">
                  <div className="aspect-square bg-slate-100 rounded overflow-hidden relative">
                    <img src={img.url} alt={`Termo ${idx + 1}`} className="w-full h-full object-contain" />
                    <button 
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <Input 
                    placeholder="Popis snímku" 
                    value={img.description || ""} 
                    onChange={(e) => handleImageDescChange(idx, e.target.value)}
                    className="text-xs h-7"
                  />
                </div>
              ))}
              {images.length === 0 && (
                <div className="col-span-2 py-12 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm">Žádné snímky</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isLoading || !formData.measurement_date}>
            {mutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Uložit měření
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}