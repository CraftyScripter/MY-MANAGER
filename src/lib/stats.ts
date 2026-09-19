// Stats are now calculated fresh in /api/admin/stats on each request.
// This function is kept as a no-op for backward compatibility with existing callers.
export async function recomputeDashboardStats(): Promise<void> {
  // No-op: dashboard stats are computed live from the database
}
