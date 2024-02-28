import { Router } from 'express';
import {
  FpInterfaceType,
  TsInterfaceType,
  fpInterfaceTag,
  tsInterfaceTag
} from './interfacekind';
import {
  IMinAuthPlugin,
  OutputValidity,
  outputInvalid,
  outputValid
} from './plugintype';
import { fromFailablePromise } from '../utils/fp/taskeither';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { Either } from 'fp-ts/lib/Either';
import * as E from 'fp-ts/lib/Either';

// boolean is the flag for whether the input should be verified / valid
type InputStore = Map<string, boolean>;

const verifyAndGetOutput = (input: string, inputs: InputStore): string => {
  if (!inputs.get(input)) {
    throw new Error('Invalid input; missing or `shouldVerify` is false');
  }
  return input;
};

const checkOutputValidity = (
  output: string,
  outputs: InputStore
): OutputValidity => {
  const val = outputs.get(output);
  if (!val) {
    return outputInvalid(
      'Invalid output: input missing or `shouldVerify` is false'
    );
  }
  return outputValid;
};

export class DummyPluginTs
  implements IMinAuthPlugin<TsInterfaceType, string, string>
{
  __interface_tag = tsInterfaceTag;

  constructor(public inputs: InputStore) {}

  verifyAndGetOutput(input: string): Promise<string> {
    return Promise.resolve(verifyAndGetOutput(input, this.inputs));
  }

  checkOutputValidity(output: string): Promise<OutputValidity> {
    return Promise.resolve(checkOutputValidity(output, this.inputs));
  }

  readonly customRoutes = Router().get('/leak', (req, res) => {
    const input = req.body;
    res.json({
      known: this.inputs.has(input),
      shouldVerify: this.inputs.get(input)
    });
  });

  readonly inputDecoder = {
    __interface_tag: tsInterfaceTag,
    decode: (input: unknown): string | undefined => {
      try {
        const inputStr = input as string;
        return inputStr;
      } catch (e) {
        return undefined;
      }
    }
  };

  readonly outputEncDec = {
    __interface_tag: tsInterfaceTag,
    encode: (output: string): unknown => {
      return output;
    },
    decode: this.inputDecoder.decode
  };
}

export class DummyPluginFp
  implements IMinAuthPlugin<FpInterfaceType, string, string>
{
  __interface_tag = fpInterfaceTag;

  constructor(public inputs: InputStore) {}

  verifyAndGetOutput(input: string): TaskEither<string, string> {
    return fromFailablePromise(() =>
      Promise.resolve(verifyAndGetOutput(input, this.inputs))
    );
  }

  checkOutputValidity(output: string): TaskEither<string, OutputValidity> {
    return fromFailablePromise(() =>
      Promise.resolve(checkOutputValidity(output, this.inputs))
    );
  }

  readonly customRoutes = Router().get('/leak', (req, res) => {
    const input = req.body;
    res.json({
      known: this.inputs.has(input),
      shouldVerify: this.inputs.get(input)
    });
  });

  readonly inputDecoder = {
    __interface_tag: fpInterfaceTag,
    decode: (input: unknown): Either<string, string> => {
      try {
        const inputstr = input as string;
        return E.right(inputstr);
      } catch (e) {
        return E.left('Invalid input');
      }
    }
  };

  readonly outputEncDec = {
    __interface_tag: fpInterfaceTag,
    encode: (output: string): unknown => {
      return output;
    },
    decode: this.inputDecoder.decode
  };
}
