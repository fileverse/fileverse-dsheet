import { SidebarPortalSlot } from '../sidebar/sidebar-portal-registry';

const ConditionalFormat = () => {
  return (
    <SidebarPortalSlot
      panelId="conditional-format"
      className="h-[calc(100vh-200px)] overflow-y-auto no-scrollbar"
      style={{ padding: '16px' }}
    />
  );
};

export { ConditionalFormat };
