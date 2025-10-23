import Dashboard from './pages/Dashboard';
import Lines from './pages/Lines';
import Machine from './pages/Machine';
import Admin from './pages/Admin';
import AdminLines from './pages/AdminLines';
import Users from './pages/Users';
import IssueApproval from './pages/IssueApproval';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Lines": Lines,
    "Machine": Machine,
    "Admin": Admin,
    "AdminLines": AdminLines,
    "Users": Users,
    "IssueApproval": IssueApproval,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};