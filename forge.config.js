const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
async function safeRm(targetPath) {
  try {
    await fsp.rm(targetPath, { recursive: true, force: true });
  } catch {}
}
function walkDirSync(dirPath, handlers) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (handlers.onDir && handlers.onDir(fullPath, entry) === false) {
        continue;
      }
      walkDirSync(fullPath, handlers);
      continue;
    }
    if (entry.isFile()) {
      handlers.onFile && handlers.onFile(fullPath, entry);
    }
  }
}

module.exports = {
  packagerConfig: {
    name: 'Suisho Connector',
    // 使用绝对路径，避免在不同工作目录下打包时找不到图标而被静默跳过
    icon: path.resolve(__dirname, 'res', 'icon.ico'),
    win32metadata: {
      CompanyName: 'Suisho Apps',
      ProductName: 'Suisho Connector',
      FileDescription: 'Suisho Connector',
      OriginalFilename: 'Suisho Connector.exe',
    },
    win:{
      "publisherName": "Suisho Apps",
    },
    asar: true,
    derefSymlinks: true,
    ignore:[
      ".js.map$",
      "psd",
      "drawio",
      "test",
      ".npmrc",
      ".vscode",
      "runTest.bat",
      // "src",
      "(^/src/|^/src$)",
      "node_modules/typescript",
      "node_modules/electron-squirrel-startup",
      "node_modules/@types",
      "forge.config.js",
      "tsconfig.json",
      "^/renderer(/|$)",
      ".claude",
      ".gitignore",
      "CLAUDE.md",
      "AGENTS.md",
      "temp_index.txt",
      "(^/shared/|^/shared$)",
      "(^/scripts/|^/scripts$)",
      "WixUI_zh-CN.wxl"
    ]
  },
  hooks: {
    packageAfterExtract: async (_forgeConfig, buildPath, _electronVersion, platform) => {
      if (platform !== 'win32') return;
      const localesDir = path.join(buildPath, 'locales');
      if (!fs.existsSync(localesDir)) return;
      const keepLocales = new Set([
        'zh-CN.pak',
        'zh-TW.pak',
        'en-US.pak'
      ]);
      const entries = fs.readdirSync(localesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.toLowerCase().endsWith('.pak')) continue;
        if (keepLocales.has(entry.name)) continue;
        await safeRm(path.join(localesDir, entry.name));
      }
    },
    packageAfterCopy: async (_forgeConfig, buildPath, _electronVersion, platform) => {
      if (platform !== 'win32') return;

      const nodeModulesDir = path.join(buildPath, 'resources', 'app', 'node_modules');
      if (!fs.existsSync(nodeModulesDir)) return;
      const deleteExts = new Set([
        '.pdb',
        '.ipdb',
        '.iobj',
        '.obj',
        '.ilk',
        '.exp',
        '.lib',
        '.tlog',
        '.log',
        '.lastbuildstate',
      ]);
      const deleteDirNames = new Set([
        'obj',
        '.vs',
      ]);
      const pendingRemovals = [];
      walkDirSync(nodeModulesDir, {
        onDir: (dirFullPath, dirent) => {
          const name = dirent.name.toLowerCase();
          if (deleteDirNames.has(name)) {
            pendingRemovals.push(dirFullPath);
            return false;
          }
          return true;
        },
        onFile: (fileFullPath, dirent) => {
          const nameLower = dirent.name.toLowerCase();
          const extLower = path.extname(nameLower);
          if (deleteExts.has(extLower)) {
            pendingRemovals.push(fileFullPath);
          }
        },
      });
      for (const targetPath of pendingRemovals) {
        await safeRm(targetPath);
      }
    },
  },
  rebuildConfig: {
  },
  makers: [
    {
      name: '@felixrieseberg/electron-forge-maker-nsis',
      config: {
        getAppBuilderConfig: () => {
          return {
            productName: "Suisho Connector",  // 安装时显示的名称（顶层配置）
            artifactName: "Suisho Connector Setup ${version}.${ext}",
            nsis: {
              installerIcon: path.resolve(__dirname, 'res', 'icon.ico'),
              uninstallerIcon: path.resolve(__dirname, 'res', 'icon.ico'),
              shortcutName: "Suisho Connector",
              uninstallDisplayName: "Suisho Connector",  // 控制面板中显示的名称
              oneClick: false,
              perMachine: false,
              allowToChangeInstallationDirectory: true,
              installerLanguages: ['zh_CN'],
              language: '2052',
              createDesktopShortcut: 'always',
              createStartMenuShortcut: true,
              runAfterFinish: false,
              guid: '4d4b78b7-820e-4470-be1f-b9e669575049',
              include: path.resolve(__dirname, 'build', 'installer.nsh'),
            }
          };
        }
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ]
};
