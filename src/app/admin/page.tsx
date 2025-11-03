import AdminAuthWrapper from "@/components/admin/AdminAuthWrapper";
import AdminUserManager from "@/components/admin/AdminUserManager";

export default function AdminPage() {
  return (
    <AdminAuthWrapper>
      <AdminUserManager />
    </AdminAuthWrapper>
  );
}
