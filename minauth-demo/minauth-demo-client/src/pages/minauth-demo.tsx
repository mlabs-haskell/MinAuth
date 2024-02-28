import React, { ReactNode, useEffect, useState } from 'react';
import SimplePreimageProverComponent, {
  FormDataChange
} from '../components/simple-preimage-prover';
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
import { z } from 'zod';
import Erc721TimelockProverComponent, {
  Erc721TimelockAdminComponent
} from '@/components/nft-timelock-prover';
import Erc721TimelockProver from 'minauth-erc721-timelock-plugin/dist/prover';
import ReactMarkdown from 'react-markdown';
import { ServerConfig } from '@/api/server-config';
import Overlay from '@/components/overlay';
import { ApiResponse } from 'minauth/dist/common/request';

type ProverFormUpdater = 'Prover' | 'TexdEdit';

const MinAuthDemo: React.FC = () => {
  const logger = new Logger<ILogObj>({
    name: 'minauth-demo-component',
    stylePrettyLogs: false
  });

  const [proverCompiling, setProverCompiling] = useState<boolean>(false);
  const [selectedPlugin, setSelectedPlugin] = useState<string>('');
  const [proverFormData, setProverFormData] = useState<FormDataChange>();

  const [authenticationData, setAuthenticationData] =
    useState<AuthResponse | null>(null);
  const [submissionData, setSubmissionData] = useState<MinAuthProof | null>(
    null
  );
  const [resourceResponse, setResourceResponse] = useState<
    ApiResponse<z.ZodTypeAny> | string
  >('No auth data');

  const [prover, setProver] = useState<Erc721TimelockProver | null>(null);

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

  const handleRequestedResource = (res: ApiResponse<z.ZodUnknown> | string) => {
    setResourceResponse(res);
  };

  const demoDescription = () => {
    return (
      <Pane
        title="MinAuth Library Demo"
        description="This is a simple demonstration on how to work with MinAuth plugins client-side (prover-side). To make it work you have to have a MinAuth-enabled server running at "
      ></Pane>
    );
  };

  const simplePreimageComponent = (name: string) => {
    return (
      <div>
        <Pane
          title="Plugin configuration / Admin"
          hasDivider={true}
          description="Below is the demonstrational client-facing configuration for the selected plugin."
        >
          <SimplePreimageAdminConfigComponent
            logger={logger?.getSubLogger({
              name: 'SimplePreimageAdminConfigComponent'
            })}
          />
        </Pane>
        <Pane
          title="MinAuth Plugin Interaction"
          hasDivider={true}
          description="Below is the interaction form generated or specified by the selected plugin."
        >
          <div className="text-black">
            <SimplePreimageProverComponent
              pluginName={name}
              onFormDataChange={(s) => handleFormDataChange(s, 'Prover')}
              onSubmissionDataChange={handleSubmissionDataChange}
              onAuthenticationResponse={(response) => {
                setAuthenticationData(response);
              }}
              logger={logger}
              setProverCompiling={setProverCompiling}
            />
          </div>
        </Pane>
      </div>
    );
  };

  const merkleMembershipComponent = (name: string) => {
    return (
      <div>
        <strong>Plugin {name} disabled due to a bug</strong>
        {/* <MembershipsProverComponent
          pluginName={name}
          onFormDataChange={(s) => handleFormDataChange(s, 'Prover')}
          onSubmissionDataChange={handleSubmissionDataChange}
          onAuthenticationResponse={(response) => {
            setAuthenticationData(response);
          }}
          logger={logger}
        /> */}
      </div>
    );
  };

  const erc721TimelockComponent = (name: string) => {
    return (
      <div>
        <Pane title="Plugin configuration / Admin" hasDivider={true}>
          <Erc721TimelockAdminComponent
            prover={prover}
            logger={logger?.getSubLogger({
              name: 'Erc721TimelockAdminComponent'
            })}
          />
        </Pane>

        <Pane
          title="MinAuth Plugin Interaction"
          hasDivider={true}
          description="Below is the interaction form generated or specified by the selected plugin."
        >
          <div className="text-black">
            <Erc721TimelockProverComponent
              setProverCompiling={setProverCompiling}
              pluginName={name}
              updateProver={setProver}
              onFormDataChange={(s) => handleFormDataChange(s, 'Prover')}
              onSubmissionDataChange={handleSubmissionDataChange}
              onAuthenticationResponse={(response) => {
                setAuthenticationData(response);
              }}
              logger={logger}
            />
          </div>
        </Pane>
      </div>
    );
  };

  const selectedPluginComponent = () => {
    switch (selectedPlugin) {
      case 'simple-preimage':
        return simplePreimageComponent('simple-preimage');
      case 'erc721-timelock':
        return erc721TimelockComponent('erc721-timelock');
      case 'merkle-memberships':
        return merkleMembershipComponent('merkle-memberships');
      default:
        return <div> No plugin selected </div>;
    }
  };

  const fetchUrl = `${ServerConfig.url}/plugins/activePlugins`;

  return (
    <div className="items-center w-full min-h-screen text-white p-5 my-8 mx-auto">
      <Header />
      <Overlay isShown={proverCompiling} />
      <div>{demoDescription()}</div>
      <div className="flex flex-col w-full max-w-4xl mt-5 mx-auto">
        {/* Columns Container */}
        <div className="flex space-x-4">
          {/* First Column - plugin specific */}
          <div className="w-1/2 max-w-1/2">
            <Pane
              title="Select a plugin"
              hasDivider={true}
              description="Below you should find a list of plugins activated by server configuration."
            >
              <DropdownComponent
                fetchUrl={fetchUrl}
                onSelectedOptionChange={setSelectedPlugin}
              />
            </Pane>
            {selectedPluginComponent()}

            {/* Labels and json text areas to show information */}
          </div>

          {/* Second Column */}
          <div className="w-1/2 max-w-1/2">
            <div className="flex flex-col space-y-4">
              <Pane
                title="Prover Form Data"
                hasDivider={true}
                description="The results of parsing data coming from the selected prover's form"
              >
                <JsonTextarea json={JSON.stringify(proverFormData, null, 2)} />
              </Pane>
              <Pane
                title="Submission Data"
                hasDivider={true}
                description="All the data submitted to the server to get the authorization."
              >
                <JsonTextarea json={JSON.stringify(submissionData, null, 2)} />
              </Pane>
            </div>
            <Pane
              title="Authentication Data"
              hasDivider={true}
              description="The server response for the authentication request"
            >
              <AuthenticationStatus authenticationData={authenticationData} />
              <RefreshAuthButton
                auth={authenticationData}
                onResponse={setAuthenticationData}
              />
            </Pane>
            <Pane title="Request Protected Resource">
              <ResponseSummary protectedResourceResponse={resourceResponse} />
              <RequestResourceButton
                auth={authenticationData}
                onResponse={handleRequestedResource}
              />
            </Pane>
          </div>
        </div>
        {/* Tooltips and additional descriptions would be integrated within the components */}
      </div>
    </div>
  );
};
const Header = () => {
  return (
    <header className="flex justify-between items-center bg-gray-800 bg-opacity-60 m-2 mt-7 border rounded-md p-5">
      <div>
        <h1 className="text-xl font-bold">
          MinAuth - zero-knowledge authentication demo
        </h1>
        <p>
          <a
            href="https://github.com/mlabs-haskell/MinAuth"
            className="text-blue-400 hover:text-blue-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://github.com/mlabs-haskell/MinAuth
          </a>
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm">powered by</p>
        <p>
          <a
            href="https://github.com/o1-labs/o1js"
            className="text-blue-400 hover:text-blue-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            o1js
          </a>
        </p>
      </div>
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
      className="border hover:border-2 hover:font-semibold border-green-300 text-green-300 rounded-md ml-2 p-1"
      onClick={request}
      disabled={props.auth === null}
    >
      Refresh authentication
    </button>
  );
};

