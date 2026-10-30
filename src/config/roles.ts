/** Display names for the roles every organization starts with (backend DEFAULT_ROLES). */
const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  member: "Member",
  admin_hr: "Admin/HR",
  manager: "Manager",
  employee: "Employee",
};

/** "admin_hr" → "Admin/HR"; a custom role keeps its own name. */
export const roleLabel = (name: string): string => ROLE_LABELS[name] ?? name;
