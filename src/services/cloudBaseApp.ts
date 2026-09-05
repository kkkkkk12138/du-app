import cloudbase from '@cloudbase/js-sdk';

import type {CloudBaseConfig} from '../config/cloudServiceConfig';
import {ensureCloudBaseReactNativeStorage} from './cloudBaseReactNativeStorage';

type CloudBaseAppConfig = Pick<CloudBaseConfig, 'envId' | 'region'>;

type CloudBaseInitializer<T> = (input: {
  env: string;
  region: CloudBaseConfig['region'];
}) => T;

const apps = new Map<string, unknown>();

const initializeCloudBase = (input: {
  env: string;
  region: CloudBaseConfig['region'];
}) => cloudbase.init(input);

export function getCloudBaseApp<T>(
  config: CloudBaseAppConfig,
  initialize: CloudBaseInitializer<T> = initializeCloudBase as CloudBaseInitializer<T>,
): T {
  ensureCloudBaseReactNativeStorage();

  const cacheKey = `${config.envId}:${config.region}`;
  const existing = apps.get(cacheKey);
  if (existing) {
    return existing as T;
  }

  const app = initialize({
    env: config.envId,
    region: config.region,
  });
  apps.set(cacheKey, app);
  return app;
}
