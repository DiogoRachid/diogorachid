import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Users, Building2, Wallet, Receipt,
  ArrowDownCircle, ArrowUpCircle, PieChart, FileText, Settings,
  Menu, X, ChevronDown, LogOut, HardHat, Landmark, FolderKanban,
  TrendingUp, Moon, Sun, UsersRound, Clock, FileSignature, Gift,
  Package, Layers, Calculator, UploadCloud, History, DollarSign,
  DatabaseBackup, Ruler, ChevronLeft, ChevronRight, Calendar,
  FileInput, Truck, ShoppingCart, Globe, BookOpen, GripVertical,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { useColorScheme } from '@/lib/useColorScheme';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    page: 'Dashboard'
  },
  {
    title: 'Cadastros',
    icon: FolderKanban,
    submenu: [
      { title: 'Fornecedores', page: 'Suppliers', icon: Building2 },
      { title: 'Clientes', page: 'Clients', icon: Users },
      { title: 'Obras', page: 'Projects', icon: HardHat },
      { title: 'Centros de Custo', page: 'CostCenters', icon: PieChart },
      { title: 'Insumos', page: 'Inputs', icon: Package },
      { title: 'Serviços (Composições)', page: 'Services', icon: Layers },
      { title: 'Importação Tabelas', page: 'TableImport', icon: UploadCloud }
      ]
      },
      {
        title: 'Orçamentos',
        icon: Calculator,
        page: 'Budgets'
      },
      {
        title: 'Planejamento',
        icon: Calendar,
        page: 'Plannings'
      },
      {
        title: 'Medições',
        icon: Ruler,
        page: 'Measurements'
      },
      {
        title: 'Financeiro',
        icon: Wallet,
        submenu: [
          { title: 'Contas Bancárias', page: 'BankAccounts', icon: Landmark },
          { title: 'Contas a Pagar', page: 'AccountsPayable', icon: ArrowDownCircle },
          { title: 'Contas a Receber', page: 'AccountsReceivable', icon: ArrowUpCircle },
          { title: 'Transações', page: 'Transactions', icon: Receipt }
        ]
      },
  {
    title: 'RH',
    icon: UsersRound,
    submenu: [
      { title: 'Colaboradores', page: 'Employees', icon: Users },
      { title: 'Equipes', page: 'Teams', icon: UsersRound },
      { title: 'Frequência', page: 'TimeRecords', icon: Clock },
      { title: 'Contratos', page: 'EmployeeContracts', icon: FileSignature },
      { title: 'Folha de Pagamento', page: 'Payrolls', icon: DollarSign },
      { title: 'Benefícios', page: 'Benefits', icon: Gift },
      { title: 'Relatórios RH', page: 'HRReports', icon: FileText }
    ]
  },
  {
    title: 'Investimentos',
    icon: TrendingUp,
    submenu: [
      { title: 'Carteira', page: 'Investments', icon: TrendingUp },
      { title: 'Histórico Global', page: 'InvestmentTransactions', icon: History }
    ]
  },
  {
    title: 'Obra',
    icon: Truck,
    submenu: [
      { title: 'Diário de Obra', page: 'DiarioObra', icon: BookOpen },
      { title: 'Histórico de Insumos', page: 'InputPurchaseHistory', icon: History },
      { title: 'Pedidos de Materiais', page: 'MaterialRequisitions', icon: FileInput },
      { title: 'Lista de Compras', page: 'PurchasingList', icon: ShoppingCart },
      { title: 'Importar Nota Fiscal', page: 'ImportInvoice', icon: UploadCloud },
      { title: 'Importar NF Manual', page: 'ImportInvoiceManual', icon: FileInput }
    ]
  },
  {
    title: 'Relatórios',
    icon: FileText,
    submenu: [
      { title: 'Relatórios Gerais', page: 'Reports', icon: FileText },
      { title: 'Variação de Insumos', page: 'InputPriceVariationReport', icon: TrendingUp },
      { title: 'Variação de Serviços', page: 'ServicePriceVariationReport', icon: TrendingUp }
    ]
  },
  {
    title: 'Backup',
    icon: DatabaseBackup,
    page: 'Backup'
  },
  {
    title: 'Configurações',
    icon: Settings,
    page: 'Settings'
  },
  {
    title: 'Documentos',
    icon: FileText,
    page: 'Documents'
  },
  {
    title: 'Site da Empresa',
    icon: Globe,
    page: 'LandingPage'
  }
];

