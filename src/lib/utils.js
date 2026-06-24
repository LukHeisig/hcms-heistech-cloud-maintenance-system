import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Vrátí název stroje doplněný o inventární číslo, pokud existuje.
export function formatMachineName(machine) {
  if (!machine) return "";
  const name = machine.name || "";
  return machine.inventory_number ? `${name} (${machine.inventory_number})` : name;
}