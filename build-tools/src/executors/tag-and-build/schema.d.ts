export interface TagAndBuildExecutorSchema {
  appName: string;
  dockerRepository: string;
  buildTarget: string;
  dockerfile: string;
  context: string;
  push: boolean;
  additionalTags?: string[];
  generateMajorMinor?: boolean;
  tagPrefix?: string;
}
