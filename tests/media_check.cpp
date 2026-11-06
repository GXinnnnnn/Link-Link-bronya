#include <windows.h>
#include <gdiplus.h>
#include <mmsystem.h>
#include <stdio.h>
#include <wchar.h>

// Noninteractive smoke check: decode all source PNGs and play/stop the MP3 briefly.
int main(int argc, char **argv)
{
    if(argc!=2 || !SetCurrentDirectoryA(argv[1])) return 1;
    Gdiplus::GdiplusStartupInput input; ULONG_PTR token;
    if(Gdiplus::GdiplusStartup(&token,&input,NULL)!=Gdiplus::Ok) return 2;
    for(int i=1;i<=25;++i) {
        wchar_t file[128]; swprintf(file,128,L"Images\\Profile\\%d.png",i);
        Gdiplus::Bitmap image(file);
        if(image.GetLastStatus()!=Gdiplus::Ok || image.GetWidth()==0 || image.GetHeight()==0) return 3;
    }
    Gdiplus::GdiplusShutdown(token);
    MCIERROR result=mciSendStringA("open \"sound\\Cyberangel - hanser.mp3\" type mpegvideo alias media_check",NULL,0,NULL);
    if(result) { printf("MCI open error: %lu\n",result); return 4; }
    if(mciSendStringA("play media_check repeat",NULL,0,NULL)) return 5;
    char status[64]={0};
    mciSendStringA("status media_check mode",status,64,NULL);
    bool playing=lstrcmpiA(status,"playing")==0;
    mciSendStringA("close media_check",NULL,0,NULL);
    printf("PASS: 25 PNGs decoded; Cyberangel MCI playback state = %s.\n",status);
    return playing?0:6;
}
