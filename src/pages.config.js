import Dashboard from './pages/Dashboard';
import Lines from './pages/Lines';
import Machine from './pages/Machine';
import Admin from './pages/Admin';
import AdminLines from './pages/AdminLines';
import Users from './pages/Users';
import IssueApproval from './pages/IssueApproval';
import Setup from './pages/Setup';
import AdminMachines from './pages/AdminMachines';
import AdminControlPoints from './pages/AdminControlPoints';
import AdminCompanies from './pages/AdminCompanies';
import ControlPoint from './pages/ControlPoint';
import About from './pages/About';
import ApiDocumentation from './pages/ApiDocumentation';
import AuditLog from './pages/AuditLog';
import UserMonitoring from './pages/UserMonitoring';
import LineDetail from './pages/LineDetail';
import AdminLineChecks from './pages/AdminLineChecks';
import AdminVibrations from './pages/AdminVibrations';
import Settings from './pages/Settings';
import AdminThermo from './pages/AdminThermo';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Lines": Lines,
    "Machine": Machine,
    "Admin": Admin,
    "AdminLines": AdminLines,
    "Users": Users,
    "IssueApproval": IssueApproval,
    "Setup": Setup,
    "AdminMachines": AdminMachines,
    "AdminControlPoints": AdminControlPoints,
    "AdminCompanies": AdminCompanies,
    "ControlPoint": ControlPoint,
    "About": About,
    "ApiDocumentation": ApiDocumentation,
    "AuditLog": AuditLog,
    "UserMonitoring": UserMonitoring,
    "LineDetail": LineDetail,
    "AdminLineChecks": AdminLineChecks,
    "AdminVibrations": AdminVibrations,
    "Settings": Settings,
    "AdminThermo": AdminThermo,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};