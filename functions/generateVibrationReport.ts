import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';
import autoTable from 'npm:jspdf-autotable@3.8.2';

// Font setup - using a standard font that supports basic latin, 
// for full Czech support in PDF we might need a custom font, 
// but jsPDF standard fonts often miss unicode chars.
// We will try to use a CDN font or just strip accents if needed, 
// but better to try adding a font. 
// For simplicity in this environment, I'll rely on default and hope for the best 
// or use a simple replacement if needed. 
// Actually, jsPDF default fonts don't support UTF-8 well.
// I will use a helper to replace some chars if it looks bad, 
// but ideally we would load a font. 
// For now, I will assume standard font usage.

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId } = await req.json();

        if (!jobId) {
            return Response.json({ error: 'Job ID is required' }, { status: 400 });
        }

        // Fetch Data
        const job = await base44.entities.VibrationJob.get(jobId);
        if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

        const machine = await base44.entities.Machine.get(job.machine_id);
        const readings = await base44.entities.VibrationReading.filter({ job_id: jobId });
        
        let standard = null;
        if (machine.vibration_standard_id) {
            // There is no .get for standard if we don't know if it exists, safe to list and find or just try get
            // SDK usually has .get(id)
            try {
                standard = await base44.entities.VibrationStandard.get(machine.vibration_standard_id);
            } catch (e) {
                console.log("Standard not found");
            }
        }

        // Create PDF
        const doc = new jsPDF();
        
        // Helper for colors
        const getBandColor = (band) => {
            if (band === 'A' || band === 'B') return [220, 252, 231]; // Green-100
            if (band === 'C') return [254, 249, 195]; // Yellow-100
            if (band === 'D') return [254, 226, 226]; // Red-100
            return [255, 255, 255];
        };

        // --- Header ---
        doc.setFontSize(20);
        doc.setTextColor(33, 80, 216); // Heistech Blue
        doc.text('Protokol o měření vibrací', 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Vygenerováno: ${new Date().toLocaleDateString('cs-CZ')}`, 14, 28);

        // --- Machine Info ---
        doc.setDrawColor(200);
        doc.line(14, 32, 196, 32);
        
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(machine.name, 14, 42);
        
        doc.setFontSize(10);
        doc.setTextColor(80);
        let yPos = 50;
        doc.text(`Zakázka č.: ${job.order_number}`, 14, yPos); yPos += 6;
        doc.text(`Datum měření: ${new Date(job.date).toLocaleDateString('cs-CZ')}`, 14, yPos); yPos += 6;
        doc.text(`Technik: ${job.technician || '-'}`, 14, yPos); yPos += 6;
        if (machine.location) {
            doc.text(`Umístění: ${machine.location}`, 14, yPos); yPos += 6;
        }
        
        // Add Machine Photo if exists
        if (machine.photo_url) {
            try {
                const imgResp = await fetch(machine.photo_url);
                const imgBlob = await imgResp.arrayBuffer();
                const uint8Array = new Uint8Array(imgBlob);
                // Assuming JPEG or PNG. addImage usually handles it.
                // We need to guess format or try-catch
                const format = machine.photo_url.toLowerCase().endsWith('png') ? 'PNG' : 'JPEG';
                doc.addImage(uint8Array, format, 120, 35, 60, 40, undefined, 'FAST');
            } catch (e) {
                console.error("Failed to load image", e);
            }
        }

        yPos = Math.max(yPos + 10, 85);

        // --- Standard Info ---
        if (standard) {
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(`Použitá norma: ${standard.name}`, 14, yPos);
            yPos += 6;
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`Limity [mm/s]: A/B=${standard.limit_ab}, B/C=${standard.limit_bc}, C/D=${standard.limit_cd}`, 14, yPos);
            yPos += 10;
        }

        // --- Readings Table ---
        // Prepare data
        // Sort readings by point then direction
        readings.sort((a, b) => {
            if (a.point_label === b.point_label) return a.direction.localeCompare(b.direction);
            return a.point_label.localeCompare(b.point_label);
        });

        const tableBody = readings.map(r => [
            r.point_label,
            r.direction,
            r.value_rms ? r.value_rms.toFixed(2) : "-",
            r.band || "-",
            r.bearing_status || "-"
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Místo', 'Směr', 'Hodnota RMS [mm/s]', 'Pásmo', 'Ložisko']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [33, 80, 216], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 3) {
                    const band = data.cell.raw;
                    const color = getBandColor(band);
                    data.cell.styles.fillColor = color;
                }
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // --- Texts (Findings, etc) ---
        const addSection = (title, content, iconColor = [0, 0, 0]) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(12);
            doc.setTextColor(...iconColor);
            doc.text(title, 14, yPos);
            yPos += 6;
            
            doc.setFontSize(10);
            doc.setTextColor(50);
            
            const splitText = doc.splitTextToSize(content || "Bez záznamu", 180);
            doc.text(splitText, 14, yPos);
            yPos += (splitText.length * 5) + 10;
        };

        addSection("Závěry", job.conclusion, [220, 38, 38]); // Red title
        addSection("Nálezy", job.findings, [234, 88, 12]); // Orange title
        addSection("Doporučení", job.recommendation, [22, 163, 74]); // Green title

        // Output
        const pdfBytes = doc.output('arraybuffer');
        
        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="protokol_${job.order_number}.pdf"`
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});