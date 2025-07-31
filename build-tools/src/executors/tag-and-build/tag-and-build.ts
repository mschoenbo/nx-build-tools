import { exec } from 'child_process';
import { promisify } from 'util';
import { PromiseExecutor, readJsonFile, runExecutor } from '@nx/devkit';
import { TagAndBuildExecutorSchema } from './schema';

import path = require('path');

const tagAndBuild: PromiseExecutor<TagAndBuildExecutorSchema> = async (
  options,
  context
) => {
  console.log(
    `\n---Starting Docker Image Tag & Build executor for ${options.appName}---\n`
  );
  console.log(`Executor Options`, options);

  const {
    appName,
    dockerRepository,
    buildTarget,
    dockerfile,
    push,
    context: dockerContext,
    additionalTags,
    tagPrefix,
    generateMajorMinor,
  } = options;
  const projectConfig = context.projectsConfigurations.projects[appName];
  if (!projectConfig) {
    console.error(`Error: Project configuration for '${appName}' not found.`);
    return { success: false };
  }
  const projectRoot = projectConfig.root;
  const root = context.root;

  let appVersion: string | null = null;
  let majorMinorVersion: string | null = null;
  let majorVersion: string | null = null;

  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    try {
      const packageJson = readJsonFile(packageJsonPath);
      if (packageJson.version) {
        appVersion = packageJson.version;
        console.log(`Found version ${appVersion} in package.json`);
        const [major, minor] = appVersion.split('.');
        majorMinorVersion = `${major}.${minor}`;
        majorVersion = major;
      } else {
        console.warn(
          `Warning: Version is not set in package.json for '${appName}'. Attempting to derive from Git tags.`
        );
      }
    } catch (readError) {
      console.warn(
        `Warning: Could not read package.json for '${appName}' at ${packageJsonPath}: ${readError}. Attempting to derive from Git tags.`
      );
    }
  } catch (error) {
    console.warn(
      `Warning: General error while trying to read package.json for '${appName}': ${error}. Attempting to derive from Git tags.`
    );
  }

  if (!appVersion) {
    console.log('Attempting to derive version from Git tags...');
    try {
      const { stdout: gitTagsOutput } = await promisify(exec)(
        `git tag --points-at HEAD`
      );
      const tags = gitTagsOutput.trim().split('\n').filter(Boolean);

      const effectiveTagPrefix = tagPrefix || 'v';
      const targetTagPattern = new RegExp(
        `^${appName}/${effectiveTagPrefix}(.*)$`
      );

      const relevantTags = tags.find((tag) => targetTagPattern.test(tag));

      let match = null;
      if (relevantTags) {
        match = relevantTags.match(targetTagPattern);
        appVersion = match && match[1] ? match[1] : null;
        if (appVersion) {
          console.log(`Extracted version ${appVersion} from Git tag`);
          const [major, minor] = appVersion.split('.');
          majorMinorVersion = `${major}.${minor}`;
          majorVersion = major;
        }

        if (!appVersion) {
          console.error(
            `Error: Could not find Git tag for ${appName} matching pattern ${targetTagPattern.toString()}`
          );
          console.error(
            'Please ensure your project has been released and a corresponding Git tag exists (e.g., frontend/v1.2.3).'
          );
          return {
            success: false,
          };
        }
      }

      if (!relevantTags) {
        console.warn(`Warning: No relevant Git tags found for ${appName}`);
      }
    } catch (error) {
      console.error(
        `\nError reading Git tags for '${appName}': ${error}. Ensure Git is available and the repository has tags.`
      );
      return { success: false };
    }
  }

  if (!appVersion) {
    console.error(
      `\nError: Could not determine version for '${appName}'. Please ensure your project has a version set in package.json or a corresponding Git tag exists.`
    );
    return { success: false };
  }

  console.log(`\nRunning build target '${buildTarget}' for '${appName}'...`);
  const buildResult = await runExecutor(
    {
      project: appName,
      target: buildTarget,
      configuration: 'production',
    },
    {},
    context
  );

  for await (const result of buildResult) {
    if (result.success) {
      console.log(
        `Build target '${buildTarget}' for '${appName}' completed successfully`
      );
    } else {
      console.error(`Build target '${buildTarget}' for '${appName}' failed`);
      return { success: false };
    }
  }

  const dockerTags: string[] = [];
  const baseImageName = `${dockerRepository}/${appName}`;

  dockerTags.push(`${baseImageName}:${appVersion}`);
  if (generateMajorMinor) {
    if (majorMinorVersion && majorMinorVersion !== appVersion) {
      dockerTags.push(`${baseImageName}:${majorMinorVersion}`);
    }
    if (
      majorVersion &&
      majorVersion !== appVersion &&
      majorVersion !== majorMinorVersion
    ) {
      dockerTags.push(`${baseImageName}:${majorVersion}`);
    }
  }

  if (additionalTags && additionalTags.length > 0) {
    additionalTags.forEach((tag) => dockerTags.push(`${baseImageName}:${tag}`));
  }

  const { stdout: gitShaOutput } = await promisify(exec)('git rev-parse HEAD');
  const gitSha = gitShaOutput.trim().substring(0, 7);
  dockerTags.push(`${baseImageName}:sha-${gitSha}`);

  console.log(`\nGenerated Docker Tags: ${dockerTags.join(', ')}`);

  let dockerCommand = `docker buildx build`;
  if (push) {
    dockerCommand += ` --push`;
  }

  dockerTags.forEach((tag) => {
    dockerCommand += ` -t "${tag}"`;
  });

  const finalDockerfile = dockerfile
    ? path.join(root, dockerfile)
    : path.join(root, 'Dockerfile');
  const finalContext = dockerContext ? path.join(root, dockerContext) : root;

  dockerCommand += ` -f "${finalDockerfile}" "${finalContext}"`;
  dockerCommand += ` --build-arg APP_VERSION="${appVersion}"`;
  dockerCommand += ` --build-arg BUILD_SHA="${gitSha}"`;

  console.log(`\nExecuting Docker build command:\n${dockerCommand}\n`);
  try {
    const { stderr } = await promisify(exec)(dockerCommand);
    if (stderr) {
      console.error(stderr);
    }
    console.log(
      `\n--- Successfully built and tagged/pushed Docker image(s) for '${appName}' ---`
    );
    return { success: true };
  } catch (error) {
    console.error(`\nError: Docker build failed for '${appName}'.`);
    return { success: false };
  }
};

export default tagAndBuild;
