import React, { useEffect, useState } from 'react';
import { FormDataChange } from '../components/minauth-prover-component';
import MinAuthProverComponent from '@/components/minauth-prover-component';
import { ILogObj, Logger } from 'tslog';
import DropdownComponent from '@/components/dropdown';
import JsonTextarea from '@/components/json-text-area';
import { MinAuthProof } from 'minauth/dist/common/proof';
import { AuthResponse, parseAuthResponse } from '@/helpers/jwt';
import { requestProtectedResource } from '@/api/resource';

type ProverFormUpdater = 'Prover' | 'TexdEdit';

const MinAuthDemo: React.FC = () => {
  const [logger, setLogger] = useState<Logger<ILogObj> | undefined>(undefined);
  const [proverFormData, setProverFormData] = useState<FormDataChange>();
  const [authenticationData, setAuthenticationData] =
    useState<AuthResponse | null>(null);
  const [submissionData, setSubmissionData] = useState<MinAuthProof | null>(
    null
  );

  const [resourceResponse, setResourceResponse] = useState<unknown | null>(
    null
  );

  const handleSubmissionDataChange = (
    newSubmissionData: MinAuthProof | null
  ) => {
    setSubmissionData(newSubmissionData);
  };

  const handleFormDataChange = (
    newFormData: FormDataChange,
    source: ProverFormUpdater
  ) => {
    if (source === 'Prover') {
      setProverFormData(newFormData);
    }
  };

  useEffect(() => {
    setLogger(
      new Logger({
        name: 'minauth-demo-component',
        stylePrettyLogs: false
      })
    );
  }, []);

  const handleRequestedResource = (res: unknown) => {
    setResourceResponse(res);
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gray-800 text-white p-5 my-8 mx-auto">
      <Header />
      <div className="flex flex-col w-full max-w-4xl mt-5 mx-auto">
        {/* First column */}
        <div className="flex flex-col w-1/2" style={{ maxWidth: '50%' }}>
          <DropdownComponent
            fetchUrl="http://127.0.0.1:3000/plugins/activePlugins"
            onSelectedOptionChange={() => {}}
          />
          <MinAuthProverComponent
            onFormDataChange={(s) => handleFormDataChange(s, 'Prover')}
            onSubmissionDataChange={handleSubmissionDataChange}
            onAuthenticationResponse={(response) => {
              setAuthenticationData(parseAuthResponse(response));
            }}
            logger={logger}
          />
          <JsonTextarea json={JSON.stringify(proverFormData, null, 2)} />
          <JsonTextarea json={JSON.stringify(submissionData, null, 2)} />
        </div>

        {/* Second column */}
        <div className="flex flex-col w-1/2" style={{ maxWidth: '50%' }}>
          <div className="flex justify-between space-x-4">
            <AuthenticationStatus authenticationData={authenticationData} />
            <div className="flex flex-col space-y-4">
              <RequestResourceButton
                auth={authenticationData}
                onResponse={handleRequestedResource}
              />
              <RevokeProofButton />
            </div>
          </div>
          <ResponseSummary protectedResourceResponse={resourceResponse} />
        </div>
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

const AuthenticationStatus = (props: { authenticationData: unknown }) => {
  return (
    <div className="authentication-status">
      <JsonTextarea
        json={JSON.stringify(props.authenticationData, null, 2)}
        readOnly={true}
      />
    </div>
  );
};

const RequestResourceButton = (props: {
  auth: AuthResponse | null;
  onResponse: (res: unknown) => void;
}) => {
  const request = async () => {
    if (props.auth === null) {
      return;
    }
    const res = requestProtectedResource(props.auth);
    props.onResponse(res);
  };
  return (
    <button
      className="resource-request-btn"
      onClick={request}
      disabled={props.auth === null}
    >
      Request Protected Resource
    </button>
  );
};

const ResponseSummary = (props: { protectedResourceResponse: unknown }) => {
  return (
    <div className="response-summary">
      <JsonTextarea
        readOnly={true}
        json={JSON.stringify(props.protectedResourceResponse, null, 2)}
      />
    </div>
  );
};

const RevokeProofButton = () => {
  return (
    <button className="revoke-proof-btn">Revoke Proof Verification</button>
  );
};

export default MinAuthDemo;
