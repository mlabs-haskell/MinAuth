import { DummyPluginTs } from './dummyplugin.js';
import express from 'express';
import { Express } from 'express-serve-static-core';
import request from 'supertest';
import { outputInvalid, outputValid } from './plugintype.js';

describe('DummyPluginTs Tests', () => {
  let dummyPluginTs: DummyPluginTs;
  let inputStore: Map<string, boolean>;

  beforeEach(() => {
    inputStore = new Map();
    dummyPluginTs = new DummyPluginTs(inputStore);
  });

  describe('verifyAndGetOutput', () => {
    it('should resolve with the input when it is valid and should be verified', async () => {
      const validInput = 'validInput';
      inputStore.set(validInput, true);
      await expect(
        dummyPluginTs.verifyAndGetOutput(validInput)
      ).resolves.toEqual(validInput);
    });

    it('should reject when the input is unknown', async () => {
      const validInput = 'missingInput';
      await expect(
        dummyPluginTs.verifyAndGetOutput(validInput)
      ).rejects.toThrow();
    });

    it('should reject when the input is invalid or should not be verified', async () => {
      const invalidInput = 'invalidInput';
      inputStore.set(invalidInput, false);
      await expect(
        dummyPluginTs.verifyAndGetOutput(invalidInput)
      ).rejects.toThrow('Invalid input; missing or `shouldVerify` is false');
    });
  });

  describe('checkOutputValidity', () => {
    it('should resolve with outputValid when the output is valid', async () => {
      const validOutput = 'validOutput';
      inputStore.set(validOutput, true);
      await expect(
        dummyPluginTs.checkOutputValidity(validOutput)
      ).resolves.toEqual(outputValid);
    });

    it('should resolve with outputInvalid when the output is invalid', async () => {
      const invalidOutput = 'invalidOutput';
      inputStore.set(invalidOutput, false);
      await expect(
        dummyPluginTs.checkOutputValidity(invalidOutput)
      ).resolves.toEqual(
        outputInvalid(
          'Invalid output: input missing or `shouldVerify` is false'
        )
      );
    });
  });

  describe('customRoutes', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use(dummyPluginTs.customRoutes);
    });

    it('should return correct known and shouldVerify statuses for a known input', async () => {
      const knownInput = 'knownInput';
      dummyPluginTs.inputs.set(knownInput, true);
      const response = await request(app)
        .post('/leak')
        .send({ input: knownInput });
      expect(response.body).toEqual({ known: true, shouldVerify: true });
    });

    it('should return correct known and shouldVerify statuses for an unknown input', async () => {
      const unknownInput = 'unknownInput';
      const response = await request(app)
        .post('/leak')
        .send({ input: unknownInput });
      expect(response.body).toEqual({ known: false, shouldVerify: false });
    });
  });
});
