import { ExecutorContext } from '@nx/devkit';
import { readJsonFile, runExecutor } from '@nx/devkit';
import { promisify } from 'util';

import { TagAndBuildExecutorSchema } from './schema';
import executor from './tag-and-build';

// Mock dependencies
jest.mock('@nx/devkit', () => ({
  readJsonFile: jest.fn(),
  runExecutor: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn(),
}));

const mockReadJsonFile = readJsonFile as jest.MockedFunction<
  typeof readJsonFile
>;
const mockRunExecutor = runExecutor as jest.MockedFunction<typeof runExecutor>;
const mockPromisify = promisify as jest.MockedFunction<typeof promisify>;

describe('TagAndBuild Executor', () => {
  let mockContext: ExecutorContext;
  let mockPromisifiedExec: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPromisifiedExec = jest.fn();
    mockPromisify.mockReturnValue(mockPromisifiedExec);

    mockContext = {
      root: '/test/root',
      cwd: process.cwd(),
      isVerbose: false,
      projectGraph: {
        nodes: {},
        dependencies: {},
      },
      projectsConfigurations: {
        projects: {
          'test-app': {
            root: 'apps/test-app',
            sourceRoot: 'apps/test-app/src',
            projectType: 'application',
            targets: {},
          },
        },
        version: 2,
      },
      nxJsonConfiguration: {},
    };
  });

  describe('Version Detection', () => {
    it('should use version from package.json when available', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockReadJsonFile).toHaveBeenCalledWith(
        'apps/test-app/package.json'
      );
    });

    it('should fall back to Git tags when package.json version is not available', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({});
      mockPromisifiedExec.mockResolvedValue({
        stdout: 'test-app/v1.2.3\nother-tag',
      }); // git tag output
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockPromisifiedExec).toHaveBeenCalledWith(
        'git tag --points-at HEAD'
      );
    });

    it('should use custom tag prefix when provided', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
        tagPrefix: 'release-',
      };

      mockReadJsonFile.mockReturnValue({});
      mockPromisifiedExec.mockResolvedValue({
        stdout: 'test-app/release-1.2.3',
      });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
    });

    it('should fail when no version can be determined', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({});
      mockPromisifiedExec.mockResolvedValue({ stdout: '' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(false);
    });

    it('should handle package.json read errors gracefully', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockImplementation(() => {
        throw new Error('File not found');
      });
      mockPromisifiedExec
        .mockResolvedValueOnce({ stdout: 'test-app/v1.2.3' })
        .mockResolvedValueOnce({ stdout: 'abc1234' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );

      const result = await executor(options, mockContext);

      expect(result.success).toBe(false);
    });
  });

  describe('Build Execution', () => {
    it('should execute the build target successfully', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockRunExecutor).toHaveBeenCalledWith(
        {
          project: 'test-app',
          target: 'build',
          configuration: 'production',
        },
        {},
        mockContext
      );
    });

    it('should fail when build target fails', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: false };
        })()
      );

      const result = await executor(options, mockContext);

      expect(result.success).toBe(false);
    });
  });

  describe('Docker Tagging', () => {
    it('should generate correct Docker tags with version', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockPromisifiedExec).toHaveBeenCalledWith(
        expect.stringContaining(
          'docker buildx build -t "test-repo/test-app:1.2.3" -t "test-repo/test-app:sha-abc1234"'
        )
      );
    });

    it('should generate major.minor and major tags when generateMajorMinor is true', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
        generateMajorMinor: true,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockPromisifiedExec).toHaveBeenCalledWith(
        expect.stringContaining(
          'docker buildx build -t "test-repo/test-app:1.2.3" -t "test-repo/test-app:1.2" -t "test-repo/test-app:1" -t "test-repo/test-app:sha-abc1234"'
        )
      );
    });

    it('should include additional tags when provided', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
        additionalTags: ['latest', 'stable'],
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockPromisifiedExec).toHaveBeenCalledWith(
        expect.stringContaining(
          'docker buildx build -t "test-repo/test-app:1.2.3" -t "test-repo/test-app:latest" -t "test-repo/test-app:stable" -t "test-repo/test-app:sha-abc1234"'
        )
      );
    });
  });

  describe('Docker Build', () => {
    it('should execute Docker build with correct parameters', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockPromisifiedExec).toHaveBeenCalledWith(
        expect.stringContaining(
          'docker buildx build -t "test-repo/test-app:1.2.3" -t "test-repo/test-app:sha-abc1234" -f "/test/root/Dockerfile" "/test/root" --build-arg APP_VERSION="1.2.3" --build-arg BUILD_SHA="abc1234"'
        )
      );
    });

    it('should include --push flag when push is true', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: true,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockPromisifiedExec).toHaveBeenCalledWith(
        expect.stringContaining('docker buildx build --push')
      );
    });

    it('should use custom dockerfile and context paths', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'docker/Dockerfile.prod',
        context: 'apps/test-app',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockPromisifiedExec).toHaveBeenCalledWith(
        expect.stringContaining(
          'docker buildx build -t "test-repo/test-app:1.2.3" -t "test-repo/test-app:sha-abc1234" -f "/test/root/docker/Dockerfile.prod" "/test/root/apps/test-app" --build-arg APP_VERSION="1.2.3" --build-arg BUILD_SHA="abc1234"'
        )
      );
    });

    it('should handle Docker build failures', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec
        .mockResolvedValueOnce({ stdout: 'abc1234' })
        .mockRejectedValueOnce(new Error('Docker build failed'));

      const result = await executor(options, mockContext);

      expect(result.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle Git tag reading errors', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      mockReadJsonFile.mockReturnValue({});
      mockPromisifiedExec.mockRejectedValue(new Error('Git command failed'));

      const result = await executor(options, mockContext);

      expect(result.success).toBe(false);
    });

    it('should handle missing project configuration', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'non-existent-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: false,
      };

      // Create a context without the non-existent project
      const contextWithoutProject = {
        ...mockContext,
        projectsConfigurations: {
          ...mockContext.projectsConfigurations,
          projects: {}, // Empty projects object
        },
      };

      // The executor will throw an error when trying to access the non-existent project
      const result = await executor(options, contextWithoutProject);
      expect(result.success).toBe(false);
    });
  });

  describe('Integration', () => {
    it('should complete full workflow successfully', async () => {
      const options: TagAndBuildExecutorSchema = {
        appName: 'test-app',
        dockerRepository: 'test-repo',
        buildTarget: 'build',
        dockerfile: 'Dockerfile',
        context: '.',
        push: true,
        generateMajorMinor: true,
        additionalTags: ['latest'],
      };

      mockReadJsonFile.mockReturnValue({ version: '1.2.3' });
      mockRunExecutor.mockResolvedValue(
        (async function* () {
          yield { success: true };
        })()
      );
      mockPromisifiedExec.mockResolvedValue({ stdout: 'abc1234' });

      const result = await executor(options, mockContext);

      expect(result.success).toBe(true);
      expect(mockReadJsonFile).toHaveBeenCalled();
      expect(mockRunExecutor).toHaveBeenCalled();
      expect(mockPromisifiedExec).toHaveBeenCalledTimes(2); // git rev-parse + docker build
    });
  });
});
