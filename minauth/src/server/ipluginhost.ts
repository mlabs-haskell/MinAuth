import * as expressCore from 'express-serve-static-core';

export interface IPluginHost {
  verifyProofAndGetOutput();

  checkOutputValidity();

  isReady();

  activePluginNames();

  // this ties us into the express app
  // TODO rethink
  installCustomRoutes(app: expressCore.Express);
}
