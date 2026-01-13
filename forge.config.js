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
      name: '@electron-forge/maker-wix',
      platforms:["win32"],
      config: {
        icon: path.resolve(__dirname, 'res', 'icon.ico'),
        language: 2052,
        manufacturer: 'Suisho Apps',
        upgradeCode: '4D4B78B7-820E-4470-BE1F-B9E669575049',
        appUserModelId: 'com.suisho.connector',
        // 与 package.json:interactive-notifications.toast-activator-clsid 保持一致
        toastActivatorClsid: '171807FD-769F-4129-A8C2-C603F8F125C8',
        ui: { chooseDirectory: true ,localizations: [path.resolve(__dirname,'WixUI_zh-CN.wxl')]},
        defaultInstallMode: 'perMachine',
        // 让快捷方式直接指向真实主程序
        beforeCreate: (creator) => {
          const versionedExeTarget = '[APPLICATIONROOTDIRECTORY]app-{{SemanticVersion}}\\{{ApplicationBinary}}.exe';
          // 禁用 stub 启动器
          creator.getSpecialFiles = async () => [];
          creator.exeFilePath = path.join(creator.appDirectory, `${creator.exe}.exe`);

          const originalGetRegistryKeys = creator.getRegistryKeys.bind(creator);
          creator.getRegistryKeys = function () {
            const registry = originalGetRegistryKeys();
            for (const item of registry) {
              if (typeof item.value === 'string') {
                item.value = item.value.replace(
                  '[APPLICATIONROOTDIRECTORY]{{ApplicationBinary}}.exe',
                  versionedExeTarget
                );
              }
            }
            return registry;
          };

          if (typeof creator.wixTemplate === 'string') {
            creator.wixTemplate = creator.wixTemplate
              .replaceAll('[APPLICATIONROOTDIRECTORY]{{ApplicationBinary}}.exe', versionedExeTarget)
              .replaceAll('{{ApplicationName}} (Machine - MSI)', '{{ApplicationName}}')
              .replaceAll('{{ApplicationName}} (User - MSI)', '{{ApplicationName}}')
              .replaceAll('{{ApplicationName}} (Machine)', '{{ApplicationName}}')
              .replaceAll('{{ApplicationName}} (User)', '{{ApplicationName}}');
          }
        },
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ]
};
