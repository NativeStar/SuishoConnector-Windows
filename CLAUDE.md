## 项目简介

- 该项目用于在局域网内和安装了所需客户端的Android设备通讯 并提供一系列功能实现跨屏互联效果

- 项目有一个Android客户端 源码不存放在该项目文件夹下 如果你需要结合Android客户端代码进行分析或开发等 可跟我提出要求

## 技术栈

- 项目使用Electron开发
- 除electron preload部分外全部使用Typescript编写
- 渲染进程使用React+Vite开发
- 在主进程通过Websocket与Android客户端进行连接和通讯
- 通过IndexedDb+Dexie存储除设置外数据

## 项目结构

- src目录下存放主进程代码 其中main.ts为项目入口 preload文件夹下存放用于跨进程通讯的preload js文件
- shared目录用于存放需要共享的内容 通过monorepo实现引用 修改后需要在其目录下执行一次构建才能生效 会同时产出适用于ESModule和CommonJs两种模块系统所用的文件
- renderer目录下存放渲染进程代码 其内src/main.tsx为入口文件 通过HashRouter进行页面路由
- res文件夹用于存放一些资源文件 通常无需处理和读取
- 其他文件夹与代码无关 不可读取和操作

## 开发要求

- 除preload脚本外均使用ts(tsx)开发
- 如果实现功能需要安装其他库 除非我明确同意 否则不得安装 可要求我手动安装