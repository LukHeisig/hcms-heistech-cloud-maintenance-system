/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import About from './pages/About';
import AdminBearings from './pages/AdminBearings';
import Admin from './pages/Admin';
import AdminCleanup from './pages/AdminCleanup';
import AdminCompanies from './pages/AdminCompanies';
import AdminControlPoints from './pages/AdminControlPoints';
import AdminExport from './pages/AdminExport';
import AdminLineChecks from './pages/AdminLineChecks';
import AdminLines from './pages/AdminLines';
import AdminMachines from './pages/AdminMachines';
import AdminThermo from './pages/AdminThermo';
import AdminVibrations from './pages/AdminVibrations';
import ApiDocumentation from './pages/ApiDocumentation';
import AuditLog from './pages/AuditLog';
import Changelog from './pages/Changelog';
import ControlPoint from './pages/ControlPoint';
import Dashboard from './pages/Dashboard';
import DebugLog from './pages/DebugLog';
import Home from './pages/Home';
import IssueApproval from './pages/IssueApproval';
import IssueDetail from './pages/IssueDetail';
import LineDetail from './pages/LineDetail';
import Lines from './pages/Lines';
import Machine from './pages/Machine';
import MobileHome from './pages/MobileHome';
import MqttSensors from './pages/MqttSensors';
import PendingApproval from './pages/PendingApproval';
import Settings from './pages/Settings';
import Setup from './pages/Setup';
import UserMonitoring from './pages/UserMonitoring';
import Users from './pages/Users';
import VibrationOnline from './pages/VibrationOnline';
import WorkOrders from './pages/WorkOrders';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "Admin": Admin,
    "AdminBearings": AdminBearings,
    "AdminCleanup": AdminCleanup,
    "AdminCompanies": AdminCompanies,
    "AdminControlPoints": AdminControlPoints,
    "AdminExport": AdminExport,
    "AdminLineChecks": AdminLineChecks,
    "AdminLines": AdminLines,
    "AdminMachines": AdminMachines,
    "AdminThermo": AdminThermo,
    "AdminVibrations": AdminVibrations,
    "ApiDocumentation": ApiDocumentation,
    "AuditLog": AuditLog,
    "Changelog": Changelog,
    "ControlPoint": ControlPoint,
    "Dashboard": Dashboard,
    "DebugLog": DebugLog,
    "Home": Home,
    "IssueApproval": IssueApproval,
    "IssueDetail": IssueDetail,
    "LineDetail": LineDetail,
    "Lines": Lines,
    "Machine": Machine,
    "MobileHome": MobileHome,
    "MqttSensors": MqttSensors,
    "PendingApproval": PendingApproval,
    "Settings": Settings,
    "Setup": Setup,
    "UserMonitoring": UserMonitoring,
    "Users": Users,
    "VibrationOnline": VibrationOnline,
    "WorkOrders": WorkOrders,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};