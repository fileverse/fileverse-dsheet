import { Button, DynamicModal } from '@fileverse/ui';
import { useEffect, useState } from 'react';
import { useMediaQuery } from 'usehooks-ts';
import { SMART_CONTRACT_PANEL_ID } from '../../utils/smart-contract/constants';

const hasScQueryParam = () => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('sc');
};

const removeScQueryParam = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('sc');
  window.history.replaceState({}, '', url.toString());
};

export const SmartContractReadingIntro = ({
  isAuthorized,
  onOpenPanel,
}: {
  isAuthorized: boolean;
  onOpenPanel: (panelId: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(hasScQueryParam());

  useEffect(() => {
    setIsOpen(hasScQueryParam());
  }, []);

  const tryItOut = () => {
    setIsOpen(false);
    if (isAuthorized) {
      onOpenPanel(SMART_CONTRACT_PANEL_ID);
      removeScQueryParam();
    } else {
      document.getElementById('triggerAuth')?.click();
    }
  };

  const isMobile = useMediaQuery('(max-width: 1024px)', {
    defaultValue: true,
  });

  return (
    <DynamicModal
      hasCloseIcon={true}
      open={isOpen}
      onOpenChange={(val) => {
        setIsOpen(val);
        if (!val) {
          removeScQueryParam();
        }
      }}
      className={`rounded-lg ${isMobile ? ' !w-full' : '!max-w-[394px]'}`}
      contentClassName="rounded-lg"
      content={
        <div>
          <div className="h-[296px] flex justify-center p-5 items-center bg-[#e8ebec] ">
            <video
              autoPlay={true}
              muted={true}
              playsInline={true}
              loop={true}
              src="https://s3.eu-west-2.amazonaws.com/assets.fileverse.io/dapp/public/assets/Area_V2.mp4"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="px-5 pt-5 pb-2">
            <h1 className="text-heading-xlg">Query smart contracts in cells</h1>
            <p className="text-body-sm mt-3 color-text-secondary">
              Turn smart contracts into real-time dashboards! You can add any
              smart contract across chains, give it a name, and query its public
              functions instantly using =SMARTCONTRACT(&quot;name&quot;,
              &quot;function&quot;, inputs…).
            </p>
            <div className="flex justify-end mt-4">
              <Button className="!max-w-[89px]" onClick={tryItOut}>
                <p>Try it out</p>
              </Button>
            </div>
          </div>
        </div>
      }
    />
  );
};
