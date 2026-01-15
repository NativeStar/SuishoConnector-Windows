; 卸载程序初始化，在卸载开始前执行
!macro customUnInit
  ; 检测 Suisho Connector.exe 是否正在运行
  nsExec::ExecToStack 'tasklist /NH /FI "IMAGENAME eq Suisho Connector.exe" | findstr /I "Suisho Connector.exe"'
  Pop $0 ; 返回码
  Pop $1 ; 输出内容

  ; 返回码为 0 表示找到了进程
  ${If} $0 == 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "请先关闭应用进程后继续!"
    Abort
  ${EndIf}
!macroend

!macro customUnInstall
  ; 询问是否删除应用数据
  MessageBox MB_YESNO "是否删除应用数据?$\n$\n包括应用设置 互传和通知记录 接收的文件等" \
    /SD IDNO IDNO Skipped IDYES Accepted

  Accepted:
    ; 删除 AppData\Roaming\phonelinker 目录
    RMDir /r "$APPDATA\phonelinker"
    Goto done

  Skipped:
    Goto done

  done:
!macroend
