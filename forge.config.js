module.exports = {
  packagerConfig: {
    name: 'Suisho Connector',
    win32metadata: {
      CompanyName: 'Suisho Apps',
      ProductName: 'Suisho Connector',
      FileDescription: 'Connect your phone and computer',
      OriginalFilename: 'Suisho Connector.exe'
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
      "src",
      "node_modules/typescript",
      "node_modules/electron-squirrel-startup",
      "node_modules/@types",
      "forge.config.js",
      "tsconfig.json"
    ]
  },
  rebuildConfig: {
  },
  makers: [
    {
      name: '@electron-forge/maker-wix',
      platforms:["win32"],
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
