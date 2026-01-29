import { Metadata } from "next";
import AdminPageClient from "./AdminPageClient";

export const metadata: Metadata = {
  title: "Admin Dashboard | Kolvex",
  description: "Admin dashboard for Kolvex platform management",
};

export default function AdminPage() {
  return <AdminPageClient />;
}
