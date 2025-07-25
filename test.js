const {app}=require("electron");
console.log(app);
// console.log(app.getPath("userData"));
// const vm = require("vm");
// const fs = require("fs-extra");
// // fs.readFile("./src/main.js").then(value=>{
// // const byteCode = new vm.Script(`console.log("test")`);
// // fs.ensureDirSync("./out/bytecode/")
// // fs.writeFile("./out/bytecode/byte.bin", byteCode.createCachedData());
// // })
// const data=fs.readFileSync("./out/bytecode/byte.bin");
// const run=new vm.Script(" ".repeat(19),{
//     cachedData:data
// });
// console.log(run.cachedDataRejected);
// run.runInThisContext();
// const path=require("path");
// const child_process=require("child_process");
// child_process.exec(`${path.resolve("./lib/openssl/openssl.exe")} version`,(err,out,stderr)=>{
//     console.log(err,out,stderr);
// });