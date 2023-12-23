import React, { useEffect, useState } from 'react';
import { FormDataChange } from '../components/minauth-prover-component';
import MinAuthProverComponent from '@/components/minauth-prover-component';
import { ILogObj, Logger } from 'tslog';
import DropdownComponent from '@/components/dropdown';
import JsonTextarea from '@/components/json-text-area';
import { MinAuthProof } from 'minauth/dist/common/proof';
import { AuthResponse, parseAuthData, refreshAuth } from '@/helpers/jwt';
import { requestProtectedResource } from '@/api/resource';
import {
  SimplePreimageRolesResponse,
  SimplePreimageRolesSchema,
  simplePreimageGetRoles,
  simplePreimageSetRoles
} from '@/helpers/demo-admin';
import { ApiResponse } from '@/helpers/request';
import { z } from 'zod';

type ProverFormUpdater = 'Prover' | 'TexdEdit';

const MinAuthDemo: React.FC = () => {
  const logger = new Logger<ILogObj>({
    name: 'minauth-demo-component',
    stylePrettyLogs: false
  });
  const [proverFormData, setProverFormData] = useState<FormDataChange>();
  const [authenticationData, setAuthenticationData] =
    useState<AuthResponse | null>(null);
  const [submissionData, setSubmissionData] = useState<MinAuthProof | null>(
    null
  );

  const [resourceResponse, setResourceResponse] =
    useState<ApiResponse<z.ZodTypeAny> | null>(null);

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

  const handleRequestedResource = (res: ApiResponse<z.ZodUnknown>) => {
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
          <SimplePreimageAdminConfigComponent
            logger={logger?.getSubLogger({
              name: 'SimplePreimageAdminConfigComponent'
            })}
          />
          <MinAuthProverComponent
            onFormDataChange={(s) => handleFormDataChange(s, 'Prover')}
            onSubmissionDataChange={handleSubmissionDataChange}
            onAuthenticationResponse={(response) => {
              setAuthenticationData(response);
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
              <RefreshAuthButton
                auth={authenticationData}
                onResponse={setAuthenticationData}
              />
              {/* <RevokeProofButton /> */}
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

const RefreshAuthButton = (props: {
  auth: AuthResponse | null;
  onResponse: (res: AuthResponse) => void;
}) => {
  const request = async () => {
    if (props.auth === null) {
      return;
    }
    const authData = parseAuthData(props.auth);
    if (!authData) return;
    const res = await refreshAuth(authData);
    props.onResponse(res);
  };
  return (
    <button
      className="resource-request-btn"
      onClick={request}
      disabled={props.auth === null}
    >
      Refresh authentication
    </button>
  );
};

const RequestResourceButton = (props: {
  auth: AuthResponse | null;
  onResponse: (res: ApiResponse<z.ZodUnknown>) => void;
}) => {
  const request = async () => {
    if (props.auth === null) {
      return;
    }
    const authData = parseAuthData(props.auth);
    if (!authData) return;
    const res = await requestProtectedResource(authData);
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

const ResponseSummary = (props: {
  protectedResourceResponse: ApiResponse<z.ZodUnknown> | null;
}) => {
  return (
    <div className="response-summary">
      <JsonTextarea
        readOnly={true}
        json={JSON.stringify(props.protectedResourceResponse, null, 2)}
      />
    </div>
  );
};

/**
 * Get, set, and display the roles for the SimplePreimage plugin.
 */
const SimplePreimageAdminConfigComponent = (props: {
  logger: Logger<ILogObj>;
}) => {
  const [simplePreimageRoles, setSimplePreimageRoles] =
    useState<SimplePreimageRolesResponse | null>(null);

  const [counter, setCounter] = useState<number>(0);

  const [textAreaText, setTextAreaText] = useState<string>('');

  // roles as read from the server response
  const serverReadRoles = (resp: SimplePreimageRolesResponse | null) => {
    if (resp === null) return {};
    return resp.type === 'ok' ? resp.data : resp.server_response;
  };

  const textAreaReadRoles = () => {
    try {
      const parseRes = SimplePreimageRolesSchema.safeParse(
        JSON.parse(textAreaText)
      );
      return parseRes.success ? parseRes.data : null;
    } catch (e: unknown) {
      props.logger.error(e);
      return null;
    }
  };

  const setRoles = async () => {
    const roles = textAreaReadRoles();
    if (roles === null) return;
    const resp = await simplePreimageSetRoles(roles);
    if (resp.type !== 'ok') {
      props.logger.error(
        'Server responded with errors on setRoles requests',
        resp
      );
    } else {
      props.logger.info('New roles set.');
      await refresh();
    }
  };

  const refresh = async () => {
    props.logger.debug('Refreshing SimplePreimageRoles');
    const resp = await simplePreimageGetRoles();
    setSimplePreimageRoles(resp);
    setCounter(counter + 1);
    props.logger.info('SimplePreimageRoles response received', resp);
  };

  useEffect(() => {
    props.logger.info('Initialize SimplePreimageRoles');
    refresh();
  }, []); // ignore the warning, this is intentional

  return (
    <div className="simple-preimage-admin">
      <label htmlFor="simple-preimage-config-textarea">
        {' '}
        Simple Preimage Demo Admin Config
      </label>
      <JsonTextarea
        id="simple-preimage-config-textarea"
        json={JSON.stringify(serverReadRoles(simplePreimageRoles), null, 2)}
        onJsonChange={setTextAreaText}
        refreshCounter={counter}
      />
      <button onClick={refresh}> Refresh </button>
      <button onClick={setRoles} disabled={textAreaReadRoles() === null}>
        {' '}
        Set Roles{' '}
      </button>
    </div>
  );
};

/* const RevokeProofButton = () => {
 *   return (
 *     <button className="revoke-proof-btn">Revoke Proof Verification</button>
 *   );
 * }; */

export default MinAuthDemo;
