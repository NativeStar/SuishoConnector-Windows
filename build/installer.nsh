; 卸载程序初始化，在卸载开始前执行
!macro customUnInit
  ; 检测 Suisho Connector.exe 是否正在运行
  ; 用 cmd.exe /c 执行管道，并只依赖退出码（避免 ExecToStack 的出栈顺序差异导致判断失效）
  nsExec::Exec '"$SYSDIR\cmd.exe" /c "tasklist /NH /FI $\"IMAGENAME eq Suisho Connector.exe$\" | find $\"Suisho Connector.exe$\" >nul"'

  Pop $0 ; 返回码

  ; 返回码为 0 表示找到了进程
  ${If} $0 == 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "程序正在运行 请关闭应用进程后重新执行安装/卸载!"
    Abort
  ${EndIf}
!macroend

!macro customUnInstall
  ; 询问是否删除应用数据
  MessageBox MB_YESNO "是否删除应用数据?$\n$\n包括应用设置 互传和通知记录 接收的文件等" \
    /SD IDNO IDYES PL_DeleteAppData_Accepted IDNO PL_DeleteAppData_Skipped

  PL_DeleteAppData_Accepted:
    ; 删除 AppData\Roaming\phonelinker 目录
    ; Ensure $APPDATA points to current user even for per-machine installs
    StrCpy $0 $installMode
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}

    RMDir /r "$APPDATA\Suisho Connector"
    RMDir /r "$APPDATA\phonelinker"

    ${If} $0 == "all"
      SetShellVarContext all
    ${EndIf}
    Goto PL_DeleteAppData_Done

  PL_DeleteAppData_Skipped:
    Goto PL_DeleteAppData_Done

  PL_DeleteAppData_Done:
!macroend
