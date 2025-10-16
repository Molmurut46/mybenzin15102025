# GitHub Actions CI Setup Guide

This guide explains how to set up the GitHub Actions CI workflow for building the Android application.

## Prerequisites

1. GitHub repository with this codebase
2. GitHub Personal Access Token with appropriate permissions
3. Android project structure in the repository

## Required Environment Variables

Add these environment variables to your `.env` file (for local API testing) and to your deployment platform:

```env
# GitHub API Configuration
GITHUB_TOKEN=ghp_your_personal_access_token_here
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=your-repository-name
GITHUB_WORKFLOW_ID=android.yml
GITHUB_WORKFLOW_REF=main
```

### How to Get These Values

#### 1. GITHUB_TOKEN

Create a GitHub Personal Access Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "MyBenzin CI Token")
4. Set expiration (recommended: 90 days or custom)
5. Select the following scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
   - ✅ `read:org` (Read org and team membership)
6. Click "Generate token"
7. **Copy the token immediately** (you won't see it again!)
8. Add to `.env` as `GITHUB_TOKEN=ghp_...`

#### 2. GITHUB_REPO_OWNER

Your GitHub username or organization name.

Example: If your repo URL is `https://github.com/Molmurut46/mybenzin-app`, then:
```env
GITHUB_REPO_OWNER=Molmurut46
```

#### 3. GITHUB_REPO_NAME

Your repository name (without the owner).

Example: If your repo URL is `https://github.com/Molmurut46/mybenzin-app`, then:
```env
GITHUB_REPO_NAME=mybenzin-app
```

#### 4. GITHUB_WORKFLOW_ID

The workflow file name. Use:
```env
GITHUB_WORKFLOW_ID=android.yml
```

#### 5. GITHUB_WORKFLOW_REF

The branch to trigger the workflow on (usually `main` or `master`):
```env
GITHUB_WORKFLOW_REF=main
```

## Workflow File

The CI workflow is located at `.github/workflows/android.yml` and includes:

- ✅ Node.js setup and dependency installation
- ✅ Next.js application build
- ✅ Android SDK and JDK 17 setup
- ✅ Gradle build system
- ✅ APK/AAB artifact generation
- ✅ Artifact upload with 30-day retention

## Testing the Setup

1. **Add environment variables** to your `.env` file
2. **Restart your development server**
3. **Visit** `/app` page (restricted to privileged user)
4. **Click** "Запустить сборку" button
5. **Check status** with "Обновить статус" button
6. **Open CI** link to view workflow run on GitHub

## Troubleshooting

### "Bad credentials" error

- ✅ Verify `GITHUB_TOKEN` is valid and hasn't expired
- ✅ Ensure token has `repo` and `workflow` scopes
- ✅ Check token is correctly set in environment variables

### "Missing environment variables" error

- ✅ Confirm all 5 variables are set in `.env`
- ✅ Restart your application server after adding variables
- ✅ Check for typos in variable names

### "Failed to trigger workflow" error

- ✅ Verify repository owner and name are correct
- ✅ Ensure workflow file exists at `.github/workflows/android.yml`
- ✅ Check the branch name (`GITHUB_WORKFLOW_REF`) is correct
- ✅ Confirm the workflow has `workflow_dispatch` trigger enabled

### Workflow fails during build

- ✅ Ensure Android project structure exists in repository
- ✅ Check that `android/gradlew` file exists and is executable
- ✅ Verify `android/build.gradle` and app-level configs are present
- ✅ Review workflow logs on GitHub Actions page

## Security Notes

⚠️ **Never commit `.env` file to version control!**

- Add `.env` to `.gitignore` (should already be there)
- Use environment variables on your hosting platform (Vercel, Railway, etc.)
- Rotate tokens periodically for security

## Android Project Setup

If you don't have an Android project yet, you'll need to create one:

1. Initialize a React Native or Capacitor project
2. Generate Android build files
3. Commit the `android/` directory to your repository
4. Update the workflow if needed for your specific build setup

## Workflow Customization

To modify the build process, edit `.github/workflows/android.yml`:

- Change Node.js version in `setup-node` step
- Modify Java version in `setup-java` step
- Add signing configuration for release builds
- Adjust artifact retention days
- Add deployment steps (Google Play, Firebase, etc.)

## Access Control

The app build page (`/app`) is restricted to:
- Authenticated users only
- Privileged email: `89045219234@mail.ru`

To change this, edit `src/app/api/app-build/trigger/route.ts` and `src/app/api/app-build/status/route.ts`.

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Creating a Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)