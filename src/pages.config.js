import Dashboard from './pages/Dashboard';
import Lines from './pages/Lines';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Lines": Lines,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};