const DEFAULT_LOGO_CLARA = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/user_690c7efb29582ad524a0ff3e/fb3eac426_logofundoclaro.jpg";
const DEFAULT_LOGO_ESCURA = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6926eb0b6c1242bf806695a4/4053fb920_logofundoescuro.png";

const DEFAULT_MENU_ORDER = menuItems.map(m => m.title);

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    }
    return false;
  });
  const [expandedMenus, setExpandedMenus] = useState([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [menuOrder, setMenuOrder] = useState(DEFAULT_MENU_ORDER);
  const menuOrderRef = useRef(DEFAULT_MENU_ORDER);
  const [user, setUser] = useState(null);
  const [companySettings, setCompanySettings] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const { colorScheme } = useColorScheme();

  const sortedMenuItems = useMemo(() => {
    return [...menuItems].sort((a, b) => menuOrder.indexOf(a.title) - menuOrder.indexOf(b.title));
  }, [menuOrder]);

  const moveMenuItem = (index, direction) => {
    setMenuOrder(prev => {
      const newOrder = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return prev;
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      menuOrderRef.current = newOrder;
      return newOrder;
    });
  };

  const saveMenuOrder = async (order) => {
    setSavingOrder(true);
    try {
      await base44.functions.invoke('saveMenuOrder', { site_menu_order: order });
    } catch (e) {
      console.error('Erro ao salvar menu:', e);
    } finally {
      setSavingOrder(false);
    }
  };
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    // Carrega usuário (portal admin via sessionStorage, ou plataforma Base44)
    const portalAdminSession = (() => {
      try { return JSON.parse(sessionStorage.getItem('portal_admin_auth')); } catch { return null; }
    })();
    if (portalAdminSession) {
      setUser({ full_name: portalAdminSession.nome, permissao_financeiro: 'admin' });
    } else {
      base44.auth.me().then(setUser).catch(() => {});
    }

    // Carrega settings e menu order — independente do auth
    base44.entities.CompanySettings.list().then(settings => {
      if (settings.length > 0) {
        const s = settings[0];
        setCompanySettings(s);
        if (s.site_menu_order && Array.isArray(s.site_menu_order) && s.site_menu_order.length > 0) {
          const saved = s.site_menu_order;
          const finalOrder = [
            ...saved.filter(t => DEFAULT_MENU_ORDER.includes(t)),
            ...DEFAULT_MENU_ORDER.filter(t => !saved.includes(t))
          ];
          menuOrderRef.current = finalOrder;
          setMenuOrder(finalOrder);
        }
      }
    }).catch(e => console.error('Erro ao carregar settings:', e));
  }, []);

  const logoClara = companySettings?.logo_url_clara || DEFAULT_LOGO_CLARA;
  const logoEscura = companySettings?.logo_url_escura || DEFAULT_LOGO_ESCURA;
  const nomeEmpresa = companySettings?.nome_empresa || 'Virtual Construções';

  const toggleSubmenu = (title) => {
    setExpandedMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_admin_auth');
    sessionStorage.removeItem('portal_colaborador_auth');
    window.location.href = '/PortalSelect';
  };

  const getPermissionLabel = (perm) => {
    const labels = {
      'admin': 'Administrador',
      'analista': 'Analista Financeiro',
      'diretoria': 'Diretoria',
      'admin_rh': 'Admin RH',
      'gestor_obras': 'Gestor de Obras',
      'colaborador': 'Colaborador'
    };
    return labels[perm] || 'Usuário';
  };

  return (
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b z-50 flex items-center justify-between px-4 transition-colors bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="text-slate-700 dark:text-slate-200"
        >
          <Menu className="h-6 w-6" />
        </Button>
        <img 
          src={darkMode ? logoEscura : logoClara} 
          alt={nomeEmpresa} 
          className="h-7 object-contain"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDarkMode(!darkMode)}
          className="text-slate-700 dark:text-slate-200"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full border-r z-50 transition-all duration-300",
        sidebarCollapsed ? "w-20" : "w-72",
        "bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-700",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-700">
            {!sidebarCollapsed && (
              <img 
                src={darkMode ? logoEscura : logoClara}
                alt={nomeEmpresa}
                className="h-10 object-contain"
              />
            )}
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'mx-auto' : ''}`}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
                className="hidden lg:flex text-slate-600 dark:text-slate-200"
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="lg:hidden text-slate-600 dark:text-slate-200"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 px-4">
            {!sidebarCollapsed && (
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Menu</span>
                <button
                  onClick={() => {
                   if (reorderMode) {
                     saveMenuOrder(menuOrderRef.current);
                   }
                   setReorderMode(r => !r);
                 }}
                  disabled={savingOrder}
                  className={cn(
                    "text-xs px-2 py-1 rounded-lg transition-colors",
                    reorderMode
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {savingOrder ? 'Salvando...' : reorderMode ? 'Concluir' : 'Reordenar'}
                </button>
              </div>
            )}
            <div className="space-y-1">
              {sortedMenuItems.map((item, index) => (
                <div key={item.title} className="flex items-center gap-1">
                  {reorderMode && !sidebarCollapsed && (
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveMenuItem(index, -1)}
                        disabled={index === 0}
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-400"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveMenuItem(index, 1)}
                        disabled={index === sortedMenuItems.length - 1}
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-400"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {item.submenu ? (
                      <>
                        <button
                          onClick={() => !reorderMode && toggleSubmenu(item.title)}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                            "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                          )}
                          title={sidebarCollapsed ? item.title : ''}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {!sidebarCollapsed && <span className="truncate">{item.title}</span>}
                          </div>
                          {!sidebarCollapsed && !reorderMode && (
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform flex-shrink-0",
                              expandedMenus.includes(item.title) && "rotate-180"
                            )} />
                          )}
                        </button>
                        {expandedMenus.includes(item.title) && !sidebarCollapsed && !reorderMode && (
                          <div className="ml-4 mt-1 space-y-1 border-l-2 pl-4 border-slate-200 dark:border-slate-700">
                            {item.submenu.map((subitem) => (
                              <Link
                                key={subitem.page}
                                to={createPageUrl(subitem.page)}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all font-medium",
                                  currentPageName === subitem.page
                                    ? "font-semibold"
                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white"
                                )}
                                style={currentPageName === subitem.page ? { backgroundColor: `${colorScheme.primary}18`, color: colorScheme.primary } : {}}
                              >
                                <subitem.icon className="h-4 w-4" />
                                {subitem.title}
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        to={createPageUrl(item.page)}
                        onClick={() => setSidebarOpen(false)}
                        title={sidebarCollapsed ? item.title : ''}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                          currentPageName === item.page
                            ? "text-white shadow-lg"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                        )}
                        style={currentPageName === item.page ? { backgroundColor: colorScheme.primary } : {}}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!sidebarCollapsed && <span className="truncate">{item.title}</span>}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* Collapse Button */}
          <div className="hidden lg:block px-4 py-2 border-t border-slate-100 dark:border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full dark:hover:bg-slate-800 dark:text-slate-300"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
              {!sidebarCollapsed && 'Recolher'}
            </Button>
          </div>

          {/* User Section */}
          {user && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-700">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.primary}cc)` }}>
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    {!sidebarCollapsed && (
                      <>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{user.full_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{getPermissionLabel(user.permissao_financeiro)}</p>
                        </div>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl('Settings')} className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configurações
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-16 lg:pt-0 min-h-screen transition-all duration-300 text-slate-900 dark:text-slate-100 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}