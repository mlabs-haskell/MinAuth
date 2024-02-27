// Import statements
import PluginServerProxyHost from './PluginServerProxyHost'; // Adjust the import path according to your project structure
import * as requestModule from '../../common/request'; // Adjust the import path
import { Logger } from '../../plugin/logger'; // Adjust the import path
import { PMap } from '../pluginhost';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import * as TE from 'fp-ts/lib/TaskEither';
import * as E from 'fp-ts/lib/Either';
import { Either } from 'fp-ts/lib/Either';
import {
  OutputValidity,
  outputInvalid,
  outputValid
} from '../plugin-promise-api';

// Mock the request module
jest.mock('../../common/request', () => ({
  mkRequestTE: jest.fn()
}));

describe('PluginServerProxyHost', () => {
  let pluginServerProxyHost: PluginServerProxyHost;
  const mockLogger: Logger = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  } as unknown as Logger;
  const serverUrl = 'http://mock-server-url.com';

  beforeEach(() => {
    pluginServerProxyHost = new PluginServerProxyHost({
      serverUrl,
      log: mockLogger
    });
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  /**
   * A test helper function to test verifyProofAndGetOutput with various inputs and expected results.
   * @param inputs The inputs to the verifyProofAndGetOutput function.
   * @param expected A function that returns the expected TaskEither result.
   */
  const verifyProofAndGetOutputHelper = async (
    inputs: PMap<unknown>,
    expected: TaskEither<string, PMap<Either<string, unknown>>>
  ) => {
    // Mock the request module's mkRequestTE function
    (requestModule.mkRequestTE as jest.Mock).mockImplementation(
      (endpoint, schema, { body }) => {
        if (
          body &&
          body.hasOwnProperty('input') &&
          body.hasOwnProperty('plugin') &&
          body.input.includes('bad')
        ) {
          return TE.left({ message: body.input });
        } else {
          return TE.right({ data: { body } });
        }
      }
    );

    const result =
      await pluginServerProxyHost.verifyProofAndGetOutput(inputs)();

    // Call the expected function to get the expected TaskEither result
    const expectedResults = await expected();

    // Use Jest's expect for assertions
    expect(result).toEqual(expectedResults);

    // Verify mkRequestTE was called with correct arguments for each plugin
    Object.entries(inputs).forEach(([plugin, input]) => {
      expect(requestModule.mkRequestTE).toHaveBeenCalledWith(
        '/verifyProof',
        expect.anything(),
        { body: { plugin, input } }
      );
    });
  };

  const checkoutputValidityHelper = async (
    outputs: PMap<unknown>,
    expected: TaskEither<string, PMap<OutputValidity>>
  ) => {
    // Mock the request module's mkRequestTE function
    (requestModule.mkRequestTE as jest.Mock).mockImplementation(
      (endpoint, schema, { body }) => {
        if (
          body &&
          body.hasOwnProperty('output') &&
          body.hasOwnProperty('pluginName') &&
          body.output.includes('bad')
        ) {
          return TE.left({ message: body.output });
        } else {
          return TE.right({ data: { body } });
        }
      }
    );

    const result = await pluginServerProxyHost.checkOutputValidity(outputs)();

    // Call the expected function to get the expected TaskEither result
    const expectedResults = await expected();

    // Use Jest's expect for assertions
    expect(result).toEqual(expectedResults);

    // Verify mkRequestTE was called with correct arguments for each plugin
    Object.entries(outputs).forEach(([pluginName, output]) => {
      expect(requestModule.mkRequestTE).toHaveBeenCalledWith(
        '/validateOutput',
        expect.anything(),
        { body: { pluginName, output } }
      );
    });
  };

  describe('verifyProofAndGetOutput', () => {
    // Setup before each test case
    beforeEach(() => {
      jest.clearAllMocks(); // Clear previous mocks
    });

    it('should call mkRequestTE with correct arguments for each plugin and aggregate results correctly', async () => {
      const testData = [
        {
          inputs: {
            plugin1: 'input1'
          },

          expected: TE.right({
            plugin1: E.right({ body: { input: 'input1', plugin: 'plugin1' } })
          })
        },
        {
          inputs: {
            plugin1: 'bad input'
          },

          expected: TE.right({
            plugin1: E.left('bad input')
          })
        },
        {
          inputs: {
            plugin1: 'input1',
            plugin2: 'input2'
          },
          expected: TE.right({
            plugin1: E.right({ body: { input: 'input1', plugin: 'plugin1' } }),
            plugin2: E.right({ body: { input: 'input2', plugin: 'plugin2' } })
          })
        },
        {
          inputs: {
            plugin1: 'input1',
            plugin2: 'input2',
            plugin3: 'bad input'
          },
          expected: TE.right({
            plugin1: E.right({ body: { input: 'input1', plugin: 'plugin1' } }),
            plugin2: E.right({ body: { input: 'input2', plugin: 'plugin2' } }),
            plugin3: E.left('bad input')
          })
        }
      ];

      // Call the helper function for each test data
      for (const { inputs, expected } of testData) {
        await verifyProofAndGetOutputHelper(inputs, expected);
      }
    });
  });

  describe('checkOutputValidity', () => {
    // Setup before each test case
    beforeEach(() => {
      jest.clearAllMocks(); // Clear previous mocks
    });

    it('should call mkRequestTE with correct arguments for each plugin and aggregate results correctly', async () => {
      const testData = [
        {
          outputs: {
            plugin1: 'output1'
          },
          expected: TE.right({
            plugin1: outputValid
          })
        },
        {
          outputs: {
            plugin1: 'bad output'
          },
          expected: TE.right({
            plugin1: outputInvalid('bad output')
          })
        },
        {
          outputs: {
            plugin1: 'output1',
            plugin2: 'output2'
          },
          expected: TE.right({
            plugin1: outputValid,
            plugin2: outputValid
          })
        },
        {
          outputs: {
            plugin1: 'output1',
            plugin2: 'output2',
            plugin3: 'bad output'
          },
          expected: TE.right({
            plugin1: outputValid,
            plugin2: outputValid,
            plugin3: outputInvalid('bad output')
          })
        }
      ];

      // Call the helper function for each test data
      for (const { outputs, expected } of testData) {
        await checkoutputValidityHelper(outputs, expected);
      }
    });
  });
});
