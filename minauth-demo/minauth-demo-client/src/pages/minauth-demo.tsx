import React, { useEffect, useState } from 'react';
import MinAuthProverComponent from './minauth-prover-component';
import { ILogObj, Logger } from 'tslog';
import DropdownComponent from '@/components/dropdown';

const MinAuthDemo: React.FC = () => {
  const [logger, setLogger] = useState<Logger<ILogObj> | undefined>(undefined);

  useEffect(() => {
    setLogger(
      new Logger({
        name: 'minauth-demo-component'
      })
    );
  }, []);

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gray-800 text-white p-5">
      <Header />
      <div className="flex flex-col w-full max-w-4xl mt-5">
        <DropdownComponent
          fetchUrl="http://127.0.0.1:3000/plugins/activePlugins"
          onSelectedOptionChange={() => {}}
        />
        <MinAuthProverComponent logger={logger} />
        <div className="flex justify-between space-x-4">
          <AuthenticationStatus />
          <div className="flex flex-col space-y-4">
            <RequestResourceButton />
            <RevokeProofButton />
          </div>
        </div>
        <ResponseSummary />
      </div>
      {/* Tooltips and additional descriptions would be integrated within the components */}
    </div>
  );
};

const Header = () => {
  return (
    <header>
      <h1>MINAUTH DEMO</h1>
    </header>
  );
};

const AuthenticationStatus = () => {
  return (
    <div className="authentication-status">
      {/* Display tokens and status here */}
    </div>
  );
};

const RequestResourceButton = () => {
  return (
    <button className="resource-request-btn">Request Protected Resource</button>
  );
};

const ResponseSummary = () => {
  return (
    <div className="response-summary">
      {/* Display the response summary here */}
    </div>
  );
};

const RevokeProofButton = () => {
  return (
    <button className="revoke-proof-btn">Revoke Proof Verification</button>
  );
};

export default MinAuthDemo;
