import About from './pages/About';
import Admin from './pages/Admin';
import AdminCleanup from './pages/AdminCleanup';
import AdminCompanies from './pages/AdminCompanies';
import AdminControlPoints from './pages/AdminControlPoints';
import AdminExport from './pages/AdminExport';
import AdminLineChecks from './pages/AdminLineChecks';
import AdminMachines from './pages/AdminMachines';
import AdminThermo from './pages/AdminThermo';
import AdminVibrations from './pages/AdminVibrations';
import ApiDocumentation from './pages/ApiDocumentation';
import AuditLog from './pages/AuditLog';
import ControlPoint from './pages/ControlPoint';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import IssueApproval from './pages/IssueApproval';
import IssueDetail from './pages/IssueDetail';
import LineDetail from './pages/LineDetail';
import Lines from './pages/Lines';
import Machine from './pages/Machine';
import MobileHome from './pages/MobileHome';
import PendingApproval from './pages/PendingApproval';
import Settings from './pages/Settings';
import Setup from './pages/Setup';
import UserMonitoring from './pages/UserMonitoring';
import Users from './pages/Users';
import WorkOrders from './pages/WorkOrders';
import AdminLines from './pages/AdminLines';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "Admin": Admin,
    "AdminCleanup": AdminCleanup,
    "AdminCompanies": AdminCompanies,
    "AdminControlPoints": AdminControlPoints,
    "AdminExport": AdminExport,
    "AdminLineChecks": AdminLineChecks,
    "AdminMachines": AdminMachines,
    "AdminThermo": AdminThermo,
    "AdminVibrations": AdminVibrations,
    "ApiDocumentation": ApiDocumentation,
    "AuditLog": AuditLog,
    "ControlPoint": ControlPoint,
    "Dashboard": Dashboard,
    "Home": Home,
    "IssueApproval": IssueApproval,
    "IssueDetail": IssueDetail,
    "LineDetail": LineDetail,
    "Lines": Lines,
    "Machine": Machine,
    "MobileHome": MobileHome,
    "PendingApproval": PendingApproval,
    "Settings": Settings,
    "Setup": Setup,
    "UserMonitoring": UserMonitoring,
    "Users": Users,
    "WorkOrders": WorkOrders,
    "AdminLines": AdminLines,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};