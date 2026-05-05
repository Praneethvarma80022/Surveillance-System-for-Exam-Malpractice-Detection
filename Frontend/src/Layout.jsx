import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Shield, BookOpen, User, LayoutDashboard, LogOut, X, Menu, Users, Edit3 } from "lucide-react";
import { IconButton } from "@/components/ui";
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const role = localStorage.getItem('proctorguard_role');
  const isAdmin = role === 'admin';
  const [examLocked, setExamLocked] = useState(
    localStorage.getItem('proctorguard_exam_lock') === 'true'
  );
  const isExamRoute = location.pathname === "/Exam";

  const navItems = isAdmin 
    ? [
        { name: "Admin Home", path: "/AdminDashboard", icon: LayoutDashboard },
        { name: "Monitoring", path: "/AdminMonitoring", icon: Shield },
        { name: "Manage Students", path: "/AdminStudents", icon: Users, subtitle: "Verify identities, update statuses" },
        { name: "Create Exams", path: "/AdminExams", icon: Edit3, subtitle: "Configure timing, rules, settings" },
        { name: "Reports", path: "/AdminReports", icon: BookOpen },
      ]
    : [
        { name: "Student Home", path: "/Dashboard", icon: LayoutDashboard },
        { name: "My Profile", path: "/Profile", icon: User },
      ];

  const lockedNavItems = [
    { name: "Exam Status", detail: "In Progress", icon: Shield },
    { name: "Monitoring", detail: "Active", icon: BookOpen },
    { name: "Navigation", detail: "Locked", icon: X },
  ];

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/#/Verification";
  };

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const syncLockState = () => {
      setExamLocked(localStorage.getItem('proctorguard_exam_lock') === 'true');
    };
    window.addEventListener('storage', syncLockState);
    window.addEventListener('proctorguard_exam_lock', syncLockState);
    return () => {
      window.removeEventListener('storage', syncLockState);
      window.removeEventListener('proctorguard_exam_lock', syncLockState);
    };
  }, []);

  return (
    <div className={`layout-container ${examLocked ? 'layout-exam-locked' : ''}`}>
      {/* Top header for mobile and desktop */}
      {!isExamRoute && (
        <header className="layout-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30 }}>
          <div className="header-content">
            <div className="header-brand">
              <Shield className="header-brand-icon" />
              <span className="header-brand-text">ProctorGuard</span>
            </div>

            {!examLocked && (
              <nav className="header-nav">
                {navItems.map(item => (
                  <Link 
                    key={item.path} 
                    to={item.path} 
                    className={`header-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    <item.icon size={16} /> {item.name}
                  </Link>
                ))}
              </nav>
            )}

            <div className="header-actions">
              <button 
                onClick={() => setDrawerOpen(true)} 
                className="mobile-menu-button"
              >
                <Menu className="w-5 h-5" />
              </button>
              {!examLocked && (
                <button onClick={handleLogout} className="header-logout">
                  <LogOut size={16} /> Logout
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Mobile Drawer */}
      {drawerOpen && !examLocked && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
          <div 
            className="drawer-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column' }}
          >
            <div className="drawer-header">
              <div className="header-brand">
                <Shield className="header-brand-icon" />
                <span className="header-brand-text">ProctorGuard</span>
              </div>
              <IconButton onClick={() => setDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </IconButton>
            </div>
            <nav className="drawer-nav">
              {navItems.map(item => (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  onClick={() => setDrawerOpen(false)} 
                  className={`drawer-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  title={item.subtitle}
                >
                  <item.icon size={16} />
                  <div className="drawer-nav-content">
                    <span className="drawer-nav-name">{item.name}</span>
                    {item.subtitle && <span className="drawer-nav-subtitle">{item.subtitle}</span>}
                  </div>
                </Link>
              ))}
            </nav>
            <div className="drawer-footer">
              <button 
                onClick={() => { setDrawerOpen(false); handleLogout(); }} 
                className="drawer-logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="layout-main" style={{ marginTop: isExamRoute ? 0 : '56px' }}>
        {/* Sidebar for larger screens */}
        <aside className="layout-sidebar">
          <div className="sidebar-header">
            <Shield className="sidebar-icon" />
            <span className="sidebar-title">ProctorGuard</span>
            {examLocked && !isAdmin && (
              <span className="sidebar-lock-badge">Exam Lock</span>
            )}
          </div>
          
          {examLocked && !isAdmin ? (
            <div className="sidebar-locked">
              {lockedNavItems.map((item) => (
                <div key={item.name} className="sidebar-lock-item">
                  <item.icon size={18} />
                  <div>
                    <span className="sidebar-lock-name">{item.name}</span>
                    <span className="sidebar-lock-detail">{item.detail}</span>
                  </div>
                </div>
              ))}
              <div className="sidebar-lock-note">
                Navigation is disabled until the exam is submitted.
              </div>
            </div>
          ) : (
            <>
              <nav className="sidebar-nav">
                {navItems.map((item) => (
                  <Link 
                    key={item.path} 
                    to={item.path} 
                    className={`sidebar-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                    title={item.subtitle}
                  >
                    <item.icon size={18} />
                    <div className="sidebar-nav-content">
                      <span className="sidebar-nav-name">{item.name}</span>
                      {item.subtitle && <span className="sidebar-nav-subtitle">{item.subtitle}</span>}
                    </div>
                  </Link>
                ))}
              </nav>

              <div className="sidebar-footer">
                <button onClick={handleLogout} className="sidebar-logout">
                  <LogOut size={18} /> Logout
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="layout-content">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}