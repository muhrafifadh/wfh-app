/** The accounts created by the backend's `pnpm db:seed` (backend/prisma/seed.ts). */
export const DEMO_PERSONAS = [
  { email: "admin@example.com", name: "Admin", role: "Owner" },
  { email: "indah.permata@example.com", name: "Indah Permata", role: "Admin/HR" },
  { email: "rina.wijaya@example.com", name: "Rina Wijaya", role: "Manager" },
  { email: "budi.santoso@example.com", name: "Budi Santoso", role: "Employee" },
  { email: "sari.lestari@example.com", name: "Sari Lestari", role: "Employee" },
  { email: "agus.pratama@example.com", name: "Agus Pratama", role: "Employee" },
  { email: "dewi.anggraini@example.com", name: "Dewi Anggraini", role: "Employee" },
  { email: "fajar.nugroho@example.com", name: "Fajar Nugroho", role: "Employee" },
  { email: "putri.maharani@example.com", name: "Putri Maharani", role: "Employee" },
  { email: "hendra.gunawan@example.com", name: "Hendra Gunawan", role: "Employee" },
  { email: "maya.kusuma@example.com", name: "Maya Kusuma", role: "Employee" },
  { email: "yoga.saputra@example.com", name: "Yoga Saputra", role: "Employee" },
] as const;
