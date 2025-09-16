import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { PublisherGitHubConfig } from '@electron-forge/publisher-github';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs-extra';
import path from 'path';

import config from './src/config';

const {
  build: { productName, description, authors, appBundleId, github },
} = config;

const PLATFORM = process.platform;
const ARCHITECTURE = process.arch === 'x64' ? 'x86_64' : process.arch;
const IS_MAC = PLATFORM === 'darwin';
const IS_WINDOWS = PLATFORM === 'win32';

const BINARIES_DIRECTORY = `./resources/bin/${IS_MAC ? 'mac' : IS_WINDOWS ? 'win' : 'linux'}/${ARCHITECTURE}`;

const binaryFilePaths: string[] = [];
for (const binaryFileName of fs.readdirSync(BINARIES_DIRECTORY)) {
  const binaryFilePath = path.join(BINARIES_DIRECTORY, binaryFileName);
  binaryFilePaths.push(binaryFilePath);
}

const forgeConfig: ForgeConfig = {
  packagerConfig: {
    /**
     * Whether to package the application's source code into an archive, using Electron's archive format.
     * Reasons why you may want to enable this feature include mitigating issues around long path names on
     * Windows, slightly speeding up require, and concealing your source code from cursory inspection.
     * When the value is true, it passes the default configuration to the asar module
     * https://electron.github.io/packager/main/interfaces/Options.html#asar
     */
    asar: true,
    extraResource: binaryFilePaths,
    icon: './assets/icons/icon',
    name: productName,
    appBundleId,
    appCopyright: `Copyright © ${new Date().getFullYear()} Archestra Limited`,

    /**
     * Only enable signing/notarization in CI or when explicitly requested
     *
     * For the full list of configuration options for `osxSign`, see the following resources:
     * https://js.electronforge.io/modules/_electron_forge_shared_types.InternalOptions.html#OsxSignOptions
     * https://github.com/electron/osx-sign
     *
     * A common use case for modifying the default osxSign configuration is to customize its entitlements.
     * In macOS, entitlements are privileges that grant apps certain capabilities (e.g. access to the camera, microphone, or USB devices).
     * These are stored within the code signature in an app's executable file.
     *
     * By default, the @electron/osx-sign tool comes with a set of entitlements that should work on both MAS or direct
     * distribution targets. See the complete set of default entitlement files here👇
     * https://github.com/electron/osx-sign/tree/main/entitlements
     * https://developer.apple.com/documentation/bundleresources/entitlements
     * https://developer.apple.com/documentation/security/hardened_runtime
     */
    ...(process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID
      ? {
          osxSign: {
            optionsForFile: (filePath) => ({
              /**
               * Use entitlements to allow necessary exceptions
               */
              entitlements: './entitlements.plist',
            }),
          },
          /**
           * We are currently using the "app-specific password" method for "notarizing" the macOS app
           *
           * https://www.electronforge.io/guides/code-signing/code-signing-macos#option-1-using-an-app-specific-password
           */
          osxNotarize: {
            /**
             * Apple ID associated with your Apple Developer account
             * (aka the email address you used to create your Apple account)
             */
            appleId: process.env.APPLE_ID,
            /**
             * App-specific password
             *
             * Was generated following the instructions here https://support.apple.com/en-us/102654
             */
            appleIdPassword: process.env.APPLE_PASSWORD,
            /**
             * The Apple Team ID you want to notarize under. You can find Team IDs for team you belong to by going to
             * https://developer.apple.com/account/#/membership
             */
            teamId: process.env.APPLE_TEAM_ID,
          },
        }
      : {
          /**
           * Explicitly disable signing when credentials are not available (e.g., for PRs from forks)
           * This prevents the default ad-hoc signing that causes failures
           *
           * By not setting osxSign at all (undefined), Electron Packager skips signing entirely
           */
          osxSign: undefined,
        }),
  },
  /**
   * NOTE: regarding rebuildConfig and hooks.. this is a bit of a pain to get to work with native modules (ie. better-sqlite3)
   *
   * See the following resources for more background:
   * - https://stackoverflow.com/questions/79435783/how-can-i-use-native-node-modules-in-my-packaged-electron-application/79445715#79445715
   * - https://github.com/electron/forge/issues/3738#issuecomment-2775762432
   */
  rebuildConfig: {},
  hooks: {
    // The call to this hook is mandatory for better-sqlite3 to work once the app built
    async packageAfterCopy(_forgeConfig, buildPath) {
      const requiredNativePackages = ['better-sqlite3', 'bindings', 'file-uri-to-path'];

      const sourceNodeModulesPath = path.resolve(__dirname, 'node_modules');
      const destNodeModulesPath = path.resolve(buildPath, 'node_modules');

      // Copy all asked packages in /node_modules directory inside the asar archive
      await Promise.all(
        requiredNativePackages.map(async (packageName) => {
          const sourcePath = path.join(sourceNodeModulesPath, packageName);
          const destPath = path.join(destNodeModulesPath, packageName);

          console.log(`Copying ${sourcePath} to ${destPath}`);

          await fs.mkdirs(path.dirname(destPath));
          await fs.copy(sourcePath, destPath, {
            recursive: true,
            preserveTimestamps: true,
          });
        })
      );

      // Copy database migrations to the build directory
      const sourceMigrationsPath = path.resolve(__dirname, 'src/backend/database/migrations');
      const destMigrationsPath = path.resolve(buildPath, '.vite/build/migrations');

      console.log(`Copying database migration files from ${sourceMigrationsPath} to ${destMigrationsPath}`);

      await fs.mkdirs(destMigrationsPath);
      await fs.copy(sourceMigrationsPath, destMigrationsPath, {
        recursive: true,
        preserveTimestamps: true,
      });
      console.log(`Copied database migration files from ${sourceMigrationsPath} to ${destMigrationsPath}`);
    },
  },
  makers: [
    /**
     * TODO: Re-enable Squirrel for Windows once we have proper code signing setup
     * For now, just create ZIP files for Windows to avoid build failures
     */
    // new MakerSquirrel({
    //   name: productName,
    //   authors,
    //   description,
    //   setupIcon: './icons/icon.ico',
    // }),
    /**
     * NOTE: zip assets are required for update-electron-app (ie. auto updater) to work properly
     * see https://github.com/electron/update-electron-app
     */
    new MakerZIP({}, ['darwin', 'win32']),
    new MakerRpm({
      options: {
        name: productName,
        productName,
        description,
        icon: './assets/icons/icon.png',
      },
    }),
    new MakerDeb({
      options: {
        name: productName,
        productName,
        description,
        icon: './assets/icons/icon.png',
      },
    }),
    /**
     * See the following resources for configuration documentation:
     *
     * https://www.npmjs.com/package/@electron-forge/maker-dmg
     * https://github.com/LinusU/node-appdmg
     */
    new MakerDMG({
      /**
       * re: background -- from the maker-dmg docs:
       *
       * Path to the background image for the DMG window. Image should be of size 658x498.
       *
       * If you need to want to add a second Retina-compatible size, add a separate `@2x` image.
       * For example, if your image is called `background.png`, create a `background@2x.png` that is
       * double the size.
       */
      background: './assets/dmg-background.png',
      format: 'ULFO', // ULFO = lzfse-compressed image (macOS 10.11+ only)
      icon: './assets/icons/icon.icns', // this is the volume icon to replace the default Electron icon
      title: 'Archestra',
      contents: [
        {
          x: 210,
          y: 245,
          type: 'file',
          /**
           * path was a bit of a pain here to configure, see https://stackoverflow.com/a/68840039
           */
          path: `${process.cwd()}/out/Archestra-darwin-${process.arch}/Archestra.app`,
        },
        {
          x: 470,
          y: 245,
          type: 'link',
          path: '/Applications',
        },
      ],
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: github.owner,
          name: github.repoName,
        },
        // default tag prefix is "v" which aligns with release-please's default tag prefix
        // tagPrefix: 'desktop_app-v',
        prerelease: true,
        draft: false,
      } as PublisherGitHubConfig,
    },
  ],
};

export default forgeConfig;
