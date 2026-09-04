import {developmentCloudBaseConfig} from '../../config/cloudServiceConfig';
import type {AuthProvider} from './AuthProvider';
import {createCloudBaseAuthProvider} from './cloudBaseAuthProvider';

let provider: AuthProvider | undefined;

export function getAccountAuthProvider() {
  provider ??= createCloudBaseAuthProvider(developmentCloudBaseConfig);
  return provider;
}
