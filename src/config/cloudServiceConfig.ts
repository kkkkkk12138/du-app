export type CloudRegion =
  | 'ap-shanghai'
  | 'ap-guangzhou'
  | 'ap-singapore';

export type CloudBaseConfig = {
  envId: string;
  region: CloudRegion;
  databaseMode: 'document' | 'postgresql';
};

export type CosStorageConfig = {
  bucket: string;
};

export function createCloudBaseConfig({
  envId,
  region,
  databaseMode,
}: CloudBaseConfig): CloudBaseConfig {
  const normalized = {
    envId: envId.trim(),
    region,
    databaseMode,
  };

  if (!normalized.envId) {
    throw new Error('CloudBase 尚未配置');
  }
  return normalized;
}

export function createCosStorageConfig({
  bucket,
}: CosStorageConfig): CosStorageConfig {
  const normalized = {bucket: bucket.trim()};
  if (!normalized.bucket) {
    throw new Error('COS 尚未配置');
  }
  return normalized;
}

export const developmentCloudBaseConfig = createCloudBaseConfig({
  envId: 'du-1-d0gfhmkfe81e2d8e8',
  region: 'ap-shanghai',
  databaseMode: 'postgresql',
});
