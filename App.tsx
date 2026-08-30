import React, { useState, useEffect, lazy, Suspense, useRef } from "react";
import {
  ViewType,
  Client,
  Project,
  TeamMember,
  Transaction,
  Package,
  AddOn,
  TeamProjectPayment,
  Profile,
  FinancialPocket,
  TeamPaymentRecord,
  Lead,
  User,
  Card,
  ClientFeedback,
  NavigationAction,
  Notification,
  PromoCode,
  CardType,
  PaymentStatus,
  TransactionType,
} from "./src/types";
import {
  HomeIcon,
  FolderKanbanIcon,
  UsersIcon,
  DollarSignIcon,
  darkenColor,
  hexToHsl,
} from "./src/constants";
import Sidebar from "./src/layouts/Sidebar";
import Header from "./src/layouts/Header";
import ErrorBoundary from "./src/shared/ui/ErrorBoundary";
// Keep lightweight/core components imported normally
import GlobalSearch from "./src/layouts/GlobalSearch";
import Homepage from "./src/pages/home/Homepage";
import Login from "./src/pages/auth/LoginPage";
// Lazy-load route components to enable real code-splitting and avoid dynamic/static import conflicts
const Dashboard = lazy(() => import("./src/pages/dashboard/DashboardPage"));
const Leads = lazy(() =>
  import("./src/pages/leads/LeadsPage").then((m) => ({ default: m.Leads })),
);
const Booking = lazy(() => import("./src/pages/booking/BookingPage"));
const Clients = lazy(() => import("./src/pages/clients/ClientsPage"));
const Projects = lazy(() =>
  import("./src/pages/projects/ProjectsPage").then((m) => ({ default: m.Projects })),
);
const Freelancers = lazy(() =>
  import("./src/pages/team/TeamPage").then((m) => ({ default: m.Freelancers })),
);
const Finance = lazy(() => import("./src/pages/finance/FinancePage"));
const Packages = lazy(() => import("./src/features/packages/Packages"));
const Settings = lazy(() => import("./src/pages/settings/SettingsPage"));
const CalendarView = lazy(() =>
  import("./src/features/projects/components/CalendarView").then((m) => ({
    default: m.CalendarView,
  })),
);
const VendorProfileAdmin = lazy(() => import("./src/pages/admin/VendorProfilePage"));
const ClientReports = lazy(() => import("./src/features/clients/components/ClientKPI"));
const ClientPortal = lazy(() => import("./src/features/clients/components/ClientPortal"));
const FreelancerPortal = lazy(() => import("./src/features/team/components/FreelancerPortal"));
// Social Planner removed
const PromoCodes = lazy(() => import("./src/features/promo/PromoCodes"));
const GalleryUpload = lazy(() => import("./src/features/public/components/GalleryUpload"));
const PublicGallery = lazy(() => import("./src/features/public/components/PublicGallery"));
const PublicBookingForm = lazy(() => import("./src/features/public/components/PublicBookingForm"));
const PublicPackages = lazy(() => import("./src/features/public/components/PublicPackages"));
const PublicFeedbackForm = lazy(
  () => import("./src/features/public/components/PublicFeedbackForm"),
);

const PublicLeadForm = lazy(() => import("./src/features/public/components/PublicLeadForm"));
const SuggestionForm = lazy(() => import("./src/features/public/components/SuggestionForm"));
const TestSignature = lazy(() => import("./src/features/test/TestSignature"));
const PublicInvoice = lazy(() => import("./src/features/public/components/PublicInvoice"));
const PublicReceipt = lazy(() => import("./src/features/public/components/PublicReceipt"));
const VendorPublicProfile = lazy(() => import("./src/pages/public/VendorPublicProfile"));
const PortfolioDetailPage = lazy(() => import("./src/pages/public/PortfolioDetailPage"));
const InventoryPage = lazy(() => import("./src/pages/inventory/InventoryPage"));
import { listPromoCodes } from "./src/services/promoCodes";
import { listCards as listCardsFromDb } from "./src/services/cards";
import { listPackages } from "./src/services/packages";
import { listAddOns } from "./src/services/addOns";
import { listProjectsWithRelations } from "./src/services/projects";
import { updateProject as updateProjectInDb } from "./src/services/projects";
import { getProfile as getProfileFromDb } from "./src/services/profile";
import { useAppData } from "./src/hooks/useAppData";
import { useData } from "./src/contexts/DataContext";
import { DataLoadingWrapper } from "./src/shared/ui/LoadingState";
import { listAllTeamPayments } from "./src/services/teamProjectPayments";
import { listUsers as listUsersFromDb } from "./src/services/users";
import { listLeads as listLeadsFromDb } from "./src/services/leads";
import { listClientFeedback as listClientFeedbackFromDb } from "./src/services/clientFeedback";
import {
  createTransaction,
  updateCardBalance,
  updateTransaction as updateTransactionInDb,
} from "./src/services/transactions";
import { listTeamPaymentRecords as listTeamPaymentRecordsFromDb, createTeamPaymentRecord } from "./src/services/teamPaymentRecords";
import { listPockets as listPocketsFromDb } from "./src/services/pockets";
import { markSubStatusConfirmed } from "./src/services/projectSubStatusConfirmations";

import { supabase } from "./src/lib/supabaseClient";
import { createNotification as createNotificationRow } from "./src/services/notifications";

// Remove usePersistentState to avoid hook-related confusion
const LAST_ROUTE_STORAGE_KEY = "vena-lastRoute";

const AccessDenied: React.FC<{ onBackToDashboard: () => void }> = ({
  onBackToDashboard,
}) => (
  <div
    className="
        flex flex-col items-center justify-center 
        h-full 
        text-center 
        p-4 sm:p-6 md:p-8
        animate-fade-in
    "
  >
    <div
      className="
            w-32 h-32 sm:w-40 sm:h-40
            flex items-center justify-center
            mb-4 sm:mb-6
        "
    >
      <img
        src="/assets/images/backgrounds/errorimg.svg"
        alt="Akses Ditolak"
        className="w-full h-full object-contain"
      />
    </div>
    <h2
      className="
            text-xl sm:text-2xl 
            font-bold 
            text-red-600 
            mb-2 sm:mb-3
        "
    >
      Akses Ditolak
    </h2>
    <p
      className="
            text-brand-text-secondary 
            mb-6 sm:mb-8 
            max-w-md
            leading-relaxed
        "
    >
      Anda tidak memiliki izin untuk mengakses halaman ini.
    </p>
    <button onClick={onBackToDashboard} className="button-primary">
      Kembali ke Dashboard
    </button>
  </div>
);

