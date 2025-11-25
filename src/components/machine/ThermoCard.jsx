import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Calendar, User, Camera, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
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

export default function ThermoCard({ machine, jobs = [], onEdit }) {
  const queryClient = useQueryClient();
  const [jobToDelete, setJobToDelete] = useState(null);
  const [expandedJobId, setExpandedJobId] = useState(jobs.length > 0 ? jobs[0].id : null);

  const { data: images = [] } = useQuery({
    queryKey: ["thermoImages", expandedJobId],
    queryFn: () => expandedJobId ? base44.entities.ThermoImage.filter({ job_id: expandedJobId }, "order_index") : [],
    enabled: !!expandedJobId
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.ThermoJob.delete(id);
      // Also delete associated images
      const imgs = await base44.entities.ThermoImage.filter({ job_id: id });
      for (const img of imgs) {
        await base44.entities.ThermoImage.delete(img.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thermoJobs"] });
      setJobToDelete(null);
    }
  });

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Thermometer className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Zatím nejsou žádná termodiagnostická měření</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Job Selector / Timeline */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        {jobs.map(job => (
          <button
            key={job.id}
            onClick={() => setExpandedJobId(job.id)}
            className={`
              flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all
              ${expandedJobId === job.id 
                  ? "bg-orange-50 border-orange-500 ring-1 ring-orange-500 shadow-sm" 
                  : "bg-white border-slate-200 hover:border-orange-300 hover:bg-slate-50"
              }
            `}
          >
            <span className={`text-xs font-bold ${expandedJobId === job.id ? "text-orange-700" : "text-slate-500"}`}>
              {format(new Date(job.measurement_date), "d. M. yyyy", { locale: cs })}
            </span>
            <span className="text-xs text-slate-500 mt-1 truncate w-full">
              {job.diagnostician_name || "Technik neuveden"}
            </span>
          </button>
        ))}
      </div>

      {/* Expanded Job Detail */}
      {expandedJobId && (() => {
        const job = jobs.find(j => j.id === expandedJobId);
        if (!job) return null;

        return (
          <Card className="border-t-4 border-t-orange-500 shadow-lg">
            <CardHeader className="border-b bg-slate-50 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Thermometer className="w-6 h-6 text-orange-600" />
                    Termodiagnostika {format(new Date(job.measurement_date), "d. M. yyyy", { locale: cs })}
                  </CardTitle>
                  <div className="flex gap-4 mt-2 text-sm text-slate-600">
                    <span className="flex items-center gap-1"><User className="w-4 h-4" /> {job.diagnostician_name}</span>
                    <span className="flex items-center gap-1"><Camera className="w-4 h-4" /> {job.camera_manufacturer} {job.camera_model}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(job)}>
                    <Pencil className="w-4 h-4 text-slate-600" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setJobToDelete(job)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Text Content */}
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-slate-900 mb-2">Závěr</h4>
                    <p className="text-slate-700 whitespace-pre-wrap text-sm">{job.conclusion || "Bez závěru"}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Popis / Nález</h4>
                    <p className="text-slate-600 whitespace-pre-wrap text-sm">{job.description || "Bez popisu"}</p>
                  </div>
                  <div className="text-xs text-slate-400 pt-4 border-t">
                    <p>Kvalifikace: {job.diagnostician_qualification || "-"}</p>
                    <p>Kalibrace kamery: {job.calibration_date ? format(new Date(job.calibration_date), "d. M. yyyy", { locale: cs }) : "-"}</p>
                    <p>Vyhodnoceno: {job.evaluation_date ? format(new Date(job.evaluation_date), "d. M. yyyy", { locale: cs }) : "-"}</p>
                  </div>
                </div>

                {/* Images Grid */}
                <div className="grid grid-cols-2 gap-4 auto-rows-fr">
                  {images.length > 0 ? (
                    images.map(img => (
                      <div key={img.id} className="space-y-2">
                        <div className="rounded-lg overflow-hidden border shadow-sm bg-black flex items-center justify-center aspect-square">
                          <img 
                            src={img.image_url} 
                            alt={img.description} 
                            className="w-full h-full object-contain hover:scale-105 transition-transform duration-300 cursor-pointer"
                            onClick={() => window.open(img.image_url, "_blank")}
                          />
                        </div>
                        {img.description && (
                          <p className="text-xs text-center text-slate-600 font-medium">{img.description}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 flex flex-col items-center justify-center h-64 bg-slate-50 rounded-lg border border-dashed">
                        <Camera className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-slate-400 text-sm">Bez termosnímků</p>
                    </div>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>
        );
      })()}

      <AlertDialog open={!!jobToDelete} onOpenChange={() => setJobToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat měření?</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete smazat toto termodiagnostické měření? Akce je nevratná a smaže i přiložené snímky.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600" onClick={() => deleteMutation.mutate(jobToDelete.id)}>
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}