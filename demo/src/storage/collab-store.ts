export interface StoredCollabConfig {
  roomKey: string;
  roomId: string;
  wsUrl: string;
  isOwner: boolean;
  username: string;
  ownerEdSecret?: string;
  contractAddress?: string;
  ownerAddress?: string;
}

export const collabStore = {
  getCollabConf: (): StoredCollabConfig | null => {
    const raw = localStorage.getItem('dsheet-collabConfig');
    return raw ? JSON.parse(raw) : null;
  },
  setCollabConf: (config: StoredCollabConfig) => {
    localStorage.setItem('dsheet-collabConfig', JSON.stringify(config));
  },
  clearCollabConf: () => {
    localStorage.removeItem('dsheet-collabConfig');
  },
};
