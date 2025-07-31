# @mschoenbo/nx-build-tools

This directory contains custom Nx executors. These tools provide automation for building, tagging, and deploying
Docker containers with version management.

## Overview

The tools project provides custom Nx executors that extend the build system with
specialized functionality for containerization and deployment workflows.

## Available Executors

### tag-and-build

A powerful executor for building, tagging, and pushing Docker images with
intelligent version management.

#### Features

- **Automatic Version Detection**: Reads version from `package.json` or Git tags
- **Flexible Tagging Strategy**: Supports semantic versioning with major/minor
  tags
- **Git Integration**: Uses Git SHA for traceability
- **Build Integration**: Runs Nx build targets before containerization
- **Registry Support**: Built-in support for pushing to container registries

#### Configuration Options

| Option               | Type     | Required | Default      | Description                                           |
| -------------------- | -------- | -------- | ------------ | ----------------------------------------------------- |
| `appName`            | string   | ✅       | -            | The name of the Nx app to build and tag               |
| `dockerRepository`   | string   | ✅       | -            | Base Docker repository (e.g., `ghcr.io/your-org/`)    |
| `buildTarget`        | string   | ✅       | `build`      | Nx build target to run before containerization        |
| `dockerfile`         | string   | ❌       | `Dockerfile` | Path to Dockerfile relative to project root           |
| `context`            | string   | ❌       | `.`          | Build context for Docker relative to project root     |
| `push`               | boolean  | ❌       | `false`      | Whether to push Docker image(s) to registry           |
| `additionalTags`     | string[] | ❌       | `[]`         | Additional static tags (e.g., `['latest']`)           |
| `generateMajorMinor` | boolean  | ❌       | `false`      | Generate major and minor version tags                 |
| `tagPrefix`          | string   | ❌       | `v`          | Prefix for Git tags (e.g., `v` for `app-name/v1.2.3`) |

#### Version Detection Strategy

The executor uses a two-step approach to determine the application version:

1. **Package.json Priority**: First attempts to read version from the project's
   `package.json`
2. **Git Tag Fallback**: If no version in package.json, extracts version from
   Git tags

**Git Tag Pattern**: `{appName}/{tagPrefix}{version}` (e.g., `frontend/v1.2.3`)

#### Generated Docker Tags

The executor automatically generates the following tags:

- **Version Tag**: `{repository}/{appName}:{version}` (e.g.,
  `ghcr.io/org/frontend:1.2.3`)
- **Major.Minor Tag**: `{repository}/{appName}:{major}.{minor}` (if
  `generateMajorMinor: true`)
- **Major Tag**: `{repository}/{appName}:{major}` (if
  `generateMajorMinor: true`)
- **SHA Tag**: `{repository}/{appName}:sha-{gitSha}` (for traceability)
- **Additional Tags**: Any tags specified in `additionalTags` array

#### Build Arguments

The executor automatically passes these build arguments to Docker:

- `APP_VERSION`: The detected application version
- `BUILD_SHA`: The Git commit SHA (first 7 characters)

#### Usage Examples

##### Basic Configuration

```json
{
  "executor": "@mschoenbo/nx-build-tools:tag-and-build",
  "options": {
    "appName": "frontend",
    "dockerRepository": "ghcr.io/your-org",
    "buildTarget": "build",
    "push": false
  }
}
```

##### Advanced Configuration with Version Tags

```json
{
  "executor": "@mschoenbo/nx-build-tools:tag-and-build",
  "options": {
    "appName": "backend",
    "dockerRepository": "ghcr.io/your-org",
    "buildTarget": "build:production",
    "dockerfile": "apps/backend/Dockerfile.prod",
    "context": "apps/backend",
    "push": true,
    "generateMajorMinor": true,
    "additionalTags": ["latest", "stable"],
    "tagPrefix": "v"
  }
}
```

##### Project Configuration Example

```json
{
  "name": "my-app",
  "targets": {
    "container": {
      "executor": "@mschoenbo/nx-build-tools:tag-and-build",
      "options": {
        "appName": "my-app",
        "dockerRepository": "ghcr.io/my-org",
        "buildTarget": "build",
        "dockerfile": "apps/my-app/Dockerfile",
        "push": false,
        "additionalTags": ["latest"]
      }
    }
  }
}
```

#### Running the Executor

```bash
# Build and tag without pushing
npx nx run my-app:container

# Build and tag with pushing (requires registry authentication)
npx nx run my-app:container --push=true

# Run with custom options
npx nx run my-app:container --generateMajorMinor=true --additionalTags=dev,test
```

#### Git Tag Requirements

For Git-based version detection, ensure your tags follow the pattern:

```bash
# Create a tag for version 1.2.3 of the frontend app
git tag frontend/v1.2.3

# Create a tag for version 2.0.0 of the backend app
git tag backend/v2.0.0

# Push tags to remote
git push origin --tags
```

#### Dockerfile Requirements

Your Dockerfile should accept the build arguments:

```dockerfile
ARG APP_VERSION
ARG BUILD_SHA

# Use the build arguments in your Dockerfile
LABEL version="${APP_VERSION}"
LABEL build-sha="${BUILD_SHA}"

# Your Dockerfile content...
```

#### Error Handling

The executor provides detailed error messages and logging:

- **Version Detection Failures**: Clear guidance on fixing version issues
- **Build Failures**: Detailed output from Nx build targets
- **Docker Build Failures**: Full Docker buildx output for debugging
- **Git Integration Issues**: Helpful messages for Git-related problems

#### Integration with CI/CD

The executor is designed to work seamlessly with CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Build and Push Docker Images
  run: |
    npx nx run frontend:container --push=true
    npx nx run backend:container --push=true
```

#### Best Practices

1. **Version Management**: Keep your `package.json` versions up to date
2. **Git Tags**: Use semantic versioning for Git tags
3. **Registry Authentication**: Ensure proper authentication for pushing images
4. **Build Context**: Optimize Docker build context for faster builds
5. **Tag Strategy**: Use `generateMajorMinor` for semantic versioning support

#### Troubleshooting

**Common Issues:**

1. **Version not found**: Ensure `package.json` has a version or create
   appropriate Git tags
2. **Docker build fails**: Check Dockerfile syntax and build context
3. **Push fails**: Verify registry authentication and permissions
4. **Build target fails**: Ensure the specified Nx build target exists and works

**Debug Mode:**

Enable verbose logging by setting the `NX_VERBOSE_LOGGING` environment variable:

```bash
NX_VERBOSE_LOGGING=true npx nx run my-app:container
```

## Development

### Building the Tools

```bash
# Build the tools project
npx nx build tools

# Run tests
npx nx test tools
```

### Adding New Executors

1. Create executor implementation in `src/executors/`
2. Define schema in `src/executors/schema.json`
3. Update `executors.json` to register the new executor
4. Add tests in `src/executors/executor-name.spec.ts`

### Project Structure

```
build-tools/
├── src/
│   └── executors/
│       ├── tag-and-build.ts      # Main executor implementation
│       ├── schema.json           # JSON schema for validation
│       ├── schema.d.ts           # TypeScript types
│       └── tag-and-build.spec.ts # Tests
├── executors.json                # Executor registration
├── project.json                  # Nx project configuration
└── README.md                    # This documentation
```

## License

MIT
