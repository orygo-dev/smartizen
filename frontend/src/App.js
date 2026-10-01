import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/sz/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import RegisterWarga from "@/pages/RegisterWarga";
import RegisterRT from "@/pages/RegisterRT";

import CitizenLayout from "@/components/layout/CitizenLayout";
import CitizenHome from "@/pages/citizen/CitizenHome";
import Services from "@/pages/citizen/Services";
import Feed from "@/pages/citizen/Feed";
import Letters from "@/pages/citizen/Letters";
import Complaints from "@/pages/citizen/Complaints";
import Dues from "@/pages/citizen/Dues";
import Agenda from "@/pages/citizen/Agenda";
import Notifications from "@/pages/citizen/Notifications";
import Profile from "@/pages/citizen/Profile";
import Warga from "@/pages/citizen/Warga";
import Keluarga from "@/pages/citizen/Keluarga";
import Chat from "@/pages/citizen/Chat";
import Marketplace from "@/pages/citizen/Marketplace";
import MyStore from "@/pages/citizen/MyStore";
import VerifyLetter from "@/pages/VerifyLetter";
import Reels from "@/pages/citizen/Reels";
import Stories from "@/pages/citizen/Stories";
import UmkmFeatured from "@/pages/dashboard/UmkmFeatured";

import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardHome from "@/pages/dashboard/DashboardHome";
import Residents from "@/pages/dashboard/Residents";
import PendingVerification from "@/pages/dashboard/PendingVerification";
import RTApplications from "@/pages/dashboard/RTApplications";
import Claims from "@/pages/dashboard/Claims";
import { ManageAnnouncements, ManageAgenda } from "@/pages/dashboard/ManageCivic";
import ManageComplaints from "@/pages/dashboard/ManageComplaints";
import ManageLetters from "@/pages/dashboard/ManageLetters";
import DuesManage from "@/pages/dashboard/DuesManage";
import SubRegions from "@/pages/dashboard/SubRegions";
import Activation from "@/pages/dashboard/Activation";
import RTFeed from "@/pages/dashboard/RTFeed";
import Households from "@/pages/dashboard/Households";
import { Regions, AuditLog, SettingsPage } from "@/pages/dashboard/Misc";

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center dark:bg-slate-950">
      <div>
        <h1 className="text-7xl font-extrabold sz-gradient-text">404</h1>
        <p className="mt-2 text-lg font-semibold text-slate-700 dark:text-slate-200">Halaman tidak ditemukan</p>
        <a href="/" className="mt-4 inline-block rounded-full sz-gradient px-6 py-2.5 font-semibold text-white">Kembali ke Beranda</a>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/lupa-sandi" element={<ForgotPassword />} />
            <Route path="/verifikasi/surat/:id" element={<VerifyLetter />} />
            <Route path="/daftar/warga" element={<RegisterWarga />} />
            <Route path="/daftar/rt" element={<RegisterRT />} />

            {/* Citizen app */}
            <Route path="/app" element={<ProtectedRoute><CitizenLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/app/beranda" replace />} />
              <Route path="beranda" element={<CitizenHome />} />
              <Route path="layanan" element={<Services />} />
              <Route path="feed" element={<Feed />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="toko" element={<MyStore />} />
              <Route path="reels" element={<Reels />} />
              <Route path="stories" element={<Stories />} />
              <Route path="profil" element={<Profile />} />
              <Route path="surat" element={<Letters />} />
              <Route path="pengaduan" element={<Complaints />} />
              <Route path="iuran" element={<Dues />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="warga" element={<Warga />} />
              <Route path="keluarga" element={<Keluarga />} />
              <Route path="chat" element={<Chat />} />
              <Route path="notifikasi" element={<Notifications />} />
            </Route>

            {/* Admin dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<DashboardHome />} />
              <Route path="residents" element={<Residents />} />
              <Route path="pending" element={<PendingVerification />} />
              <Route path="households" element={<Households />} />
              <Route path="rt-applications" element={<RTApplications />} />
              <Route path="claims" element={<Claims />} />
              <Route path="regions" element={<Regions />} />
              <Route path="announcements" element={<ManageAnnouncements />} />
              <Route path="agenda" element={<ManageAgenda />} />
              <Route path="complaints" element={<ManageComplaints />} />
              <Route path="letters" element={<ManageLetters />} />
              <Route path="umkm" element={<UmkmFeatured />} />
              <Route path="dues" element={<DuesManage />} />
              <Route path="feed" element={<RTFeed />} />
              <Route path="sub-regions" element={<SubRegions />} />
              <Route path="activation" element={<Activation />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
