import { Logger } from './logger';
import * as z from 'zod';

type PluginRouterFetchOpts = {
  isPluginRouteFetch: boolean;
};

const defaultPluginRouterFetchOpts: PluginRouterFetchOpts = {
  isPluginRouteFetch: true
};

export class PluginRouter {
  private constructor(
    private logger: Logger,
    private baseUrl: string,
    private pluginName: string,
    private customRouteMapping?: (s: string) => string
  ) {}

  static async initialize(
    logger: Logger,
    baseUrl: string,
    pluginName: string,
    activePluginsRoute: string = '/plugins/activePlugins',
    customRouteMapping?: (s: string) => string
  ): Promise<PluginRouter> {
    const activePluginsResp = (
      await fetch(`${baseUrl}${activePluginsRoute}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
    ).json();

    const activePlugins = z.array(z.string()).parse(await activePluginsResp);

    if (!activePlugins.includes(pluginName)) {
      throw new Error(
        `Plugin ${pluginName} is not active. Active plugins: ${activePlugins}`
      );
    }
    return new PluginRouter(logger, baseUrl, pluginName, customRouteMapping);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    pluginRoute: string,
    schema: z.ZodType<T>,
    body?: unknown,
    pluginRouteFetchOpts: PluginRouterFetchOpts = defaultPluginRouterFetchOpts
  ): Promise<T> {
    try {
      const pluginPath = pluginRouteFetchOpts.isPluginRouteFetch
        ? `/plugins/${this.pluginName}`
        : '';
      const url = this.customRouteMapping
        ? this.customRouteMapping(pluginRoute)
        : `${this.baseUrl}${pluginPath}${pluginRoute}`;
      this.logger.debug(`Requesting ${method} ${pluginRoute}`);
      const response = await fetch(`${url}`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body) : null
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const validationResult = schema.safeParse(data);
      if (!validationResult.success) {
        throw new Error('Validation failed');
      }

      return validationResult.data;
    } catch (error) {
      this.logger.error('Error in fetch operation:', error);
      throw error;
    }
  }

  async get<T>(pluginRoute: string, schema: z.ZodType<T>): Promise<T> {
    return this.request('GET', pluginRoute, schema);
  }

  async post<T>(
    pluginRoute: string,
    schema: z.ZodType<T>,
    value: T
  ): Promise<void> {
    this.request('POST', pluginRoute, schema, value);
  }
}
