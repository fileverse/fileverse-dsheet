import { Button } from '@fileverse/ui';

export const RateLimitInfo = ({
  onInsertKey,
  name,
}: {
  onInsertKey: () => void;
  name: string;
}) => {
  const keyName = name.split('_API_KEY')[0];
  return (
    <div className="py-4 px-6">
      <p className="text-heading-xlg-bold">{keyName} API calls limit reached</p>
      <p className="mt-3 color-text-secondary text-body-sm">
        You are not able to get data from {keyName} datablock. Please add your
        own API key to keep getting data.
      </p>

      <p className="mt-3 color-text-secondary text-body-sm">
        You can increase API limits <a className="color-text-link">here</a>{' '}
      </p>

      <div className="flex justify-between mt-6 items-center">
        <div>
          <p className="text-body-sm-bold cursor-pointer">Send feedback</p>
        </div>

        <Button onClick={onInsertKey}>Insert API key</Button>
      </div>
    </div>
  );
};
