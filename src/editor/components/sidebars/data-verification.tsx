import { SidebarPortalSlot } from '../sidebar/sidebar-portal-registry';

const DataVerification = () => {
  return (
    <SidebarPortalSlot
      panelId="data-verification"
      className="h-[calc(100vh-200px)] overflow-y-auto no-scrollbar"
    />
  );
};

export { DataVerification };
