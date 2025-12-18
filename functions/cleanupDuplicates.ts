import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    return Response.json({ message: "Hello World Update Check" });
});