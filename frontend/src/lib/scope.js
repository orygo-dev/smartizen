const ADMIN_SCOPES = ["RT", "RW", "VILLAGE", "DISTRICT", "REGENCY"];

export function getAdminScope(user) {
  if (!user?.role_assignments) return null;
  const a = user.role_assignments.find((x) => ADMIN_SCOPES.includes(x.scope_type) && x.status === "ACTIVE");
  return a ? { id: a.scope_id, type: a.scope_type, role: a.role } : null;
}

export function isSuperAdmin(user) {
  return user?.roles?.includes("SUPER_ADMIN");
}