const BottomNavBar: React.FC<{
  activeView: ViewType;
  handleNavigation: (view: ViewType) => void;
}> = ({ activeView, handleNavigation }) => {
  const prefetchView = (view: ViewType) => {
    switch (view) {
      case ViewType.DASHBOARD:
        import("./src/pages/dashboard/DashboardPage");
        break;
      case ViewType["Calon Pengantin"]:
        import("./src/pages/leads/LeadsPage");
        break;
      case ViewType.BOOKING:
        import("./src/pages/booking/BookingPage");
        break;
      case ViewType.CLIENTS:
        import("./src/pages/clients/ClientsPage");
        break;
      case ViewType.PROJECTS:
        import("./src/pages/projects/ProjectsPage");
        break;
      case ViewType.TEAM:
        import("./src/pages/team/TeamPage");
        break;
      case ViewType.FINANCE:
        import("./src/pages/finance/FinancePage");
        break;
      case ViewType.CALENDAR:
        import("./src/features/projects/components/CalendarView");
        break;
      case ViewType.PACKAGES:
        import("./src/features/packages/Packages");
        break;
      case ViewType.PROMO_CODES:
        import("./src/features/promo/PromoCodes");
        break;
      case ViewType.GALLERY:
        import("./src/features/public/components/GalleryUpload");
        break;
      case ViewType.CLIENT_REPORTS:
        import("./src/features/clients/components/ClientKPI");
        break;
      case ViewType.SETTINGS:
        import("./src/pages/settings/SettingsPage");
        break;
      case ViewType.INVENTORY:
        import("./src/pages/inventory/InventoryPage");
        break;
      default:
        break;
    }
  };
  const navItems = [
    { view: ViewType.DASHBOARD, label: "Beranda", icon: HomeIcon },
    { view: ViewType.PROJECTS, label: "Proyek", icon: FolderKanbanIcon },
    { view: ViewType.CLIENTS, label: "Klien", icon: UsersIcon },
    { view: ViewType.FINANCE, label: "Keuangan", icon: DollarSignIcon },
  ];

  return (
    <nav
      className="
            bottom-nav 
            xl:hidden
            bg-brand-surface/95 
            backdrop-blur-xl
            border-t border-brand-border/50
        "
    >
      <div
        className="
                flex justify-around items-center
                h-16
                px-2
            "
        style={{
          paddingBottom: "var(--safe-area-inset-bottom, 0px)",
        }}
      >
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => handleNavigation(item.view)}
            onMouseEnter={() => prefetchView(item.view)}
            className={`
                            flex flex-col items-center justify-center 
                            w-full h-full
                            px-2 py-2
                            rounded-xl
                            transition-all duration-200 
                            min-w-[56px] sm:min-w-[64px] min-h-[44px]
                            relative
                            group
                            overflow-visible
                            ${activeView === item.view
                ? "text-brand-accent bg-brand-accent/10"
                : "text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-input/50 active:bg-brand-input"
              }
                        `}
            aria-label={item.label}
          >
            {/* Enhanced Icon */}
            <div
              className="
                            relative
                            mb-1
                        "
            >
              <item.icon
                className={`
                                w-5 h-5 sm:w-6 sm:h-6
                                transition-all duration-200
                                ${activeView === item.view ? "transform scale-110" : "group-active:scale-95"}
                            `}
              />

              {/* Active indicator dot */}
              {activeView === item.view && (
                <div
                  className="
                                    absolute -top-1 -right-1
                                    w-2 h-2
                                    bg-brand-accent
                                    animate-pulse-soft
                                "
                />
              )}
            </div>

            {/* Enhanced Label */}
            <span
              className={`
                            text-[10px] sm:text-xs font-semibold
                            leading-tight
                            transition-all duration-200
                            ${activeView === item.view ? "font-bold" : ""}
                        `}
            >
              {item.label}
            </span>

            {/* Background highlight */}
            <div
              className={`
                            absolute inset-0
                            rounded-xl
                            transition-all duration-300
                            ${activeView === item.view
                  ? "bg-gradient-to-t from-brand-accent/10 to-transparent"
                  : "bg-transparent group-hover:bg-brand-input/30"
                }
                        `}
            />
          </button>
        ))}
      </div>
    </nav>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(() => {
    try {
      const storedValue = window.localStorage.getItem("vena-isAuthenticated");
      return storedValue ? JSON.parse(storedValue) : false;
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = React.useState<User | null>(() => {
    try {
      const storedValue = window.localStorage.getItem("vena-currentUser");
      return storedValue ? JSON.parse(storedValue) : null;
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    window.localStorage.setItem("vena-isAuthenticated", JSON.stringify(isAuthenticated));
  }, [isAuthenticated]);

  React.useEffect(() => {
    window.localStorage.setItem("vena-currentUser", JSON.stringify(currentUser));
  }, [currentUser]);

  const [activeView, setActiveView] = React.useState<ViewType>(ViewType.HOMEPAGE);
  const [notification, setNotification] = React.useState<string>("");
  const [initialAction, setInitialAction] = React.useState<NavigationAction | null>(
    null,
  );
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [route, setRoute] = React.useState(window.location.hash || "#/home");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const didRestoreLastRouteRef = React.useRef(false);

  // Force light mode globally on app load
  React.useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      window.localStorage.setItem("theme", "light");
    } catch (error) {
      console.warn("[Theme] Failed to set theme in localStorage:", error);
    }
  }, []);

  // Handle URL without hash redirect for gallery
  React.useEffect(() => {
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash;

    // If no hash and path starts with /gallery/, redirect to hash-based URL
    if (!currentHash && currentPath.startsWith("/gallery/")) {
      const galleryId = currentPath.split("/gallery/")[1];
      if (galleryId) {
        window.location.href = `${window.location.origin}/#/gallery/${galleryId}`;
        return;
      }
    }
  }, []);

  // --- State Initialization with Persistence ---
  const [users, setUsers] = React.useState<User[]>([]);

  const [clients, setClients] = React.useState<Client[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [teamProjectPayments, setTeamProjectPayments] = React.useState<
    TeamProjectPayment[]
  >([]);
  const [teamPaymentsLoaded, setTeamPaymentsLoaded] = React.useState(false);
  const [teamPaymentRecords, setTeamPaymentRecords] = React.useState<
    TeamPaymentRecord[]
  >([]);
  const [pockets, setPockets] = React.useState<FinancialPocket[]>([]);
  // Inisialisasi profile tanpa MOCK; isi dari Supabase pada efek load profile
  const [profile, setProfile] = React.useState<Profile>({
    projectTypes: [],
    projectStatusConfig: [],
    eventTypes: [],
  } as unknown as Profile);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [cards, setCards] = React.useState<Card[]>([]);
  const [clientFeedback, setClientFeedback] = React.useState<ClientFeedback[]>([]);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [promoCodes, setPromoCodes] = React.useState<PromoCode[]>([]);
  const [packages, setPackages] = React.useState<Package[]>([]);
  const [addOns, setAddOns] = React.useState<AddOn[]>([]);

  // --- Lazy Data Loading Hook ---
  const appData = useAppData();

  React.useEffect(() => {
    if (appData.loaded.clients) setClients(appData.clients);
  }, [appData.clients, appData.loaded.clients]);

  React.useEffect(() => {
    if (appData.loaded.projects) setProjects(appData.projects as any);
  }, [appData.projects, appData.loaded.projects]);

  React.useEffect(() => {
    if (appData.loaded.teamMembers) setTeamMembers(appData.teamMembers);
  }, [appData.teamMembers, appData.loaded.teamMembers]);

  React.useEffect(() => {
    if (appData.loaded.transactions) setTransactions(appData.transactions);
  }, [appData.transactions, appData.loaded.transactions]);

  React.useEffect(() => {
    if (appData.loaded.leads) setLeads(appData.leads);
  }, [appData.leads, appData.loaded.leads]);

  React.useEffect(() => {
    if (appData.loaded.clientFeedback) setClientFeedback(appData.clientFeedback);
  }, [appData.clientFeedback, appData.loaded.clientFeedback]);

  // --- [NEW] CENTRALIZED NOTIFICATION HANDLER ---
  const addNotification = async (
    newNotificationData: Omit<Notification, "id" | "timestamp" | "isRead">,
  ) => {
    const payload: Omit<Notification, "id"> = {
      ...newNotificationData,
      timestamp: new Date().toISOString(),
      isRead: false,
    } as any;
    try {
      const created = await createNotificationRow(payload);
      setNotifications((prev) => [created, ...prev]);
    } catch (e) {
      console.warn(
        "[Notifications] Failed to create notification in Supabase:",
        e,
      );
      // Fallback to local append if needed
      const fallback: Notification = {
        id: crypto.randomUUID(),
        ...payload,
      } as Notification;
      setNotifications((prev) => [fallback, ...prev]);
    }
  };

  // --- [NEW] One-time migration: clients from localStorage to Supabase ---
  React.useEffect(() => {
    const KEY = "vena-clients";
    const FLAG = "vena-clients-migrated";
    if ((window as any)[FLAG] || window.localStorage.getItem(FLAG) === "yes")
      return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsedData = JSON.parse(raw);
      if (!Array.isArray(parsedData) || parsedData.length === 0) return;
      (async () => {
        try {
          // Lazy import to avoid circular deps
          const mod = await import("./src/services/clients");
          for (const c of parsedData) {
            try {
              await mod.createClient({
                id: c.id, // preserve original id if service allows
                name: c.name,
                email: c.email,
                phone: c.phone,
                whatsapp: c.whatsapp ?? undefined,
                since: c.since,
                instagram: c.instagram ?? undefined,
                status: c.status,
                clientType: c.clientType,
                lastContact: c.lastContact,
                portalAccessId: c.portalAccessId,
              } as any);
            } catch (e) {
              // Ignore per-row errors (e.g., duplicates)
              console.warn("[Migration] Failed to migrate client:", c.id, e);
            }
          }
          window.localStorage.setItem(FLAG, "yes");
          console.info("[Migration] clients migrated to Supabase.");
        } catch (err) {
          console.warn("[Migration] clients migration failed.", err);
        }
      })();
    } catch (error) {
      console.warn("[Migration] Failed to parse localStorage data:", error);
    }
  }, []);

  // --- [DISABLED FOR PERFORMANCE] Realtime: promo_codes ---
  // Promo codes rarely change, load once on demand instead
  // useEffect(() => {
  //     const channel = supabase.channel('realtime-promo-codes')
  //         .on('postgres_changes', { event: '*', schema: 'public', table: 'promo_codes' }, (payload) => {
  //             console.log('Promo code change received!', payload);
  //             if (payload.eventType === 'INSERT') {
  //                 setPromoCodes(current => [payload.new as PromoCode, ...current]);
  //             }
  //             if (payload.eventType === 'UPDATE') {
  //                 setPromoCodes(current => current.map(pc => pc.id === payload.new.id ? { ...(pc as any), ...(payload.new as any) } : pc));
  // --- Sync clients from lazy loading hook with REALTIME ---
  /* React.useEffect(() => {
    if (appData.loaded.clients) {
      setClients(appData.clients);
    }

    const channel = supabase
      .channel("realtime-clients")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        (payload) => {
          console.log("Client change received!", payload);
          if (payload.eventType === "INSERT") {
            setClients((currentClients) => [
              payload.new as Client,
              ...currentClients,
            ]);
          }
          if (payload.eventType === "UPDATE") {
            setClients((currentClients) =>
              currentClients.map((c) =>
                c.id === payload.new.id
                  ? ({ ...c, ...payload.new } as Client)
                  : c,
              ),
            );
          }
          if (payload.eventType === "DELETE") {
            setClients((currentClients) =>
              currentClients.filter((c) => c.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appData.clients, appData.loaded.clients]); */

  // --- Sync team members from lazy loading hook with REALTIME ---
  /* React.useEffect(() => {
    if (appData.loaded.teamMembers) {
      setTeamMembers(appData.teamMembers);
    }

    const channel = supabase
      .channel("realtime-team-members")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members" },
        (payload) => {
          console.log("Team member change received!", payload);
          if (payload.eventType === "INSERT") {
            setTeamMembers((current) => [
              payload.new as TeamMember,
              ...current,
            ]);
          }
          if (payload.eventType === "UPDATE") {
            setTeamMembers((current) =>
              current.map((m) =>
                m.id === payload.new.id
                  ? ({ ...m, ...payload.new } as TeamMember)
                  : m,
              ),
            );
          }
          if (payload.eventType === "DELETE") {
            setTeamMembers((current) =>
              current.filter((m) => m.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appData.teamMembers, appData.loaded.teamMembers]); */

  // --- Sync leads from lazy loading hook ---
  /* React.useEffect(() => {
    if (appData.loaded.leads) {
      setLeads(appData.leads);
    }
  }, [appData.leads, appData.loaded.leads]); */

  // --- Sync client feedback from lazy loading hook ---
  /* React.useEffect(() => {
    if (appData.loaded.clientFeedback) {
      setClientFeedback(appData.clientFeedback);
    }
  }, [appData.clientFeedback, appData.loaded.clientFeedback]); */

  // --- Sync transactions from lazy loading hook with REALTIME ---
  /* React.useEffect(() => {
    if (appData.loaded.transactions) {
      setTransactions(appData.transactions);
    }

    const channel = supabase
      .channel("realtime-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          console.log("Transaction change received!", payload);
          if (payload.eventType === "INSERT") {
            setTransactions((current) => [
              payload.new as Transaction,
              ...current,
            ]);
          }
          if (payload.eventType === "UPDATE") {
            setTransactions((current) =>
              current.map((t) =>
                t.id === payload.new.id
                  ? ({ ...t, ...payload.new } as Transaction)
                  : t,
              ),
            );
          }
          if (payload.eventType === "DELETE") {
            setTransactions((current) =>
              current.filter((t) => t.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appData.transactions, appData.loaded.transactions]); */

  // --- Sync projects from lazy loading hook (which already uses relations) with REALTIME ---
  /* React.useEffect(() => {
    if (appData.loaded.projects) {
      // Prefer projects from appData (loaded via listProjectsWithRelations)
      setProjects(appData.projects as any);
    }
    // Keep existing realtime subscription below to capture future changes on 'projects'
  }, [appData.projects, appData.loaded.projects]); */

  // Helper: map DB row (snake_case) to Card interface (camelCase)
  const mapCardRowToCard = (row: any): Card => ({
    id: row.id,
    cardHolderName: row.card_holder_name,
    bankName: row.bank_name,
    cardType: row.card_type as CardType,
    lastFourDigits: row.last_four_digits ?? "",
    expiryDate: row.expiry_date ?? undefined,
    balance: Number(row.balance || 0),
    colorGradient: row.color_gradient || "from-slate-200 to-slate-400",
  });

  // --- [NEW] Realtime: cards ---
  React.useEffect(() => {
    // Initial fetch: load existing cards from DB on mount
    listCardsFromDb()
      .then((rows) => setCards(rows.map(mapCardRowToCard)))
      .catch((err) => console.warn("[Cards] Failed to load initial cards:", err));

    const channel = supabase
      .channel("realtime-cards")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        (payload) => {
          console.log("Card change received!", payload);
          if (payload.eventType === "INSERT") {
            const next = mapCardRowToCard(payload.new);
            setCards((current) => {
              const exists = current.some((c) => c.id === next.id);
              return exists
                ? current.map((c) => (c.id === next.id ? next : c))
                : [next, ...current];
            });
          }
          if (payload.eventType === "UPDATE") {
            const next = mapCardRowToCard(payload.new);
            setCards((current) => {
              const exists = current.some((c) => c.id === next.id);
              return exists
                ? current.map((c) => (c.id === next.id ? next : c))
                : [next, ...current];
            });
          }
          if (payload.eventType === "DELETE") {
            setCards((current) =>
              current.filter((c) => c.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- [NEW] Realtime: pockets ---
  React.useEffect(() => {
    const channel = supabase
      .channel("realtime-pockets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pockets" },
        (payload) => {
          console.log("Pocket change received!", payload);
          if (payload.eventType === "INSERT") {
            setPockets((current) => [
              payload.new as unknown as FinancialPocket,
              ...current,
            ]);
          }
          if (payload.eventType === "UPDATE") {
            setPockets((current) =>
              current.map((p) =>
                p.id === (payload.new as any).id
                  ? ({ ...p, ...payload.new } as any)
                  : p,
              ),
            );
          }
          if (payload.eventType === "DELETE") {
            setPockets((current) =>
              current.filter((p) => p.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- [NEW] One-time migration: teamPaymentRecords from localStorage to Supabase ---
  React.useEffect(() => {
    const KEY = "vena-teamPaymentRecords";
    const FLAG = "vena-teamPaymentRecords-migrated";
    if ((window as any)[FLAG] || window.localStorage.getItem(FLAG) === "yes")
      return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsedData = JSON.parse(raw);
      if (!Array.isArray(parsedData) || parsedData.length === 0) return;
      (async () => {
        try {
          for (const rec of parsedData) {
            try {
              await createTeamPaymentRecord({
                recordNumber: rec.recordNumber,
                teamMemberId: rec.teamMemberId,
                date: rec.date,
                projectPaymentIds: rec.projectPaymentIds || [],
                totalAmount: rec.totalAmount || 0,
                vendorSignature: rec.vendorSignature || null,
              } as any);
            } catch {}
          }
          window.localStorage.setItem(FLAG, "yes");
          window.localStorage.removeItem(KEY);
          console.info("[Migration] teamPaymentRecords migrated to Supabase.");
        } catch (err) {
          console.warn("[Migration] teamPaymentRecords migration failed.", err);
        }
      })();
    } catch {}
  }, []);

  // --- [NEW] Load team payment records from Supabase on init and clear legacy localStorage ---
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("vena-teamPaymentRecords");
    } catch {}
    let isMounted = true;
    (async () => {
      try {
        const remote = await listTeamPaymentRecordsFromDb();
        if (!isMounted) return;
        setTeamPaymentRecords(Array.isArray(remote) ? remote : []);
      } catch (e) {
        console.warn("[Supabase] Failed to fetch team payment records.", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- [NEW] Load pockets from Supabase on init and clear legacy localStorage ---
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("vena-pockets");
    } catch {}
    let isMounted = true;
    (async () => {
      try {
        const remote = await listPocketsFromDb();
        if (!isMounted) return;
        setPockets(Array.isArray(remote) ? (remote as any) : []);
      } catch (e) {
        console.warn("[Supabase] Failed to fetch pockets.", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- [NEW] Load packages from Supabase on init and clear legacy localStorage ---
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("vena-packages");
    } catch {}
    let isMounted = true;
    (async () => {
      try {
        const remote = await listPackages();
        if (!isMounted) return;
        if (Array.isArray(remote)) setPackages(remote as any);
      } catch (e) {
        console.warn("[Supabase] Failed to fetch packages.", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- [NEW] Load add-ons from Supabase on init and clear legacy localStorage ---
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("vena-addOns");
    } catch {}
    let isMounted = true;
    (async () => {
      try {
        const remote = await listAddOns();
        if (!isMounted) return;
        if (Array.isArray(remote)) setAddOns(remote as any);
      } catch (e) {
        console.warn("[Supabase] Failed to fetch add-ons.", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- [NEW] Load leads from Supabase on init with realtime ---
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("vena-leads");
    } catch {}
    let isMounted = true;

    // 1. Initial fetch
    (async () => {
      try {
        const remoteLeads = await listLeadsFromDb();
        if (!isMounted) return;
        setLeads(Array.isArray(remoteLeads) ? remoteLeads : []);
      } catch (e) {
        console.warn("[Supabase] Failed to fetch leads.", e);
      }
    })();

    // 2. Realtime subscription
    const channel = supabase
      .channel("realtime-leads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          console.log("Lead change received!", payload);
          if (payload.eventType === "INSERT") {
            setLeads((current) => [payload.new as Lead, ...current]);
          }
          if (payload.eventType === "UPDATE") {
            setLeads((current) =>
              current.map((l) =>
                l.id === payload.new.id
                  ? ({ ...l, ...payload.new } as Lead)
                  : l,
              ),
            );
          }
          if (payload.eventType === "DELETE") {
            setLeads((current) =>
              current.filter((l) => l.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // --- [NEW] Load users from Supabase on init ---
  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const remote = await listUsersFromDb();
        if (!isMounted) return;
        setUsers(Array.isArray(remote) ? remote : []);
      } catch (e) {
        console.warn("[Supabase] Failed to fetch users.", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- [NEW] Load profile from Supabase on init and clear legacy localStorage ---
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("vena-profile");
    } catch {}
    let isMounted = true;
    (async () => {
      try {
        const remote = await getProfileFromDb();
        if (!isMounted) return;
        if (remote) setProfile(remote);
      } catch (e) {
        console.warn("[Supabase] Failed to fetch profile, using defaults.", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- [NEW] Ensure teamProjectPayments sourced only from Supabase ---
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("vena-teamProjectPayments");
    } catch {}
    let isMounted = true;
    (async () => {
      try {
        const remote = await listAllTeamPayments();
        if (!isMounted) return;
        setTeamProjectPayments(Array.isArray(remote) ? remote : []);
      } catch (e) {
        console.warn("[Supabase] Failed to fetch team project payments.", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- [NEW] Ensure projects are sourced only from Supabase (clear legacy localStorage key) ---
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("vena-projects");
    } catch {}
  }, []);

  // --- [MODIFIED] Load projects from Supabase on init with REALTIME ---
  React.useEffect(() => {
    let isMounted = true;

    // 1. Initial fetch (with relations so team assignments are available)
    const fetchProjects = async () => {
      try {
        const remoteProjects = await listProjectsWithRelations({ limit: 100 });
        if (isMounted) {
          setProjects(
            Array.isArray(remoteProjects) ? (remoteProjects as any) : [],
          );
        }
      } catch (e) {
        console.warn("[Supabase] Failed to fetch initial projects.", e);
      }
    };

    fetchProjects();

    // 2. Realtime subscription
    const channel = supabase
      .channel("realtime-projects-init")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          console.log("Project change received!", payload);
          if (payload.eventType === "INSERT") {
            setProjects((currentProjects) => [
              payload.new as Project,
              ...currentProjects,
            ]);
          }
          if (payload.eventType === "UPDATE") {
            setProjects((currentProjects) =>
              currentProjects.map((p) =>
                p.id === payload.new.id
                  ? ({ ...p, ...payload.new } as Project)
                  : p,
              ),
            );
          }
          if (payload.eventType === "DELETE") {
            setProjects((currentProjects) =>
              currentProjects.filter((p) => p.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    // 3. Cleanup
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const newRoute = window.location.hash || "#/home";
      setRoute(newRoute);
      if (!isAuthenticated) {
        const isPublicRoute =
          newRoute.startsWith("#/public") ||
          newRoute.startsWith("#/gallery") ||
          newRoute.startsWith("#/feedback") ||
          newRoute.startsWith("#/suggestion-form") ||
          newRoute.startsWith("#/portal") ||
          newRoute.startsWith("#/freelancer-portal") ||
          newRoute.startsWith("#/profile") ||
          newRoute.startsWith("#/portfolio") ||
          newRoute.startsWith("#/login") ||
          newRoute === "#/home" ||
          newRoute === "#";
        if (!isPublicRoute) {
          // Preserve intended internal route so we can return after login
          try {
            window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, newRoute);
          } catch (e) {
            console.warn(
              "[Routing] Failed to persist intended route before login:",
              e,
            );
          }
          window.location.hash = "#/login";
        }
      } else {
        const isPublicRoute =
          newRoute.startsWith("#/public") ||
          newRoute.startsWith("#/gallery") ||
          newRoute.startsWith("#/feedback") ||
          newRoute.startsWith("#/suggestion-form") ||
          newRoute.startsWith("#/portal") ||
          newRoute.startsWith("#/freelancer-portal") ||
          newRoute.startsWith("#/profile") ||
          newRoute.startsWith("#/portfolio");

        if (!didRestoreLastRouteRef.current) {
          didRestoreLastRouteRef.current = true;
          const isEmptyOrHome =
            newRoute === "#" ||
            newRoute === "" ||
            newRoute.startsWith("#/home");
          if (!isPublicRoute && isEmptyOrHome) {
            try {
              const last = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
              if (
                last &&
                typeof last === "string" &&
                last.startsWith("#/") &&
                !last.startsWith("#/home")
              ) {
                window.location.hash = last;
                return;
              }
            } catch (e) {
              console.warn(
                "[Routing] Failed to restore last route from localStorage:",
                e,
              );
            }
          }
        }

        // Allow authenticated users to stay on Home if they are there on initial load.
        // Only redirect away from explicit auth landing pages like login or empty hash.
        const shouldRedirectFrom =
          newRoute.startsWith("#/login") || newRoute === "#";
        if (shouldRedirectFrom) {
          window.location.hash = "#/dashboard";
        }

        // Persist last internal app route for next reload (avoid persisting public routes)
        if (
          !isPublicRoute &&
          newRoute.startsWith("#/") &&
          !newRoute.startsWith("#/login") &&
          !newRoute.startsWith("#/home") &&
          newRoute !== "#"
        ) {
          try {
            window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, newRoute);
          } catch (e) {
            console.warn(
              "[Routing] Failed to persist last route to localStorage:",
              e,
            );
          }
        }
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Initial check
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [isAuthenticated]);

  useEffect(() => {
    const path = (route.split("?")[0].split("/")[1] || "home").toLowerCase();

    const routeToView: Record<string, ViewType> = {
      home: ViewType.HOMEPAGE,
      dashboard: ViewType.DASHBOARD,
      "Calon Pengantin": ViewType["Calon Pengantin"],
      prospek: ViewType["Calon Pengantin"],
      "calon pengantin": ViewType["Calon Pengantin"],
      booking: ViewType.BOOKING,
      clients: ViewType.CLIENTS,
      projects: ViewType.PROJECTS,
      "inventaris-dekorasi": ViewType.INVENTORY,
      team: ViewType.TEAM,
      finance: ViewType.FINANCE,
      calendar: ViewType.CALENDAR,
      packages: ViewType.PACKAGES,
      "promo-codes": ViewType.PROMO_CODES,
      gallery: ViewType.GALLERY,
      "client-reports": ViewType.CLIENT_REPORTS,
      settings: ViewType.SETTINGS,
    };

    if (Object.prototype.hasOwnProperty.call(routeToView, path)) {
      setActiveView(routeToView[path]);
      return;
    }

    const newView = Object.values(ViewType).find(
      (v) => v.toLowerCase().replace(/ /g, "-") === path,
    );
    if (newView) {
      setActiveView(newView);
    } else if (path === "team") {
      // Handle 'Tim / Vendor' mapping to 'team' route
      setActiveView(ViewType.TEAM);
    }
  }, [route]);

  // Ensure data loads when activeView changes (covers direct URL/hash navigation)
  useEffect(() => {
    if (!isAuthenticated) return;
    switch (activeView) {
      case ViewType.DASHBOARD:
        appData.loadClients();
        appData.loadProjects();
        appData.loadTransactions();
        appData.loadTeamMembers();
        break;
      case ViewType["Calon Pengantin"]:
        appData.loadClients();
        appData.loadProjects();
        break;
      case ViewType.BOOKING:
        appData.loadClients();
        appData.loadProjects();
        break;
      case ViewType.CLIENTS:
        appData.loadClients();
        break;
      case ViewType.PROJECTS:
        appData.loadProjects();
        appData.loadTeamMembers();
        if (!teamPaymentsLoaded) {
          (async () => {
            try {
              const items = await listAllTeamPayments();
              setTeamProjectPayments(items);
              setTeamPaymentsLoaded(true);
            } catch (e) {
              console.warn(
                "[TeamPayments] Failed to fetch team project payments:",
                e,
              );
            }
          })();
        }
        break;
      case ViewType.INVENTORY:
        appData.loadProjects();
        break;
      case ViewType.TEAM:
        appData.loadTeamMembers();
        break;
      case ViewType.FINANCE:
        appData.loadTransactions();
        break;
      case ViewType.PACKAGES:
      case ViewType.PROMO_CODES:
      case ViewType.CALENDAR:
      case ViewType.GALLERY:
        appData.loadProjects();
        break;

      default:
        break;
    }
  }, [
    activeView,
    isAuthenticated,
    appData.loadClients,
    appData.loadProjects,
    appData.loadTeamMembers,
    appData.loadTransactions,
  ]);

  // --- Pre-load ALL critical data when authenticated so every page shows data immediately ---
  useEffect(() => {
    if (!isAuthenticated) return;

    // Load all data in parallel immediately - no delay.
    appData.loadClients();
    appData.loadProjects();
    appData.loadTransactions();
    appData.loadTeamMembers();
    appData.loadLeads();
    appData.loadClientFeedback();
    appData.loadTotals();
  }, [
    isAuthenticated,
    appData.loadClients,
    appData.loadProjects,
    appData.loadTransactions,
    appData.loadTeamMembers,
    appData.loadLeads,
    appData.loadClientFeedback,
    appData.loadTotals,
  ]);

  useEffect(() => {
    const styleElement = document.getElementById("public-theme-style");
    const isPublicRoute =
      route.startsWith("#/public") ||
      route.startsWith("#/gallery") ||
      route.startsWith("#/portal") ||
      route.startsWith("#/freelancer-portal") ||
      route.startsWith("#/profile") ||
      route.startsWith("#/portfolio");

    document.body.classList.toggle("app-theme", !isPublicRoute);
    document.body.classList.toggle("public-page-body", isPublicRoute);

    if (isPublicRoute) {
      const brandColor = profile.brandColor || "#3b82f6";

      if (styleElement) {
        const hoverColor = darkenColor(brandColor, 10);
        const brandHsl = hexToHsl(brandColor);
        styleElement.innerHTML = `
                    :root {
                        --public-accent: ${brandColor};
                        --public-accent-hover: ${hoverColor};
                        --public-accent-hsl: ${brandHsl};
                    }
                `;
      }
    } else if (styleElement) {
      styleElement.innerHTML = "";
    }
  }, [route, profile.brandColor]);

  // Ensure required data is loaded when visiting public portal routes directly
  useEffect(() => {
    if (route.startsWith("#/portal/")) {
      appData.loadClients();
      appData.loadProjects();
      appData.loadTransactions();
    }

    if (route.startsWith("#/freelancer-portal/")) {
      appData.loadTeamMembers();
      appData.loadProjects();
      appData.loadTransactions();
    }
  }, [
    route,
    appData.loadClients,
    appData.loadProjects,
    appData.loadTransactions,
    appData.loadTeamMembers,
  ]);

  const showNotification = (message: string, duration: number = 3000) => {
    setNotification(message);
    setTimeout(() => {
      setNotification("");
    }, duration);
  };

  const handleSetProfile = (value: React.SetStateAction<Profile>) => {
    setProfile(value);
  };

  const handleLoginSuccess = (user: User) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    try {
      const last = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
      if (
        last &&
        typeof last === "string" &&
        last.startsWith("#/") &&
        !last.startsWith("#/home") &&
        !last.startsWith("#/login")
      ) {
        window.location.hash = last;
        return;
      }
    } catch (e) {
      console.warn("[Routing] Failed to read last route after login:", e);
    }

    window.location.hash = "#/dashboard";
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    try {
      window.localStorage.removeItem(LAST_ROUTE_STORAGE_KEY);
    } catch { }
    window.location.hash = "#/home";
  };

  const handleMarkAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleNavigation = (
    view: ViewType,
    action?: NavigationAction,
    notificationId?: string,
  ) => {
    const pathMap: Partial<Record<ViewType, string>> = {
      [ViewType.HOMEPAGE]: "home",
      [ViewType.DASHBOARD]: "dashboard",
      [ViewType["Calon Pengantin"]]: "prospek",
      [ViewType.BOOKING]: "booking",
      [ViewType.CLIENTS]: "clients",
      [ViewType.PROJECTS]: "projects",
      [ViewType.INVENTORY]: "inventaris-dekorasi",
      [ViewType.TEAM]: "team",
      [ViewType.FINANCE]: "finance",
      [ViewType.CALENDAR]: "calendar",
      [ViewType.PACKAGES]: "packages",
      [ViewType.PROMO_CODES]: "promo-codes",
      [ViewType.CLIENT_REPORTS]: "client-reports",
      [ViewType.SETTINGS]: "settings",
      [ViewType.VENDOR_PROFILE]: "vendor-profile",
    };

    const newRoute = `#/${pathMap[view] || view.toLowerCase().replace(/ /g, "-")}`;

    window.location.hash = newRoute;

    try {
      window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, newRoute);
    } catch (e) {
      console.warn(
        "[Routing] Failed to persist last route to localStorage:",
        e,
      );
    }

    // Lazy load data based on view
    switch (view) {
      case ViewType.CLIENTS:
        appData.loadClients();
        break;
      case ViewType.PROJECTS:
        appData.loadProjects();
        appData.loadTeamMembers();
        break;
      case ViewType.INVENTORY:
        appData.loadProjects();
        break;
      case ViewType.TEAM:
        appData.loadTeamMembers();
        break;
      case ViewType.FINANCE:
        appData.loadTransactions();
        break;
    }

    setActiveView(view);
    setInitialAction(action || null);
    setIsSidebarOpen(false); // Close sidebar on navigation
    setIsSearchOpen(false); // Close search on navigation

    if (notificationId) {
      handleMarkAsRead(notificationId);
    }
  };

  const hasPermission = (view: ViewType) => {
    if (!currentUser) return false;
    if (currentUser.role === "Admin") return true;
    return currentUser.permissions?.includes(view) || false;
  };

  const renderView = () => {
    if (!hasPermission(activeView)) {
      return (
        <AccessDenied
          onBackToDashboard={() => setActiveView(ViewType.DASHBOARD)}
        />
      );
    }
    switch (activeView) {
      case ViewType.DASHBOARD:
        return (
          <Dashboard
            projects={projects}
            clients={clients}
            transactions={transactions}
            teamMembers={teamMembers}
            cards={cards}
            pockets={pockets}
            handleNavigation={handleNavigation}
            leads={leads}
            teamProjectPayments={teamProjectPayments}
            packages={packages}
            clientFeedback={clientFeedback}
            currentUser={currentUser}
            projectStatusConfig={profile.projectStatusConfig}
            profile={profile}
            totals={appData.totals}
          />
        );
      case ViewType["Calon Pengantin"]:
        return (
          <Leads
            leads={leads}
            setLeads={setLeads}
            clients={clients}
            setClients={setClients}
            projects={projects}
            setProjects={setProjects}
            packages={packages}
            addOns={addOns}
            transactions={transactions}
            setTransactions={setTransactions}
            userProfile={profile}
            setProfile={handleSetProfile}
            showNotification={showNotification}
            cards={cards}
            setCards={setCards}
            pockets={pockets}
            setPockets={setPockets}
            promoCodes={promoCodes}
            setPromoCodes={setPromoCodes}
            handleNavigation={handleNavigation}
            totals={appData.totals}
          />
        );
      case ViewType.BOOKING:
        return (
          <Booking
            leads={leads}
            clients={clients}
            projects={projects}
            setProjects={setProjects}
            packages={packages}
            userProfile={profile}
            setProfile={setProfile}
            handleNavigation={handleNavigation}
            showNotification={showNotification}
          />
        );
      case ViewType.CLIENTS:
        return (
          <DataLoadingWrapper
            loading={appData.loading.clients}
            loaded={appData.loaded.clients}
            loadingMessage="Memuat data klien..."
            onRetry={appData.loadClients}
          >
            <Clients
              clients={clients}
              setClients={setClients}
              projects={projects}
              setProjects={setProjects}
              packages={packages}
              addOns={addOns}
              transactions={transactions}
              setTransactions={setTransactions}
              userProfile={profile}
              showNotification={showNotification}
              initialAction={initialAction}
              setInitialAction={setInitialAction}
              cards={cards}
              setCards={setCards}
              pockets={pockets}
              setPockets={setPockets}
              handleNavigation={handleNavigation}
              clientFeedback={clientFeedback}
              promoCodes={promoCodes}
              setPromoCodes={setPromoCodes}
              totals={appData.totals}
              onSignInvoice={async (pId, sig) => {
                // Optimistic UI
                setProjects((prev) =>
                  prev.map((p) =>
                    p.id === pId ? { ...p, invoiceSignature: sig } : p,
                  ),
                );
                try {
                  await updateProjectInDb(pId, {
                    invoiceSignature: sig,
                  } as any);
                } catch (e) {
                  console.warn("[App] Failed to persist invoice signature:", e);
                }
              }}
              onSignTransaction={async (tId, sig) => {
                // Optimistic UI
                setTransactions((prev) =>
                  prev.map((t) =>
                    t.id === tId ? { ...t, vendorSignature: sig } : t,
                  ),
                );
                try {
                  await updateTransactionInDb(tId, {
                    vendorSignature: sig,
                  } as any);
                } catch (e) {
                  console.warn(
                    "[App] Failed to persist transaction signature:",
                    e,
                  );
                }
              }}
              onRecordPayment={async (
                projectId: string,
                amount: number,
                destinationCardId: string,
              ) => {
                try {
                  const today = new Date().toISOString().split("T")[0];
                  const proj = projects.find((p) => p.id === projectId);
                  if (!proj) return;
                  // Create income transaction
                  const tx = await createTransaction({
                    date: today,
                    description: `Pembayaran Acara Pernikahan ${proj.projectName}`,
                    amount,
                    type: TransactionType.INCOME,
                    projectId,
                    category: "Pelunasan Acara Pernikahan",
                    method: "Transfer Bank",
                    cardId: destinationCardId,
                  } as any);
                  // Update card balance
                  if (destinationCardId) {
                    try {
                      await updateCardBalance(destinationCardId, amount);
                    } catch (error) {
                      console.error(
                        "[Payment] Failed to update card balance:",
                        error,
                      );
                    }
                    setCards((prev) =>
                      prev.map((c) =>
                        c.id === destinationCardId
                          ? { ...c, balance: (c.balance || 0) + amount }
                          : c,
                      ),
                    );
                  }
                  // Update project payment fields
                  const newAmountPaid = (proj.amountPaid || 0) + amount;
                  let newPaymentStatus = PaymentStatus.BELUM_BAYAR as any;
                  if (newAmountPaid >= proj.totalCost)
                    newPaymentStatus = PaymentStatus.LUNAS;
                  else if (newAmountPaid > 0)
                    newPaymentStatus = PaymentStatus.DP_TERBAYAR;
                  // Optimistic UI
                  setProjects((prev) =>
                    prev.map((p) =>
                      p.id === projectId
                        ? {
                          ...p,
                          amountPaid: newAmountPaid,
                          paymentStatus: newPaymentStatus,
                        }
                        : p,
                    ),
                  );
                  // Persist to Supabase
                  try {
                    await updateProjectInDb(projectId, {
                      amountPaid: newAmountPaid,
                      paymentStatus: newPaymentStatus,
                    } as any);
                  } catch (error) {
                    console.error(
                      "[Payment] Failed to update project in database:",
                      error,
                    );
                  }
                  // Update transactions list
                  setTransactions((prev) =>
                    [tx, ...prev].sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime(),
                    ),
                  );
                  showNotification("Pembayaran berhasil dicatat.");
                } catch (e) {
                  console.warn("[Clients] Failed to record payment:", e);
                  showNotification("Gagal mencatat pembayaran. Coba lagi.");
                }
              }}
              addNotification={addNotification}
            />
          </DataLoadingWrapper>
        );
      case ViewType.PROJECTS:
        return (
          <DataLoadingWrapper
            loading={appData.loading.projects}
            loaded={appData.loaded.projects}
            loadingMessage="Memuat data proyek..."
            onRetry={appData.loadProjects}
          >
            <Projects
              projects={projects}
              setProjects={setProjects}
              clients={clients}
              packages={packages}
              teamMembers={teamMembers}
              teamProjectPayments={teamProjectPayments}
              setTeamProjectPayments={setTeamProjectPayments}
              transactions={transactions}
              setTransactions={setTransactions}
              initialAction={initialAction}
              setInitialAction={setInitialAction}
              profile={profile}
              showNotification={showNotification}
              cards={cards}
              setCards={setCards}
              pockets={pockets}
              setPockets={setPockets}
              totals={appData.totals}
            />
          </DataLoadingWrapper>
        );
      case ViewType.TEAM:
        return (
          <DataLoadingWrapper
            loading={appData.loading.teamMembers}
            loaded={appData.loaded.teamMembers}
            loadingMessage="Memuat data tim..."
            onRetry={appData.loadTeamMembers}
          >
            <Freelancers
              teamMembers={teamMembers}
              setTeamMembers={setTeamMembers}
              teamProjectPayments={teamProjectPayments}
              setTeamProjectPayments={setTeamProjectPayments}
              teamPaymentRecords={teamPaymentRecords}
              setTeamPaymentRecords={setTeamPaymentRecords}
              transactions={transactions}
              setTransactions={setTransactions}
              userProfile={profile}
              showNotification={showNotification}
              initialAction={initialAction}
              setInitialAction={setInitialAction}
              projects={projects}
              setProjects={setProjects}

              pockets={pockets}
              setPockets={setPockets}
              cards={cards}
              setCards={setCards}
              onSignPaymentRecord={(rId, sig) =>
                setTeamPaymentRecords((prev) =>
                  prev.map((r) =>
                    r.id === rId ? { ...r, vendorSignature: sig } : r,
                  ),
                )
              }
              totals={appData.totals}
            />
          </DataLoadingWrapper>
        );
      case ViewType.INVENTORY:
        return (
          <DataLoadingWrapper
            loading={appData.loading.projects}
            loaded={appData.loaded.projects}
            loadingMessage="Memuat data proyek..."
            onRetry={appData.loadProjects}
          >
            <InventoryPage projects={projects} />
          </DataLoadingWrapper>
        );
      case ViewType.FINANCE:
        return (
          <DataLoadingWrapper
            loading={appData.loading.transactions}
            loaded={appData.loaded.transactions}
            loadingMessage="Memuat data transaksi..."
            onRetry={appData.loadTransactions}
          >
            <Finance
              transactions={transactions}
              setTransactions={setTransactions}
              pockets={pockets}
              setPockets={setPockets}
              projects={projects}
              setProjects={setProjects}
              profile={profile}
              cards={cards}
              setCards={setCards}
              teamMembers={teamMembers}

            />
          </DataLoadingWrapper>
        );
      case ViewType.PACKAGES:
        return (
          <Packages
            packages={packages}
            setPackages={setPackages}
            addOns={addOns}
            setAddOns={setAddOns}
            projects={projects}
            profile={profile}
          />
        );
      case ViewType.SETTINGS:
        return (
          <Settings
            profile={profile}
            setProfile={handleSetProfile}
            transactions={transactions}
            projects={projects}
            packages={packages}
            users={users}
            setUsers={setUsers}
            currentUser={currentUser}
          />
        );
      case ViewType.VENDOR_PROFILE:
        return <VendorProfileAdmin />;
      case ViewType.CALENDAR:
        return (
          <CalendarView
            projects={projects}
            setProjects={setProjects}
            teamMembers={teamMembers}
            profile={profile}
            clients={clients}
            handleNavigation={handleNavigation}
          />
        );
      case ViewType.CLIENT_REPORTS:
        return (
          <ClientReports
            clients={clients}
            leads={leads}
            projects={projects}
            feedback={clientFeedback}
            setFeedback={setClientFeedback}
            showNotification={showNotification}
          />
        );

      case ViewType.PROMO_CODES:
        return (
          <PromoCodes
            promoCodes={promoCodes}
            setPromoCodes={setPromoCodes}
            projects={projects}
            showNotification={showNotification}
          />
        );
      case ViewType.GALLERY:
        return (
          <GalleryUpload
            userProfile={profile}
            showNotification={showNotification}
          />
        );
      default:
        return <div />;
    }
  };

  // --- ROUTING LOGIC ---
  if (route.startsWith("#/home") || route === "#/" || route === "#") {
    if (isAuthenticated) {
      try {
        const last = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
        if (
          last &&
          typeof last === "string" &&
          last.startsWith("#/") &&
          !last.startsWith("#/home") &&
          last !== route
        ) {
          window.location.hash = last;
          return null;
        }
      } catch (e) {
        console.warn(
          "[Routing] Failed to read last route from localStorage:",
          e,
        );
      }

      window.location.hash = "#/dashboard";
      return null;
    }

    return <Homepage />;
  }
  if (route.startsWith("#/login"))
    return <Login onLoginSuccess={handleLoginSuccess} users={users} />;

  if (route.startsWith("#/profile")) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div></div>}>
        <VendorPublicProfile />
      </Suspense>
    );
  }

  if (route.startsWith("#/portfolio/")) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div></div>}>
        <PortfolioDetailPage />
      </Suspense>
    );
  }

  if (route.startsWith("#/public-packages")) {
    return (
      <PublicPackages
        userProfile={profile}
        showNotification={showNotification}
        setClients={setClients}
        setProjects={setProjects}
        setTransactions={setTransactions}
        setCards={setCards}
        setLeads={setLeads}
        addNotification={addNotification}
        cards={cards}
        projects={projects}
        promoCodes={promoCodes}
        setPromoCodes={setPromoCodes}
      />
    );
  }
  if (route.startsWith("#/public-booking")) {
    const allDataForForm = {
      clients,
      projects,
      teamMembers,
      transactions,
      teamProjectPayments,
      teamPaymentRecords,
      pockets,
      profile,
      leads,

      cards,
      clientFeedback,
      notifications,
      promoCodes,
      packages,
      addOns,
    };
    return (
      <PublicBookingForm
        {...allDataForForm}
        userProfile={profile}
        showNotification={showNotification}
        setClients={setClients}
        setProjects={setProjects}
        setTransactions={setTransactions}
        setCards={setCards}
        setPockets={setPockets}
        setPromoCodes={setPromoCodes}
        setLeads={setLeads}
        addNotification={addNotification}
      />
    );
  }
  if (route.startsWith("#/public-lead-form")) {
    // FIX: Pass addNotification prop to PublicLeadForm
    return (
      <PublicLeadForm
        setLeads={setLeads}
        userProfile={profile}
        showNotification={showNotification}
        addNotification={addNotification}
      />
    );
  }

  if (route.startsWith("#/feedback"))
    return <PublicFeedbackForm setClientFeedback={setClientFeedback} />;
  if (route.startsWith("#/suggestion-form"))
    return <SuggestionForm setLeads={setLeads} />;
  if (route.startsWith("#/test-signature")) return <TestSignature />;
  if (route.startsWith("#/gallery/")) {
    const galleryId = route.split("/")[2];
    return <PublicGallery galleryId={galleryId} />;
  }
  if (route.startsWith("#/portal/invoice/")) {
    const projectId = route.split("/portal/invoice/")[1] || "";
    return (
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative flex justify-center items-center">
              <div className="absolute border-4 border-brand-accent/20 rounded-full w-12 h-12"></div>
              <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-12 h-12"></div>
            </div>
          </div>
        }
      >
        <PublicInvoice
          projectId={projectId}
        />
      </Suspense>
    );
  }
  if (route.startsWith("#/portal/receipt/")) {
    const transactionId = route.split("/portal/receipt/")[1] || "";
    return (
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative flex justify-center items-center">
              <div className="absolute border-4 border-brand-accent/20 rounded-full w-12 h-12"></div>
              <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-12 h-12"></div>
            </div>
          </div>
        }
      >
        <PublicReceipt
          transactionId={transactionId}
        />
      </Suspense>
    );
  }
  if (route.startsWith("#/portal/")) {
    // Normalize accessId: cut off after next '/' or any query/hash, and decode
    const raw = route.split("/portal/")[1] || "";
    const accessId = decodeURIComponent(
      (raw.split(/[?#]/)[0] || "").split("/")[0] || "",
    ).trim();
    return (
      <ClientPortal
        accessId={accessId}
        clients={clients}
        projects={projects}
        setClientFeedback={setClientFeedback}
        showNotification={showNotification}
        transactions={transactions}
        userProfile={profile}
        packages={packages}
        teamMembers={teamMembers}
        onClientSubStatusConfirmation={async (pId, sub, note) => {
          // Optimistic update
          setProjects((prev) =>
            prev.map((p) =>
              p.id === pId
                ? {
                  ...p,
                  confirmedSubStatuses: [
                    ...(p.confirmedSubStatuses || []),
                    sub,
                  ],
                  clientSubStatusNotes: {
                    ...(p.clientSubStatusNotes || {}),
                    [sub]: note,
                  },
                }
                : p,
            ),
          );
          // Persist to DB
          try {
            await markSubStatusConfirmed(pId, sub, note);
          } catch (e) {
            console.warn(
              "[Portal] Failed to persist sub-status confirmation:",
              e,
            );
          }
        }}
      />
    );
  }
  if (route.startsWith("#/freelancer-portal/")) {
    // Normalize accessId: cut off after next '/' or any query/hash, and decode
    const raw = route.split("/freelancer-portal/")[1] || "";
    const accessId = decodeURIComponent(
      (raw.split(/[?#]/)[0] || "").split("/")[0] || "",
    ).trim();
    return (
      <FreelancerPortal
        accessId={accessId}
        teamMembers={teamMembers}
        projects={projects}
        teamProjectPayments={teamProjectPayments}
        teamPaymentRecords={teamPaymentRecords}

        showNotification={showNotification}
        userProfile={profile}
        addNotification={addNotification}
      />
    );
  }

if (!isAuthenticated)
  return <Login onLoginSuccess={handleLoginSuccess} users={users} />;

return (
  <div className="flex min-h-screen bg-brand-bg text-brand-text-primary">
    {/* Main Layout */}
    <Sidebar
      activeView={activeView}
      setActiveView={(view) => handleNavigation(view)}
      isOpen={isSidebarOpen}
      setIsOpen={setIsSidebarOpen}
      currentUser={currentUser}
      onLogout={handleLogout}
      profile={profile}
    />

    <div className="flex-1 flex flex-col xl:pl-64 overflow-hidden">
      <Header
        pageTitle={activeView}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        setIsSearchOpen={setIsSearchOpen}
        notifications={notifications}
        handleNavigation={handleNavigation}
        handleMarkAllAsRead={handleMarkAllAsRead}
        currentUser={currentUser}
        profile={profile}
        handleLogout={handleLogout}
      />

      <main
        className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-20 xl:pb-8 overflow-y-auto"
        style={{
          paddingBottom: "calc(5rem + var(--safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="animate-fade-in">
          <ErrorBoundary
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-red-500 text-4xl mb-2">âš ï¸</div>
                  <p className="text-brand-text-secondary">
                    Gagal memuat komponen. Silakan coba lagi.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 button-primary"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative flex justify-center items-center">
                    <div className="absolute border-4 border-brand-accent/20 rounded-full w-12 h-12"></div>
                    <div className="animate-spin border-4 border-transparent border-t-brand-accent rounded-full w-12 h-12"></div>
                  </div>
                </div>
              }
            >
              {renderView()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>

    {/* Enhanced Notification Toast */}
    {notification && (
      <div
        className="
            fixed top-4 right-4 
            sm:top-6 sm:right-6
            bg-brand-accent 
            text-white 
            py-3 px-4 sm:py-4 sm:px-6
            rounded-xl 
            shadow-2xl 
            z-50 
            animate-fade-in-out
            backdrop-blur-sm
            border border-brand-accent-hover/20
            max-w-sm
            break-words
        "
        style={{
          top: "calc(1rem + var(--safe-area-inset-top, 0px))",
          right: "calc(1rem + var(--safe-area-inset-right, 0px))",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse-soft" />
          <span className="font-medium text-sm sm:text-base">
            {notification}
          </span>
        </div>
      </div>
    )}

    <GlobalSearch
      isOpen={isSearchOpen}
      onClose={() => setIsSearchOpen(false)}
      clients={clients}
      projects={projects}
      teamMembers={teamMembers}
      handleNavigation={handleNavigation}
    />

    <BottomNavBar
      activeView={activeView}
      handleNavigation={handleNavigation}
    />
  </div>
);
};

export default App;
