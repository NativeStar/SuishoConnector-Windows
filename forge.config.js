const path = require('path');

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
    asar: false,
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
      "assets.old",
      "^/renderer(/|$)",
      ".claude",
      ".gitignore",
    ]
  },
  rebuildConfig: {
  },
  makers: [
    {
      name: '@electron-forge/maker-wix',
      platforms:["win32"],
      config: {
        // WiX installer 侧使用的应用/卸载显示图标
        icon: path.resolve(__dirname, 'res', 'icon.ico'),
      },
    },
    // {
    //   name: '@electron-forge/maker-squirrel',
    //   config: {},
    // },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    }
    // {
    //   name: '@electron-forge/maker-deb',
    //   config: {},
    // },
    // {
    //   name: '@electron-forge/maker-rpm',
    //   config: {},
    // },
  ],
  plugins: [
    // {
    //   name: '@electron-forge/plugin-auto-unpack-natives',
    //   config: {},
    // },
  ]
};
