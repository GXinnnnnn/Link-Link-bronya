#include "llk.h"

int main()
{
    // Resolve all external resources relative to the EXE, including shortcuts.
    wchar_t executable[32768];
    GetModuleFileNameW(NULL,executable,32768);
    wchar_t *slash=wcsrchr(executable,L'\\');
    if(slash) { *slash=0; SetCurrentDirectoryW(executable); }
    srand(static_cast<unsigned>(time(NULL)));
    int len=Len_Image*(MapSize+2)+20;
    initgraph(len,len);
    SetWindowTextW(GetHWnd(),L"连连看");
    MoveWindow(GetHWnd(),0,0,len,len,TRUE);
    setwritemode(R2_XORPEN);
    setfillcolor(BLUE);
    for(int i=0;i<25;++i) {
        wchar_t path[MAX_PATH];
        swprintf(path,MAX_PATH,L"Images\\Profile\\%d.png",i+1);
        if(loadimage(&img[i],path,Len_Image,Len_Image) != NO_ERROR || img[i].getwidth() == 0) {
            MessageBoxW(GetHWnd(),path,L"缺少或无法加载图片，请完整解压游戏目录",MB_OK|MB_ICONERROR);
            closegraph(); return 1;
        }
    }
    startgame();
    mciSendStringA("close bmusic1",0,0,0);
    closegraph();
    return 0;
}