const RequestResourceButton = (props: {
  auth: AuthResponse | null;
  onResponse: (res: ApiResponse<z.ZodUnknown> | string) => void;
  log?: Logger<ILogObj>;
}) => {
  const request = async () => {
    if (props.auth === null) {
      props.log?.debug('Cancelling request, no auth data');
      props.onResponse('No auth data');
      return;
    }
    const authData = parseAuthData(props.auth);
    if (!authData) {
      props.log?.debug('Cancelling request, invalid auth data');
      props.onResponse('Invalid auth data');
      return;
    }
    props.log?.debug('Requesting protected resource');
    const res = await requestProtectedResource(authData);
    props.onResponse(res);
  };
  return (
    <button
      className="border hover:border-2 hover:font-semibold border-indigo-200 text-indigo-200 rounded-md ml-2 p-1 resource-request-btn"
      onClick={request}
    >
      Request Protected Resource
    </button>
  );
};

const ResponseSummary = (props: {
  protectedResourceResponse: ApiResponse<z.ZodUnknown> | string;
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
    <div className="simple-preimage-admin mt-4">
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
      <button
        className="border hover:border-2 hover:font-semibold border-green-400 text-green-400 rounded-md ml-2 p-1"
        onClick={refresh}
      >
        {' '}
        Refresh{' '}
      </button>
      <button
        onClick={setRoles}
        disabled={textAreaReadRoles() === null}
        className="border hover:border-2 hover:font-semibold border-yellow-400 text-yellow-400 rounded-md ml-2 p-1"
      >
        {' '}
        Set Roles{' '}
      </button>
    </div>
  );
};

interface PaneProps {
  title: string;
  hasDivider?: boolean;
  children?: ReactNode;
  description?: string; // Markdown description
}
const Pane: React.FC<PaneProps> = ({
  title,
  hasDivider = false,
  children,
  description
}) => {
  const divider = hasDivider ? 'mt-4 border-t pt-5' : 'mt-4 pt-1';
  return (
    <div className="bg-gray-800 bg-opacity-30 m-2 mt-7 border rounded-md p-5">
      <h2 className="font-bold lg:text-8x1">{title}</h2>
      <div className={divider}>
        {description && (
          <div className="markdown sm:text-xs px-5 pb-3">
            <ReactMarkdown>{description}</ReactMarkdown>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

/* const RevokeProofButton = () => {
 *   return (
 *     <button className="revoke-proof-btn">Revoke Proof Verification</button>
 *   );
 * }; */

export default MinAuthDemo;
