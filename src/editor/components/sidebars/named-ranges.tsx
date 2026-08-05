import { SidebarPortalSlot } from '../sidebar/sidebar-portal-registry';

const NamedRanges = () => {
  return (
    <SidebarPortalSlot
      panelId="named-ranges"
      className="h-[calc(100vh-200px)] overflow-y-auto no-scrollbar"
      style={{ padding: '16px' }}
    />
  );
};

export { NamedRanges };
